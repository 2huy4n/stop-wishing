#!/usr/bin/env node
// 2026-10-23T14:46+08:00 · 新建 check-tickets.js：校验 docs/tickets/*.md 的 front-matter、依赖 DAG、验收/验证配对与 spec 一致性；零依赖。
//
// 为什么要有它：票是「可验收的小改动」的载体，票写歪了，后面所有自动化都跟着歪。
// 这里只做静态检查（不执行 verify 命令），把「票本身不成立」的情况尽早挡下来。
//
// 用法: node check-tickets.js --dir <项目根> [--json]
// 退出码: 0 无错误（可有警告）/ 1 有错误 / 2 用法或 IO 错误
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { basename, join, resolve } from 'node:path'

const STATUSES = ['todo', 'doing', 'done', 'dropped']
const REQUIRED = ['id', 'title', 'spec', 'status', 'acceptance', 'verify']
const EXEC_PREFIX = /^(node|npm|npx|pnpm|yarn|git|python|python3|pip|pwsh|powershell|bash|sh|zsh|go|cargo|make|dotnet|java|ruby|php|deno|bun)\b/

export function parseArgs(argv) {
  const options = { dir: null, json: false, help: false, unknown: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--json') options.json = true
    else if (arg === '--dir') {
      options.dir = argv[i + 1] ?? null
      i += 1
    } else if (arg.startsWith('--dir=')) options.dir = arg.slice('--dir='.length)
    else if (arg === '--help' || arg === '-h') options.help = true
    else options.unknown.push(arg)
  }
  return options
}

function usage() {
  return [
    '用法: node check-tickets.js --dir <项目根> [--json]',
    '',
    '  --dir   项目根目录（读取 <dir>/docs/tickets/*.md，并对照 <dir>/docs/specs/*.md）',
    '  --json  输出结构化结果（errors/warnings 数组 + counts）',
    '',
    '检查: E1 解析 / E2 必填 / E3 文件名 / E4 id 前缀 / E5 重复 / E6 status / E7 spec 存在 /',
    '      E8 blocked_by 指向 / E9 自依赖 / E10 成环 / E11 验收为空 / E12 验证不足 / E13 完成票被依赖；',
    '      警告: W1 estimate 缺失 / W2 验收过多 / W3 verify 不可执行 / W4 spec 哈希不一致 / W5 spec 未被引用',
    '退出码: 0 无错误 / 1 有错误 / 2 用法或 IO 错误',
  ].join('\n')
}

/** 极简 front-matter 解析：`---` 块内 key: value；数组支持 [a, b] 与后续 `- item`。 */
export function parseFrontMatter(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  if (lines[0]?.trim() !== '---') return { ok: false, fields: new Map(), error: 'front-matter 缺失（文件必须以 --- 开头）' }
  let end = -1
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      end = i
      break
    }
  }
  if (end === -1) return { ok: false, fields: new Map(), error: 'front-matter 未闭合（找不到结束的 ---）' }

  const fields = new Map()
  let lastKey = null
  for (let i = 1; i < end; i += 1) {
    const raw = lines[i]
    const lineNo = i + 1
    if (raw.trim() === '') continue
    const item = /^\s*-\s+(.*)$/.exec(raw)
    if (item) {
      if (!lastKey) return { ok: false, fields, error: `第 ${lineNo} 行：列表项没有归属的 key` }
      const entry = fields.get(lastKey)
      if (!Array.isArray(entry.value)) entry.value = []
      entry.value.push(item[1].trim())
      continue
    }
    const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(raw)
    if (!kv) return { ok: false, fields, error: `第 ${lineNo} 行无法解析（应为 key: value）` }
    const key = kv[1]
    let value = kv[2].trim()
    // 去引号：票里的 id 写成 "0007" 是为了让 YAML 别当八进制，校验时按 0007 处理。
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1)
    }
    let parsed = value
    if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1).trim()
      parsed = inner === '' ? [] : inner.split(',').map(part => part.trim()).filter(Boolean)
    } else if (value === '') {
      parsed = []
    }
    fields.set(key, { value: parsed, line: lineNo })
    lastKey = key
  }
  return { ok: true, fields, error: null }
}

function toArray(value) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value.trim() !== '') return [value.trim()]
  return []
}

function sha256(text) {
  return createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex')
}

/** docs/project.md 的 card 哈希：丢弃 `> 最后更新：…` 行后按 \n 重连，UTF-8 sha256 小写 hex。 */
export function projectCardHash(projectPath) {
  if (!existsSync(projectPath)) return null
  const text = readFileSync(projectPath, 'utf8').replace(/\r\n/g, '\n')
  const kept = text.split('\n').filter(line => !/^>\s*最后更新：/.test(line))
  return sha256(kept.join('\n'))
}

