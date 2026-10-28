#!/usr/bin/env node
// 2026-10-23T15:28+08:00 · 新建 setup.js：为项目生成/更新 docs/agents/ 三份配置（issue tracker / domain / triage labels），
// 可选在既有 AGENTS.md 或 CLAUDE.md 末尾维护 `## Project docs` 段。零依赖。
//
// 三条设计底线：
// 1. 只动标记段（`<!-- stop-wishing-setup:begin/end -->`），段外一个字节都不碰；
// 2. 幂等：内容没变就不写盘（避免无意义的 mtime 变化与「每次都像改了什么」）；
// 3. **绝不创建 AGENTS.md / CLAUDE.md**：它们属于用户，不存在就跳过并说明。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const BEGIN = '<!-- stop-wishing-setup:begin -->'
export const END = '<!-- stop-wishing-setup:end -->'
export const AGENTS_BEGIN = '<!-- stop-wishing:project-docs:begin -->'
export const AGENTS_END = '<!-- stop-wishing:project-docs:end -->'

const TRACKERS = ['local', 'github', 'other']
const LABELS = ['default', 'none']
const LAYOUTS = ['single', 'multi']
const AGENT_FILES = ['AGENTS', 'CLAUDE']
const TRIAGE_ROLES = ['needs-triage', 'ready', 'blocked', 'in-progress', 'done']

export function parseArgs(argv) {
  const options = {
    dir: null,
    issueTracker: 'local',
    issueTrackerExplicit: false,
    issueTrackerDetail: null,
    labels: 'default',
    layout: 'single',
    layoutExplicit: false,
    glossary: null,
    contexts: null,
    agentsMd: false,
    agentsFile: null,
    dryRun: false,
    json: false,
    help: false,
    missingValue: null,
    unknown: [],
  }
  const value = i => argv[i + 1] ?? null
  const takeValue = name => {
    const v = value(i)
    if (v === null || v === '') {
      options.missingValue = name
      return null
    }
    i += 1
    return v
  }
  let i = 0
  for (; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--agents-md') options.agentsMd = true
    else if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--json') options.json = true
    else if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--dir') options.dir = takeValue('--dir')
    else if (arg.startsWith('--dir=')) options.dir = arg.slice('--dir='.length)
    else if (arg === '--issue-tracker') {
      options.issueTracker = takeValue('--issue-tracker')
      options.issueTrackerExplicit = true
    } else if (arg.startsWith('--issue-tracker=')) {
      options.issueTracker = arg.slice('--issue-tracker='.length)
      options.issueTrackerExplicit = true
    } else if (arg === '--issue-tracker-detail') options.issueTrackerDetail = takeValue('--issue-tracker-detail')
    else if (arg.startsWith('--issue-tracker-detail=')) {
      options.issueTrackerDetail = arg.slice('--issue-tracker-detail='.length)
      if (!options.issueTrackerDetail) options.missingValue = '--issue-tracker-detail'
    } else if (arg === '--labels') options.labels = takeValue('--labels')
    else if (arg.startsWith('--labels=')) options.labels = arg.slice('--labels='.length)
    else if (arg === '--layout') {
      options.layout = takeValue('--layout')
      options.layoutExplicit = true
    } else if (arg.startsWith('--layout=')) {
      options.layout = arg.slice('--layout='.length)
      options.layoutExplicit = true
    } else if (arg === '--glossary') options.glossary = takeValue('--glossary')
    else if (arg.startsWith('--glossary=')) {
      options.glossary = arg.slice('--glossary='.length)
      if (!options.glossary) options.missingValue = '--glossary'
    } else if (arg === '--contexts') options.contexts = takeValue('--contexts')
    else if (arg.startsWith('--contexts=')) {
      options.contexts = arg.slice('--contexts='.length)
      if (!options.contexts) options.missingValue = '--contexts'
    } else if (arg === '--agents-file') options.agentsFile = takeValue('--agents-file')
    else if (arg.startsWith('--agents-file=')) {
      options.agentsFile = arg.slice('--agents-file='.length)
      if (!options.agentsFile) options.missingValue = '--agents-file'
    } else options.unknown.push(arg)
  }
  return options
}

