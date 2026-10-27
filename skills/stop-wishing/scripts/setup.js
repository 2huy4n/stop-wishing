#!/usr/bin/env node
// 2026-10-23T15:28+08:00 · 新建 setup.js：为项目生成/更新 docs/agents/ 三份配置（issue tracker / domain / triage labels），
// 可选在既有 AGENTS.md 或 CLAUDE.md 末尾维护 `## Project docs` 段。零依赖。
//
// 三条设计底线：
// 1. 只动标记段（`<!-- stop-wishing-setup:begin/end -->`），段外一个字节都不碰；
// 2. 幂等：内容没变就不写盘（避免无意义的 mtime 变化与「每次都像改了什么」）；
// 3. **绝不创建 AGENTS.md**：它属于用户，不存在就跳过并说明。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const BEGIN = '<!-- stop-wishing-setup:begin -->'
export const END = '<!-- stop-wishing-setup:end -->'
export const AGENTS_BEGIN = '<!-- stop-wishing:project-docs:begin -->'
export const AGENTS_END = '<!-- stop-wishing:project-docs:end -->'

const TRACKERS = ['local', 'github', 'other']
const LABELS = ['default', 'none']
const LAYOUTS = ['single', 'multi']

export function parseArgs(argv) {
  const options = { dir: null, issueTracker: 'local', labels: 'default', layout: 'single', agentsMd: false, dryRun: false, json: false, help: false, unknown: [] }
  const value = i => argv[i + 1] ?? null
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--agents-md') options.agentsMd = true
    else if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--json') options.json = true
    else if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--dir') {
      options.dir = value(i)
      i += 1
    } else if (arg.startsWith('--dir=')) options.dir = arg.slice('--dir='.length)
    else if (arg === '--issue-tracker') {
      options.issueTracker = value(i)
      i += 1
    } else if (arg.startsWith('--issue-tracker=')) options.issueTracker = arg.slice('--issue-tracker='.length)
    else if (arg === '--labels') {
      options.labels = value(i)
      i += 1
    } else if (arg.startsWith('--labels=')) options.labels = arg.slice('--labels='.length)
    else if (arg === '--layout') {
      options.layout = value(i)
      i += 1
    } else if (arg.startsWith('--layout=')) options.layout = arg.slice('--layout='.length)
    else options.unknown.push(arg)
  }
  return options
}

export function usage() {
  return [
    '用法: node setup.js --dir <项目根> [--issue-tracker local|github|other] [--labels default|none] [--layout single|multi] [--agents-md] [--dry-run] [--json]',
    '',
    '  --dir            项目根目录（必填）',
    '  --issue-tracker  外部 issue 放在哪：local=docs/issues/（默认）/ github=GitHub Issues / other=自定义（会在问题里列出）',
    '  --labels         是否生成五角色标签映射：default（默认）/ none',
    '  --layout         单包 single（默认）/ 多包 monorepo multi',
    '  --agents-md      若 AGENTS.md（优先）或 CLAUDE.md 已存在，在末尾维护 ## Project docs 段；绝不创建它们',
    '  --dry-run        只报告将创建/更新什么，不写盘',
    '  --json           结构化输出 {files, agentsMd, questions}',
    '',
    '只写三个文件：docs/agents/issue-tracker.md、docs/agents/domain.md、docs/agents/triage-labels.md（--labels default 时）。',
    '每个文件只替换 <!-- stop-wishing-setup:begin -->…<!-- stop-wishing-setup:end --> 段，段外内容原样保留；内容没变不写盘。',
    '退出码: 0 成功（含 unchanged）/ 1 参数错误 / 2 IO 错误',
  ].join('\n')
}

function assertEnum(value, allowed, name) {
  if (!allowed.includes(value)) throw new Error(`${name} 非法: ${value}（允许 ${allowed.join('/')}）`)
}

export function issueTrackerContent(options) {
  const where = {
    local: '`docs/issues/`（本地 issue = 外部反馈；我们自己的工作切片在 `docs/tickets/`，两者分开）',
    github: 'GitHub Issues（用 `gh issue list` / `gh issue create` 读写）',
    other: '由用户指定（见 questions）',
  }[options.issueTracker]
  const create = {
    local: '在 `docs/issues/` 新建 `<NNNN>-<slug>.md`，一条外部反馈一份',
    github: '`gh issue create --title <title> --body-file <file>`',
    other: '由用户指定（见 questions）',
  }[options.issueTracker]
  const read = {
    local: '读 `docs/issues/*.md`；需要转成工作计划时再到 `docs/tickets/`',
    github: '`gh issue list --state all`，单票 `gh issue view <n>`',
    other: '由用户指定（见 questions）',
  }[options.issueTracker]
  return [
    `- **Where:** ${where}`,
    `- **Create:** ${create}`,
    `- **Read:** ${read}`,
    // 没有生成 triage-labels.md 时不要留死指针：指向不存在的文件比没有更糟。
    ...(options.labels === 'default'
      ? ['- **Status mapping:** 见 `docs/agents/triage-labels.md`（needs-triage / ready / blocked / in-progress / done）']
      : []),
    '- **Managed by:** 由 stop-wishing-setup 管理（重跑会更新本段，段外可自由编辑）',
  ].join('\n')
}

export function domainContent(options) {
  const layout = options.layout === 'multi'
    ? '多包仓库（monorepo）：每个包的入口与职责写在各自包内；跨包依赖在 ADR 里记'
    : '单包仓库：源码 / 测试 / 文档三个顶层目录；新模块在 `docs/agents/domain.md` 登记'
  return [
    '- **Glossary:** 在此登记领域术语（一条一行：术语 → 一句人话 → 影响）',
    '- **ADR:** `docs/adr/NNNN-<slug>.md`，一个决定一篇，写清背景 / 选项 / 结论 / 代价',
    `- **Layout:** ${layout}`,
  ].join('\n')
}