export function checkTickets(options) {
  const root = resolve(options.dir)
  const ticketsDir = join(root, 'docs', 'tickets')
  const specsDir = join(root, 'docs', 'specs')
  const projectPath = join(root, 'docs', 'project.md')
  const errors = []
  const warnings = []
  const notes = []
  const pushError = (code, file, line, message) => errors.push({ code, file, line, message })
  const pushWarning = (code, file, line, message) => warnings.push({ code, file, line, message })

  if (!existsSync(root)) return { ok: false, code: 2, message: '目录不存在: ' + root }
  if (!existsSync(ticketsDir)) {
    notes.push('没有 docs/tickets 目录，视为 0 张票')
    return {
      ok: true,
      code: 0,
      counts: { tickets: 0, specs: 0, errors: 0, warnings: 0 },
      errors,
      warnings,
      notes,
    }
  }

  const ticketFiles = readdirSync(ticketsDir).filter(name => name.endsWith('.md')).sort()
  const tickets = []
  for (const name of ticketFiles) {
    const file = join(ticketsDir, name)
    const rel = `docs/tickets/${name}`
    if (!statSync(file).isFile()) continue
    const text = readFileSync(file, 'utf8')
    const parsed = parseFrontMatter(text)
    if (!parsed.ok) {
      pushError('E1', rel, 1, parsed.error)
      continue
    }
    const ticket = { name, rel, file, fields: parsed.fields, id: null, status: null, blockedBy: [], acceptance: [], verify: [], spec: null, line: 1 }
    const value = key => parsed.fields.get(key)?.value
    const lineOf = key => parsed.fields.get(key)?.line ?? 1

    const fileMatch = /^(\d{4})-[a-z0-9-]+\.md$/.exec(name)
    if (!fileMatch) pushError('E3', rel, 1, '文件名不符合 ^(\\d{4})-[a-z0-9-]+\\.md$')

    for (const key of REQUIRED) {
      const raw = value(key)
      const empty = raw === undefined || raw === '' || (Array.isArray(raw) && raw.length === 0)
      if (empty) pushError('E2', rel, lineOf(key), `缺少必填字段: ${key}`)
    }

    const id = value('id')
    ticket.id = typeof id === 'string' ? id.trim() : id === undefined ? null : String(id)
    if (ticket.id && fileMatch && ticket.id !== fileMatch[1]) {
      pushError('E4', rel, lineOf('id'), `id ${ticket.id} 与文件名前 4 位 ${fileMatch[1]} 不一致`)
    }
    const status = value('status')
    ticket.status = typeof status === 'string' ? status.trim() : null
    if (ticket.status && !STATUSES.includes(ticket.status)) {
      pushError('E6', rel, lineOf('status'), `status 非法: ${ticket.status}（允许 ${STATUSES.join('/')}）`)
    }
    const spec = value('spec')
    ticket.spec = typeof spec === 'string' ? spec.trim() : null
    ticket.blockedBy = toArray(value('blocked_by'))
    ticket.acceptance = toArray(value('acceptance'))
    ticket.verify = toArray(value('verify'))
    tickets.push(ticket)
  }

  // E5 重复 id
  const byId = new Map()
  for (const ticket of tickets) {
    if (!ticket.id) continue
    if (byId.has(ticket.id)) {
      const first = byId.get(ticket.id)
      pushError('E5', ticket.rel, ticket.fields.get('id')?.line ?? 1, `id 重复: ${ticket.id}（首次出现在 ${first.rel}）`)
    } else byId.set(ticket.id, ticket)
  }

  // spec 文件
  const specFiles = existsSync(specsDir) ? readdirSync(specsDir).filter(name => name.endsWith('.md')).sort() : []
  const specNames = new Set(specFiles.map(name => name.replace(/\.md$/, '')))
  const referencedSpecs = new Set()

  for (const ticket of tickets) {
    if (ticket.spec) {
      const name = basename(ticket.spec).replace(/\.md$/, '')
      if (specNames.has(name)) referencedSpecs.add(name)
      else pushError('E7', ticket.rel, ticket.fields.get('spec')?.line ?? 1, `spec 文件不存在: docs/specs/${name}.md`)
    }
    // E8 / E9
    const blockedLine = ticket.fields.get('blocked_by')?.line ?? 1
    for (const dep of ticket.blockedBy) {
      if (dep === ticket.id) pushError('E9', ticket.rel, blockedLine, `blocked_by 指向自身: ${dep}`)
      else if (!byId.has(dep)) pushError('E8', ticket.rel, blockedLine, `blocked_by 指向不存在的票: ${dep}`)
    }
    // E11 / E12
    if (ticket.acceptance.length === 0) pushError('E11', ticket.rel, ticket.fields.get('acceptance')?.line ?? 1, 'acceptance 为空')
    if (ticket.verify.length === 0) {
      pushError('E12', ticket.rel, ticket.fields.get('verify')?.line ?? 1, 'verify 为空')
    } else if (ticket.acceptance.length > ticket.verify.length) {
      pushError('E12', ticket.rel, ticket.fields.get('verify')?.line ?? 1, `acceptance ${ticket.acceptance.length} 条 > verify ${ticket.verify.length} 条（每条验收至少一条验证）`)
    }
    // W1 / W2 / W3
    if (ticket.fields.get('estimate') === undefined) pushWarning('W1', ticket.rel, 1, '缺少 estimate（建议补工期/工作量估计）')
    if (ticket.acceptance.length > 5) pushWarning('W2', ticket.rel, ticket.fields.get('acceptance')?.line ?? 1, `acceptance ${ticket.acceptance.length} 条（>5，建议拆票）`)
    if (ticket.verify.length > 0) {
      const allNonExec = ticket.verify.every(item => !EXEC_PREFIX.test(item.trim()) && !item.trim().startsWith('manual:'))
      if (allNonExec) pushWarning('W3', ticket.rel, ticket.fields.get('verify')?.line ?? 1, 'verify 全部不是可执行命令（也没有 manual: 前缀）')
    }
  }

  // E10 环检测（blocked_by 图：ticket -> 被依赖票）
  const state = new Map()
  const stack = []
  const walk = ticket => {
    state.set(ticket.id, 'visiting')
    stack.push(ticket.id)
    for (const dep of ticket.blockedBy) {
      const next = byId.get(dep)
      if (!next) continue
      if (state.get(next.id) === 'visiting') {
        const start = stack.indexOf(next.id)
        const cycle = [...stack.slice(start), next.id].join(' -> ')
        pushError('E10', ticket.rel, ticket.fields.get('blocked_by')?.line ?? 1, `依赖成环: ${cycle}`)
      } else if (!state.get(next.id)) {
        walk(next)
      }
    }
    stack.pop()
    state.set(ticket.id, 'done')
  }
  for (const ticket of tickets) if (ticket.id && !state.get(ticket.id)) walk(ticket)

  // E13 done/dropped 仍被依赖
  for (const ticket of tickets) {
    if (ticket.status !== 'done' && ticket.status !== 'dropped') continue
    for (const other of tickets) {
      if (other === ticket || !other.blockedBy.includes(ticket.id)) continue
      pushError('E13', other.rel, other.fields.get('blocked_by')?.line ?? 1, `${ticket.id} 已是 ${ticket.status}，仍被本票 blocked_by 引用`)
    }
  }

  // W4 spec card_sha256 与 project.md 不一致
  const projectHash = projectCardHash(projectPath)
  for (const name of specFiles) {
    const rel = `docs/specs/${name}`
    const parsed = parseFrontMatter(readFileSync(join(specsDir, name), 'utf8'))
    if (!parsed.ok) continue
    const card = parsed.fields.get('card_sha256')?.value
    if (typeof card !== 'string' || card.trim() === '') continue
    const expected = String(card).trim().toLowerCase()
    if (projectHash === null) {
      pushWarning('W4', rel, parsed.fields.get('card_sha256').line, 'docs/project.md 不存在，无法核对 card_sha256')
    } else if (expected !== projectHash) {
      pushWarning('W4', rel, parsed.fields.get('card_sha256').line, `card_sha256 与 docs/project.md 当前哈希不一致（spec=${expected.slice(0, 12)}…, project=${projectHash.slice(0, 12)}…）`)
    }
  }

  // W5 spec 未被任何票引用
  for (const name of specFiles) {
    const key = name.replace(/\.md$/, '')
    if (!referencedSpecs.has(key)) pushWarning('W5', `docs/specs/${name}`, 1, '存在 spec 但没有任何票引用它')
  }

  const counts = { tickets: tickets.length, specs: specFiles.length, errors: errors.length, warnings: warnings.length }
  return { ok: errors.length === 0, code: errors.length === 0 ? 0 : 1, counts, errors, warnings, notes }
}