export function usage() {
  return [
    '用法: node setup.js --dir <项目根> [--issue-tracker local|github|other] [--issue-tracker-detail <text>] [--labels default|none] [--layout single|multi] [--glossary <path>] [--contexts <text>] [--agents-md] [--agents-file AGENTS|CLAUDE] [--dry-run] [--json]',
    '',
    '  --dir                  项目根目录（必填）',
    '  --issue-tracker        外部 issue 放在哪：local=docs/issues/（默认）/ github=GitHub Issues / other=自定义',
    '  --issue-tracker-detail other 的具体工具/字段/路径；给出后不再返回该问题',
    '  --labels               是否生成五角色标签映射：default（默认，保留已有右列）/ none',
    '  --layout               单包 single（默认）/ 多包 monorepo multi',
    '  --glossary             glossary 路径，默认 GLOSSARY.md',
    '  --contexts             multi 布局的包边界描述',
    '  --agents-md            若 AGENTS.md 或 CLAUDE.md 已存在，在末尾维护 ## Project docs 段；绝不创建它们',
    '  --agents-file         两者都存在时必填：AGENTS 或 CLAUDE；只维护选中的文件',
    '  --dry-run              只报告将创建/更新什么，不写盘',
    '  --json                 结构化输出 {files, agentsMd, questions, notes}',
    '',
    '只写三个文件：docs/agents/issue-tracker.md、docs/agents/domain.md、docs/agents/triage-labels.md（--labels default 时）。',
    '每个文件只替换 <!-- stop-wishing-setup:begin -->…<!-- stop-wishing-setup:end --> 段，段外内容原样保留；内容没变不写盘。',
    '退出码: 0 成功（含 unchanged）/ 1 参数错误或标记段异常 / 2 IO 错误',
  ].join('\n')
}

function assertEnum(value, allowed, name) {
  if (!allowed.includes(value)) throw new Error(`${name} 非法: ${value}（允许 ${allowed.join('/')}）`)
}

function normalizeAgentsFile(value) {
  if (!value) return null
  const normalized = String(value).replace(/\.md$/i, '').toUpperCase()
  assertEnum(normalized, AGENT_FILES, '--agents-file')
  return normalized
}

export function issueTrackerContent(options) {
  const detail = options.issueTrackerDetail?.trim()
  const fallback = '由用户指定（见 questions）'
  const where = {
    local: '`docs/issues/`（本地 issue = 外部反馈；我们自己的工作切片在 `docs/tickets/`，两者分开）',
    github: 'GitHub Issues（用 `gh issue list` / `gh issue create` 读写）',
    other: detail || fallback,
  }[options.issueTracker]
  const create = {
    local: '在 `docs/issues/` 新建 `<NNNN>-<slug>.md`，一条外部反馈一份',
    github: '`gh issue create --title <title> --body-file <file>`',
    other: detail ? `按“${detail}”的约定创建` : fallback,
  }[options.issueTracker]
  const read = {
    local: '读 `docs/issues/*.md`；需要转成工作计划时再到 `docs/tickets/`',
    github: '`gh issue list --state all`，单票 `gh issue view <n>`',
    other: detail ? `按“${detail}”的约定读取` : fallback,
  }[options.issueTracker]
  return [
    `- **Tracker kind:** ${options.issueTracker}`,
    `- **Where:** ${where}`,
    `- **Create:** ${create}`,
    `- **Read:** ${read}`,
    // 没有生成 triage-labels.md 时不要留死指针：指向不存在的文件比没有更糟。
    ...(options.labels === 'default'
      ? ['- **Status mapping:** 见 `docs/agents/triage-labels.md`（needs-triage / ready / blocked / in-progress / done）']
      : []),
    '- **Ticket status:** todo / doing / done / dropped',
    '- **Managed by:** 由 stop-wishing-setup 管理（重跑会更新本段，段外可自由编辑）',
  ].join('\n')
}

export function domainContent(options) {
  const glossary = options.glossary?.trim() || 'GLOSSARY.md'
  const layout = options.layout === 'multi'
    ? `multi-context — ${options.contexts?.trim() || '各包边界待登记'}`
    : 'single-context — 源码 / 测试 / 文档三个顶层目录；新模块在此登记'
  return [
    `- **Glossary:** \`${glossary}\`（首次登记术语时创建；一条一行：术语 → 一句人话 → 影响）`,
    '- **ADR:** `docs/adr/NNNN-<slug>.md`，一个决定一篇，写清背景 / 选项 / 结论 / 代价',
    `- **Layout:** ${layout}`,
  ].join('\n')
}

function formatLabel(value) {
  const raw = String(value ?? '').trim().replace(/^`|`$/g, '')
  return `\`${raw || 'needs-triage'}\``
}