export function triageLabelsContent() {
  return [
    '| 角色 | 标签 |',
    '|---|---|',
    '| needs-triage | `needs-triage` |',
    '| ready | `ready` |',
    '| blocked | `blocked` |',
    '| in-progress | `in-progress` |',
    '| done | `done` |',
  ].join('\n')
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
  const current = exists ? readFileSync(file, 'utf8') : ''
  let next
  try {
    next = upsertBlock(current, block(content))
  } catch (error) {
    return { path: rel, file, exists, current, error: `${rel}: ${error.message}` }
  }
  const withTitle = exists ? next : `# ${title}\n\n${next}`
  const action = !exists ? 'created' : withTitle === current ? 'unchanged' : 'updated'
  return { path: rel, file, exists, current, next: withTitle, action }
}

export function setup(options) {
  const root = resolve(options.dir)
  if (!existsSync(root)) return { ok: false, code: 2, message: '目录不存在: ' + root }
  try {
    assertEnum(options.issueTracker, TRACKERS, '--issue-tracker')
    assertEnum(options.labels, LABELS, '--labels')
    assertEnum(options.layout, LAYOUTS, '--layout')
  } catch (error) {
    return { ok: false, code: 1, message: error.message }
  }

  const plans = [
    planFile(root, 'docs/agents/issue-tracker.md', issueTrackerContent(options), 'Issue tracker'),
    planFile(root, 'docs/agents/domain.md', domainContent(options), 'Domain docs'),
  ]
  if (options.labels === 'default') {
    plans.push(planFile(root, 'docs/agents/triage-labels.md', triageLabelsContent(), 'Triage labels'))
  }
  const broken = plans.filter(plan => plan.error)
  if (broken.length > 0) {
    return { ok: false, code: 1, message: '标记段异常，未写任何文件：\n' + broken.map(plan => '  - ' + plan.error).join('\n') }
  }

  let agentsMd = { status: options.agentsMd ? 'not-applicable' : 'disabled', path: null, action: 'skipped' }
  if (options.agentsMd) {
    const agentsPath = join(root, 'AGENTS.md')
    const claudePath = join(root, 'CLAUDE.md')
    const hasAgents = existsSync(agentsPath)
    const hasClaude = existsSync(claudePath)
    if (hasAgents || hasClaude) {
      const target = hasAgents ? 'AGENTS.md' : 'CLAUDE.md'
      const file = hasAgents ? agentsPath : claudePath
      const note = hasAgents && hasClaude ? 'AGENTS.md 与 CLAUDE.md 都存在，按规则优先写 AGENTS.md' : null
      const pointerDefs = [
        ['docs/project.md', '需求卡与边界'],
        ['docs/agents/issue-tracker.md', 'issue 在哪里、怎么读写'],
        ['docs/agents/domain.md', '术语、ADR、目录布局'],
        ['docs/tickets/', '工单与依赖顺序'],
      ]
      const planned = new Set(plans.map(plan => resolve(plan.file)))
      const willExist = rel => existsSync(join(root, rel)) || planned.has(resolve(join(root, rel)))
      const pointers = pointerDefs.filter(([rel]) => willExist(rel))
      const omittedPointers = pointerDefs.filter(([rel]) => !willExist(rel)).map(([rel]) => rel)
      const section = [
        AGENTS_BEGIN,
        '## Project docs',
        '',
        ...pointers.map(([rel, label]) => `- \`${rel}\` — ${label}`),
        AGENTS_END,
        '',
      ].join('\n')
      const current = readFileSync(file, 'utf8')
      // 已有指针段但没有标记（旧版 init-docs 写的）：不追加，避免两份指针。
      if (!current.includes(AGENTS_BEGIN) && /^##\s+(Project docs|项目文档)/m.test(current)) {
        agentsMd = {
          status: 'skipped',
          path: target,
          file,
          action: 'skipped',
          note: '已有指针段但没有标记；为避免重复未追加，请手动合并后重跑',
        }
      } else {
        let next
        try {
          next = upsertBlock(current, section, AGENTS_BEGIN, AGENTS_END)
        } catch (error) {
          return { ok: false, code: 1, message: `${target}: ${error.message}` }
        }
        const action = next === current ? 'unchanged' : 'updated'
        agentsMd = { status: 'written', path: target, file, current, next, action, note, omittedPointers }
      }
    } else {
      agentsMd = {
        status: 'skipped',
        path: null,
        action: 'skipped',
        note: '没有 AGENTS.md 也没有 CLAUDE.md：按约定绝不创建，已跳过（需要时先跑 init-docs.js --lang <zh|en> --agents-md，或让用户自己创建后重跑）',
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
  if (options.issueTracker === 'other') questions.push('issue tracker 具体用哪个工具/字段？（--issue-tracker other）')
  if (options.layout === 'multi') questions.push('多包各自的包名与入口目录是什么？')

  const notes = []
  if (options.labels === 'none') {
    notes.push('未生成 triage-labels.md，因此 issue-tracker.md 不含 Status mapping 指针')
    if (existsSync(join(root, 'docs/agents/triage-labels.md'))) {
      notes.push('已存在 docs/agents/triage-labels.md：--labels none 不会删除它（非破坏性）')
    }
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
  } else if (!options.dir || options.unknown.length > 0) {
    process.stderr.write((options.unknown.length > 0 ? '未知参数: ' + options.unknown.join(' ') : '缺少 --dir') + '\n\n' + usage() + '\n')
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