function printHuman(result) {
  for (const note of result.notes) process.stdout.write(note + '\n')
  for (const error of result.errors) process.stdout.write(`${error.code} ${error.file}:${error.line} ${error.message}\n`)
  for (const warning of result.warnings) process.stdout.write(`${warning.code} ${warning.file}:${warning.line} ${warning.message}\n`)
  process.stdout.write(`共 ${result.counts.tickets} 张票 / ${result.counts.specs} 个 spec：错误 ${result.counts.errors} 条，警告 ${result.counts.warnings} 条\n`)
}

if (process.argv[1]?.endsWith('check-tickets.js')) {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    process.stdout.write(usage() + '\n')
    process.exitCode = 0
  } else if (!options.dir || options.unknown.length > 0) {
    process.stderr.write((options.unknown.length > 0 ? '未知参数: ' + options.unknown.join(' ') : '缺少 --dir') + '\n\n' + usage() + '\n')
    process.exitCode = 2
  } else {
    let result
    try {
      result = checkTickets(options)
    } catch (error) {
      process.stderr.write('读取失败: ' + (error instanceof Error ? error.message : String(error)) + '\n')
      process.exit(2)
    }
    if (result.code === 2) {
      process.stderr.write(result.message + '\n')
      process.exitCode = 2
    } else if (options.json) {
      process.stdout.write(JSON.stringify({ tool: 'stop-wishing/check-tickets', dir: resolve(options.dir), counts: result.counts, errors: result.errors, warnings: result.warnings, notes: result.notes }, null, 2) + '\n')
      process.exitCode = result.code
    } else {
      printHuman(result)
      process.exitCode = result.code
    }
  }
}