export function triageLabelsContent(labelMap = {}) {
  return [
    '| 角色 | 标签 |',
    '|---|---|',
    ...TRIAGE_ROLES.map(role => `| ${role} | ${formatLabel(labelMap[role] ?? role)} |`),
  ].join('\n')
}

export function readTriageMap(root) {
  const file = join(root, 'docs', 'agents', 'triage-labels.md')
  if (!existsSync(file)) return {}
  const map = {}
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\|\s*([a-z-]+)\s*\|\s*`?([^`|]+)`?\s*\|$/.exec(line.trim())
    if (match && TRIAGE_ROLES.includes(match[1])) map[match[1]] = match[2].trim()
  }
  return map
}

export function readIssueTrackerSettings(root) {
  const file = join(root, 'docs', 'agents', 'issue-tracker.md')
  if (!existsSync(file)) return {}
  const text = readFileSync(file, 'utf8')
  const where = /^- \*\*Where:\*\*\s*(.+)$/m.exec(text)?.[1]?.trim() ?? ''
  const kind = /^- \*\*Tracker kind:\*\*\s*(local|github|other)\b/m.exec(text)?.[1]
  if (kind) return kind === 'other' ? { mode: 'other', detail: where || null } : { mode: kind }
  // Older files have no Tracker kind; infer conservatively from Where.
  if (where.includes('docs/issues/')) return { mode: 'local' }
  if (/GitHub/i.test(where)) return { mode: 'github' }
  if (where && !where.includes('由用户指定')) return { mode: 'other', detail: where }
  return {}
}

export function readDomainSettings(root) {
  const file = join(root, 'docs', 'agents', 'domain.md')
  if (!existsSync(file)) return {}
  const text = readFileSync(file, 'utf8')
  const glossary = /^- \*\*Glossary:\*\*\s*`([^`]+)`/m.exec(text)?.[1] ?? null
  const layout = /^- \*\*Layout:\*\*\s*(.+)$/m.exec(text)?.[1]?.trim() ?? ''
  if (layout.startsWith('multi-context')) {
    const contexts = layout.replace(/^multi-context\s*—\s*/, '').trim()
    return { glossary, mode: 'multi', contexts: contexts || null }
  }
  if (layout.startsWith('single-context')) return { glossary, mode: 'single' }
  return { glossary }
}

/** 用标记段包住内容；段外内容不动。 */
export function block(content, begin = BEGIN, end = END) {
  return `${begin}\n${content}\n${end}\n`
}

function markerCount(text, marker) {
  let count = 0
  let at = text.indexOf(marker)
  while (at !== -1) {
    count += 1
    at = text.indexOf(marker, at + marker.length)
  }
  return count
}

function markerLine(text, marker) {
  const at = text.indexOf(marker)
  return at === -1 ? '未出现' : `第 ${text.slice(0, at).split('\n').length} 行`
}

/**
 * 把 block 写进现有文本：
 * - 没有标记段 → 追加；
 * - 恰好一对且顺序正确 → 替换段内（含标记）；
 * - 残缺 / 重复 / 顺序颠倒 → 抛错，调用方停下，绝不猜。
 */
export function upsertBlock(text, blockText, begin = BEGIN, end = END) {
  const begins = markerCount(text, begin)
  const ends = markerCount(text, end)
  if (begins === 0 && ends === 0) {
    if (text === '') return blockText
    const needsNewline = !text.endsWith('\n')
    return text + (needsNewline ? '\n' : '') + (text.trimEnd() === '' ? '' : '\n') + blockText
  }
  if (begins !== 1 || ends !== 1) {
    throw new Error(`标记段异常：begin ${begins} 个（${markerLine(text, begin)}），end ${ends} 个（${markerLine(text, end)}）；为避免猜错已停止`)
  }
  const start = text.indexOf(begin)
  const stop = text.indexOf(end)
  if (stop < start) throw new Error('标记段顺序错误：end 出现在 begin 之前；为避免猜错已停止')
  // blockText 自带结尾换行；把紧跟 END 的那个换行吃掉，避免每跑一次多一行。
  const tail = text.slice(stop + end.length).replace(/^\r?\n/, '')
  return text.slice(0, start) + blockText + tail
}

function planFile(root, rel, content, title) {
  const file = join(root, rel)
  const exists = existsSync(file)
  let current = ''
  try {
    current = exists ? readFileSync(file, 'utf8') : ''
  } catch (error) {
    return { path: rel, file, exists, current, ioError: true, error: `${rel}: 读取失败: ${error.message}` }
  }
  if (exists && current.trim() !== '' && !current.includes(BEGIN) && !current.includes(END)) {
    return { path: rel, file, exists, current, error: `${rel}: 旧文件没有 setup marker；为避免追加第二份内容已停止，请先手动包上 begin/end` }
  }
  let next
  try {
    next = upsertBlock(current, block(content))
  } catch (error) {
    return { path: rel, file, exists, current, error: `${rel}: ${error.message}` }
  }
  const withTitle = !exists || current.trim() === '' || !/^#\s+/m.test(current) ? `# ${title}\n\n${next}` : next
  const action = !exists ? 'created' : withTitle === current ? 'unchanged' : 'updated'
  return { path: rel, file, exists, current, next: withTitle, action }
}

function buildAgentsSection(current, pointerDefs, willExist) {
  const hasBlock = current.includes(AGENTS_BEGIN) && current.includes(AGENTS_END)
  let inner = ''
  if (hasBlock) {
    const start = current.indexOf(AGENTS_BEGIN) + AGENTS_BEGIN.length
    const stop = current.indexOf(AGENTS_END)
    inner = current.slice(start, stop)
  }
  const heading = inner.match(/^##\s+.+$/m)?.[0] ?? '## Project docs'
  const innerLines = inner.split(/\r?\n/).filter(line => line !== heading)
  while (innerLines.length > 0 && innerLines[0].trim() === '') innerLines.shift()
  while (innerLines.length > 0 && innerLines[innerLines.length - 1].trim() === '') innerLines.pop()
  const existingRefs = new Set([...inner.matchAll(/`(docs\/[^`\s]+)`/g)].map(match => match[1]))
  const missing = pointerDefs.filter(([rel]) => willExist(rel) && !existingRefs.has(rel))
  const omitted = pointerDefs.filter(([rel]) => !willExist(rel) && !existingRefs.has(rel)).map(([rel]) => rel)
  // Keep any trailing generated-by comment at the end; new pointers go before it.
  const commentAt = innerLines.findIndex(line => line.trim().startsWith('<!--'))
  const insertAt = commentAt === -1 ? innerLines.length : commentAt
  innerLines.splice(insertAt, 0, ...missing.map(([rel, label]) => `- \`${rel}\` — ${label}`))
  const lines = [
    heading,
    '',
    ...innerLines,
  ]
  return {
    section: `${AGENTS_BEGIN}\n${lines.join('\n')}\n${AGENTS_END}\n`,
    omitted,
    hadBlock: hasBlock,
    preservedLines: innerLines.length,
  }
}

function selectAgentsFile(root, options) {
  const choice = options.agentsFile
  if (choice) {
    const name = `${choice}.md`
    if (!existsSync(join(root, name))) return { error: `--agents-file ${name} 不存在；本技能绝不创建 AGENTS.md / CLAUDE.md` }
    return { target: name, file: join(root, name) }
  }
  const hasAgents = existsSync(join(root, 'AGENTS.md'))
  const hasClaude = existsSync(join(root, 'CLAUDE.md'))
  if (hasAgents && hasClaude) return { error: 'AGENTS.md 与 CLAUDE.md 都存在；请用 --agents-file AGENTS|CLAUDE 选择要维护的一个' }
  if (hasAgents) return { target: 'AGENTS.md', file: join(root, 'AGENTS.md') }
  if (hasClaude) return { target: 'CLAUDE.md', file: join(root, 'CLAUDE.md') }
  return { target: null, file: null }
}

export function setup(options) {
  const root = resolve(options.dir)
  if (!existsSync(root)) return { ok: false, code: 2, message: '目录不存在: ' + root }
  let existingIssue
  let existingDomain
  try {
    existingIssue = readIssueTrackerSettings(root)
    existingDomain = readDomainSettings(root)
  } catch (error) {
    return { ok: false, code: 2, message: '读取 docs/agents 失败: ' + error.message }
  }
  const effectiveIssue = options.issueTrackerExplicit ? options.issueTracker : (existingIssue.mode || options.issueTracker)
  const effectiveDetail = options.issueTrackerDetail?.trim() || existingIssue.detail || null
  const effectiveLayout = options.layoutExplicit ? options.layout : (existingDomain.mode || options.layout)
  const effectiveContexts = options.contexts?.trim() || existingDomain.contexts || null
  const effectiveGlossary = options.glossary?.trim() || existingDomain.glossary || 'GLOSSARY.md'
  const contentOptions = {
    ...options,
    issueTracker: effectiveIssue,
    issueTrackerDetail: effectiveDetail,
    layout: effectiveLayout,
    contexts: effectiveContexts,
    glossary: effectiveGlossary,
  }
  try {
    assertEnum(effectiveIssue, TRACKERS, '--issue-tracker')
    assertEnum(options.labels, LABELS, '--labels')
    assertEnum(effectiveLayout, LAYOUTS, '--layout')
    if (options.agentsFile) options.agentsFile = normalizeAgentsFile(options.agentsFile)
    if (options.agentsFile && !options.agentsMd) throw new Error('--agents-file 必须和 --agents-md 一起使用')
    if (effectiveIssue === 'other' && !effectiveDetail) {
      throw new Error('--issue-tracker other 需要 --issue-tracker-detail <text>；未写任何文件')
    }
    if (effectiveLayout === 'multi' && !effectiveContexts) {
      throw new Error('--layout multi 需要 --contexts <text>；未写任何文件')
    }
  } catch (error) {
    return { ok: false, code: 1, message: error.message }
  }

  let labelMap = {}
  try {
    labelMap = options.labels === 'default' ? readTriageMap(root) : {}
  } catch (error) {
    return { ok: false, code: 2, message: '读取 triage-labels.md 失败: ' + error.message }
  }
  const plans = [
    planFile(root, 'docs/agents/issue-tracker.md', issueTrackerContent(contentOptions), 'Issue tracker'),
    planFile(root, 'docs/agents/domain.md', domainContent(contentOptions), 'Domain docs'),
  ]
  if (options.labels === 'default') {
    plans.push(planFile(root, 'docs/agents/triage-labels.md', triageLabelsContent(labelMap), 'Triage labels'))
  }
  const ioBroken = plans.find(plan => plan.ioError)
  if (ioBroken) return { ok: false, code: 2, message: ioBroken.error }
  const broken = plans.filter(plan => plan.error)
  if (broken.length > 0) {
    return { ok: false, code: 1, message: '标记段异常，未写任何文件：\n' + broken.map(plan => '  - ' + plan.error).join('\n') }
  }

  let agentsMd = { status: options.agentsMd ? 'not-applicable' : 'disabled', path: null, action: 'skipped', omittedPointers: [] }
  if (options.agentsMd) {
    const selected = selectAgentsFile(root, options)
    if (selected.error) return { ok: false, code: 1, message: selected.error }
    if (selected.target) {
      const pointerDefs = [
        ['docs/project.md', '需求卡与边界'],
        ['docs/agents/issue-tracker.md', 'issue 在哪里、怎么读写'],
        ['docs/agents/domain.md', '术语、ADR、目录布局'],
        ['docs/tickets/', '工单与依赖顺序'],
      ]
      const planned = new Set(plans.map(plan => resolve(plan.file)))
      const willExist = rel => existsSync(join(root, rel)) || planned.has(resolve(join(root, rel)))
      let current
      try {
        current = readFileSync(selected.file, 'utf8')
      } catch (error) {
        return { ok: false, code: 2, message: `读取 ${selected.target} 失败: ${error.message}` }
      }
      // 只有“两个标记都不存在”才是旧版无标记指针段；只剩 end 说明标记残缺，必须让 upsertBlock 报错。
      if (!current.includes(AGENTS_BEGIN) && !current.includes(AGENTS_END) && /^##\s+(Project docs|项目文档)/m.test(current)) {
        agentsMd = {
          status: 'skipped',
          path: selected.target,
          file: selected.file,
          action: 'skipped',
          note: '已有指针段但没有标记；为避免重复未追加，请手动合并后重跑',
          omittedPointers: pointerDefs.filter(([rel]) => !willExist(rel)).map(([rel]) => rel),
        }
      } else {
        const section = buildAgentsSection(current, pointerDefs, willExist)
        let next
        try {
          next = upsertBlock(current, section.section, AGENTS_BEGIN, AGENTS_END)
        } catch (error) {
          return { ok: false, code: 1, message: `${selected.target}: ${error.message}` }
        }
        const action = next === current ? 'unchanged' : 'updated'
        agentsMd = {
          status: 'written',
          path: selected.target,
          file: selected.file,
          current,
          next,
          action,
          note: section.preservedLines > 0
            ? `已保留原有 ${section.preservedLines} 行指针内容，只追加缺失项`
            : null,
          omittedPointers: section.omitted,
        }
      }
    } else {
      agentsMd = {
        status: 'skipped',
        path: null,
        action: 'skipped',
        note: '没有 AGENTS.md 也没有 CLAUDE.md：按约定绝不创建，已跳过（需要时先跑 init-docs.js --lang <zh|en> --agents-md，或让用户自己创建后重跑）',
        omittedPointers: [],
      }
    }
  }

  const changed = plans.filter(plan => plan.action !== 'unchanged')
  if (!options.dryRun) {
    try {
      for (const plan of changed) {
        mkdirSync(join(root, 'docs', 'agents'), { recursive: true })
        writeFileSync(plan.file, plan.next, 'utf8')
      }
      if (agentsMd.status === 'written' && agentsMd.action === 'updated') {
        writeFileSync(agentsMd.file, agentsMd.next, 'utf8')
      }
    } catch (error) {
      return { ok: false, code: 2, message: '写盘失败: ' + (error instanceof Error ? error.message : String(error)) }
    }
  }

  const questions = []
  if (effectiveIssue === 'other' && !effectiveDetail) questions.push('issue tracker 具体用哪个工具/字段/路径？（--issue-tracker other --issue-tracker-detail <text>）')
  if (effectiveLayout === 'multi' && !effectiveContexts) questions.push('多包各自的包名、入口目录和边界是什么？（--layout multi --contexts <text>）')

  const notes = []
  if (options.labels === 'none') {
    notes.push('未生成 triage-labels.md，因此 issue-tracker.md 不含 Status mapping 指针')
    if (existsSync(join(root, 'docs/agents/triage-labels.md'))) {
      notes.push('已存在 docs/agents/triage-labels.md：--labels none 不会删除它（非破坏性）')
    }
  }
  if (agentsMd.omittedPointers?.length > 0) {
    notes.push('省略的指针（目标不存在）: ' + agentsMd.omittedPointers.join(', '))
  }

  return {
    ok: true,
    code: 0,
    root,
    dryRun: options.dryRun,
    files: plans.map(plan => ({ path: plan.path, action: options.dryRun && plan.action !== 'unchanged' ? 'would-' + plan.action : plan.action })),
    agentsMd: {
      status: agentsMd.status,
      path: agentsMd.path,
      action: options.dryRun && agentsMd.action === 'updated' ? 'would-update' : agentsMd.action,
      note: agentsMd.note ?? null,
      omittedPointers: agentsMd.omittedPointers ?? [],
    },
    questions,
    notes,
  }
}

if (process.argv[1]?.endsWith('setup.js')) {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    process.stdout.write(usage() + '\n')
    process.exitCode = 0
  } else if (!options.dir || options.unknown.length > 0 || options.missingValue) {
    const reason = options.unknown.length > 0
      ? '未知参数: ' + options.unknown.join(' ')
      : options.missingValue
        ? '参数缺少值: ' + options.missingValue
        : '缺少 --dir'
    process.stderr.write(reason + '\n\n' + usage() + '\n')
    process.exitCode = 1
  } else {
    const result = setup(options)
    if (!result.ok) {
      process.stderr.write(result.message + '\n')
      process.exitCode = result.code
    } else if (options.json) {
      process.stdout.write(JSON.stringify({ tool: 'stop-wishing/setup', dir: result.root, dryRun: result.dryRun, files: result.files, agentsMd: result.agentsMd, questions: result.questions, notes: result.notes }, null, 2) + '\n')
      process.exitCode = 0
    } else {
      if (result.dryRun) process.stdout.write('[dry-run] 不会写盘\n')
      for (const file of result.files) process.stdout.write(`${file.action}\t${file.path}\n`)
      const unchanged = result.agentsMd.action === 'unchanged' ? ' (unchanged)' : ''
      process.stdout.write(`agents-md: ${result.agentsMd.status}${unchanged}${result.agentsMd.path ? ' -> ' + result.agentsMd.path : ''}${result.agentsMd.note ? '（' + result.agentsMd.note + '）' : ''}\n`)
      for (const note of result.notes ?? []) process.stdout.write('note: ' + note + '\n')
      for (const question of result.questions) process.stdout.write('question: ' + question + '\n')
      process.exitCode = 0
    }
  }
}
