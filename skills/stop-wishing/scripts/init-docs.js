#!/usr/bin/env node
// 2026-10-20T19:02+08:00 · 改动：init-docs 统一 LICENSES.md、进度文件改为 H1 后插环境快照、未知版本不再输出 null、修正退出码；原因：QA F1/F3/F6/F7；回滚：git checkout pre-qa-fix-20261020-1849
//
// 设计取舍：
// - 模板从「脚本所在目录」解析（../templates/<lang>），不写任何本机绝对路径；
// - 已存在就拒绝（exit 1），除非 --force —— 覆盖别人的文档比不生成危险得多；
// - 模板缺失 exit 2（和「已存在」分开，调用方才知道是自己用错语言还是目录坏了）；
// - progress.md 首行必须是 H1，环境快照插在 H1 之后（否则 markdown 渲染把 H1 降级）。
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkEnv } from './check-env.js'

const DOCS = ['project', 'content', 'structure', 'progress', 'todo', 'discipline', 'LICENSES']
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export function parseArgs(argv) {
  const options = { lang: null, dir: process.cwd(), force: false, agentsMd: false, help: false, unknown: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--force') options.force = true
    else if (arg === '--agents-md') options.agentsMd = true
    else if (arg === '--lang') {
      options.lang = argv[i + 1] ?? null
      i += 1
    } else if (arg.startsWith('--lang=')) options.lang = arg.slice('--lang='.length)
    else if (arg === '--dir') {
      options.dir = argv[i + 1] ?? options.dir
      i += 1
    } else if (arg.startsWith('--dir=')) options.dir = arg.slice('--dir='.length)
    else options.unknown.push(arg)
  }
  return options
}

function usage() {
  return [
    '用法: node scripts/init-docs.js --lang <en|zh> [--dir <目录>] [--force] [--agents-md]',
    '',
    '  --lang  模板语言（必填）：en | zh',
    '  --dir   目标目录（默认当前目录）；文档写到 <dir>/docs/',
    '  --force 覆盖已存在的文档（默认拒绝）',
    '  --agents-md  额外在仓库根写一个 AGENTS.md（只放指向 docs/ 的指针）；',
    '               仅在用户明确同意时使用；已存在 AGENTS.md 或 CLAUDE.md 时不覆盖',
    '',
    '退出码: 0 成功 / 1 参数错误或目标已存在 / 2 模板缺失',
  ].join('\n')
}

/** 版本未知时写「未检测到版本」，绝不输出 null（null 在 markdown 里既难看又像程序漏了值）。 */
function describeTool(tool) {
  if (!tool.ok) return '未检测到'
  if (tool.version) return String(tool.version)
  return '未检测到版本' + (tool.source ? `（可执行文件在：${tool.source}）` : '')
}

/** progress.md 的环境快照行（H1 之后插入；导出是为了能单测，不必起进程）。 */
export function snapshotLines(env) {
  return [
    '> 环境快照（init-docs 生成于 ' + env.at + '）',
    '> - node: ' + env.node.version,
    '> - git: ' + describeTool(env.git),
    '> - bash: ' + describeTool(env.bash),
    '> - 平台: ' + env.platform,
    '> - 备份方式建议: ' + env.backup.method + '（' + env.backup.hint + '）',
    '',
  ]
}

/** 把快照插在第一个 H1 之后（中间留一空行）；模板没有 H1 时补一个，保证「首行必须是 H1」。 */
export function insertSnapshot(markdown, lines) {
  const block = lines.join('\n')
  const match = /^(# .*)(?:\r?\n|$)/.exec(markdown)
  if (!match) return '# 项目进度\n\n' + block + '\n' + markdown
  const head = match[1]
  const rest = markdown.slice(match[0].length)
  return head + '\n\n' + block + '\n' + rest
}

export function initDocs(options, env = checkEnv()) {
  const lang = options.lang
  if (lang !== 'en' && lang !== 'zh') {
    return { ok: false, code: 1, message: '缺少或非法的 --lang（只支持 en | zh）\n\n' + usage() }
  }
  if (options.unknown?.length) {
    return { ok: false, code: 1, message: '未知参数: ' + options.unknown.join(' ') + '\n\n' + usage() }
  }
  const templates = join(ROOT, 'templates', lang)
  if (!existsSync(templates)) {
    return { ok: false, code: 2, message: '模板目录不存在: ' + templates }
  }
  const docsDir = join(resolve(options.dir), 'docs')
  const targets = DOCS.map(name => join(docsDir, `${name}.md`))
  const existing = targets.filter(file => existsSync(file))
  if (existing.length > 0 && !options.force) {
    return {
      ok: false,
      code: 1,
      message: ['以下文档已存在（加 --force 才会覆盖）:', ...existing.map(file => '  - ' + file)].join('\n'),
    }
  }

  mkdirSync(docsDir, { recursive: true })
  const written = []
  for (const name of DOCS) {
    const source = join(templates, `${name}.md`)
    if (!existsSync(source)) return { ok: false, code: 2, message: '模板缺失: ' + source }
    const target = join(docsDir, `${name}.md`)
    copyFileSync(source, target)
    written.push(target)
  }

  const progressPath = join(docsDir, 'progress.md')
  const original = readFileSync(progressPath, 'utf8')
  writeFileSync(progressPath, insertSnapshot(original, snapshotLines(env)), 'utf8')

  // AGENTS.md 只在用户明确同意时生成（--agents-md）；已有 AGENTS.md 或 CLAUDE.md 时不覆盖——
  // 那是用户自己的仓库约定，改它比不生成危险得多。
  let agentsMd = null
  if (options.agentsMd) {
    const rootDir = resolve(options.dir)
    const agentsPath = join(rootDir, 'AGENTS.md')
    const claudePath = join(rootDir, 'CLAUDE.md')
    if (existsSync(agentsPath) || existsSync(claudePath)) {
      agentsMd = { written: false, reason: (existsSync(agentsPath) ? 'AGENTS.md' : 'CLAUDE.md') + ' 已存在，未修改' }
    } else {
      const source = join(templates, 'AGENTS.md.tpl')
      if (!existsSync(source)) return { ok: false, code: 2, message: '模板缺失: ' + source }
      copyFileSync(source, agentsPath)
      agentsMd = { written: true, path: agentsPath }
    }
  }

  return { ok: true, code: 0, lang, docsDir, written, snapshotted: progressPath, agentsMd }
}

if (process.argv[1]?.endsWith('init-docs.js')) {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    process.stdout.write(usage() + '\n')
    process.exitCode = 0
  } else {
    const result = initDocs(options)
    if (result.ok) {
      process.stdout.write(`已生成 ${result.written.length} 份文档到 ${result.docsDir}\n`)
      for (const file of result.written) process.stdout.write('  - ' + file + '\n')
      if (result.agentsMd) {
        if (result.agentsMd.written) process.stdout.write('已生成 AGENTS.md: ' + result.agentsMd.path + '\n')
        else process.stdout.write('未生成 AGENTS.md: ' + result.agentsMd.reason + '\n')
      }
      process.exitCode = 0
    } else {
      process.stderr.write(result.message + '\n')
      process.exitCode = result.code
    }
  }
}
