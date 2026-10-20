#!/usr/bin/env node
// 2026-10-20T20:18+08:00 · 改动：--verify 改为逐文件 hash 比对（PASS/WARN/FAIL，落后于源退出 4）、usage 补 --tool/--dest 并写明 --target 为兼容旧用法；原因：外部 AI 实测反馈 #1/#2；回滚：git checkout pre-verify-hash-20261020-2016
//
// 为什么默认不覆盖：用户的 skills 目录里可能已经有改过的版本，「安装」把它冲掉是典型的
// 不可逆操作（SKILL.md §9 要求人批）。
// 为什么 --verify 要比 hash：只数文件「齐不齐」会骗人——旧版本文件齐全但内容落后，
// 用户以为装对了、其实没用上修复。
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)))
const SKIP_DIRS = new Set(['.git', 'node_modules', 'test', 'tmp', '.tmp', 'dist', 'coverage'])
const SKIP_FILES = /\.(log|tmp|bak)$|\.bak-/

export const TOOL_ORDER = ['dsh', 'claude', 'codex', 'trae']
export const TOOL_TARGETS = {
  dsh: ['.agents', 'skills', 'stop-wishing'],
  codex: ['.agents', 'skills', 'stop-wishing'],
  trae: ['.agents', 'skills', 'stop-wishing'],
  claude: ['.claude', 'skills', 'stop-wishing'],
}

export const SCRIPT_NAMES = ['check-env', 'init-docs', 'check-hardcode', 'build-portable']
export const TEMPLATE_NAMES = ['project', 'content', 'structure', 'progress', 'todo', 'discipline', 'LICENSES']
export const TEMPLATE_LANGS = ['zh', 'en']

export function parseArgs(argv) {
  const options = { dryRun: false, force: false, claude: false, tool: null, dest: null, target: null, verify: false, help: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--force') options.force = true
    else if (arg === '--claude') options.claude = true
    else if (arg === '--verify') options.verify = true
    else if (arg === '--tool') {
      options.tool = argv[i + 1] ?? null
      i += 1
    } else if (arg.startsWith('--tool=')) options.tool = arg.slice('--tool='.length)
    else if (arg === '--dest') {
      options.dest = argv[i + 1] ?? null
      i += 1
    } else if (arg.startsWith('--dest=')) options.dest = arg.slice('--dest='.length)
    else if (arg === '--target') {
      options.target = argv[i + 1] ?? null
      i += 1
    } else if (arg.startsWith('--target=')) options.target = arg.slice('--target='.length)
    else if (arg === '--help' || arg === '-h') options.help = true
    else (options.unknown ??= []).push(arg)
  }
  return options
}

export function usage() {
  return [
    '用法: node install.js [--tool <dsh|claude|codex|trae>] [--dest <目录>] [--verify] [--dry-run] [--force] [--target <base>]',
    '',
    '  --tool    按用户所用工具选目标（推荐 AI 用这个）：',
    '              dsh / codex / trae -> ~/.agents/skills/stop-wishing',
    '              claude             -> ~/.claude/skills/stop-wishing',
    '  --dest    【精确目标目录】直接装进这个目录（优先级最高；测试/自定义安装用）',
    '              例: --dest <目录>  →  <目录>/SKILL.md',
    '  --verify  安装后自检：逐文件与源做 hash 比对',
    '              [PASS] 齐全且与源一致 / [WARN] 齐全但内容落后于源（退出码 4）/ [FAIL] 缺失或不一致（退出码 3）',
    '  --dry-run 只打印会复制什么、将校验什么，不写盘',
    '  --force   目标已存在时覆盖（默认拒绝）',
    '  --target  【兼容旧用法】只给 base 目录，实际装到 <base>/stop-wishing',
    '              例: --target <base>  →  <base>/stop-wishing/SKILL.md',
    '',
    '不给 --tool/--dest 时默认 ~/.agents/skills/stop-wishing（等价 --tool dsh）。',
    '退出码: 0 成功或 dry-run / 1 参数或覆盖冲突 / 2 源文件缺失 / 3 自检失败（缺失或不一致） / 4 自检告警（内容落后于源）',
  ].join('\n')
}

/** 解析目标目录列表。home 可注入，便于测试不碰真实家目录。 */
export function resolveDestinations(options, home = homedir()) {
  if (options.dest) return [resolve(options.dest)]
  if (options.tool) {
    const parts = TOOL_TARGETS[options.tool]
    if (!parts) return { error: `未知 --tool: ${options.tool}（可选：${TOOL_ORDER.join(' | ')}）` }
    return [join(home, ...parts)]
  }
  const base = options.target ? resolve(options.target) : join(home, '.agents', 'skills')
  const destinations = [join(base, 'stop-wishing')]
  if (options.claude) destinations.push(join(home, '.claude', 'skills', 'stop-wishing'))
  return destinations
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

/** 自检：逐文件与源 hash 比对，输出 PASS / WARN（落后于源）/ FAIL（缺失或不一致）。 */
export function verifyInstall(dir, sourceRoot = ROOT) {
  const groups = [
    { label: 'SKILL.md 存在且含 name: stop-wishing', files: ['SKILL.md'], requireName: true },
    { label: 'scripts/ 下四个脚本齐全', files: SCRIPT_NAMES.map(name => `scripts/${name}.js`) },
    { label: 'templates/zh/ 各 7 份', files: TEMPLATE_NAMES.map(name => `templates/zh/${name}.md`) },
    { label: 'templates/en/ 各 7 份', files: TEMPLATE_NAMES.map(name => `templates/en/${name}.md`) },
    { label: 'LICENSE 存在', files: ['LICENSE'] },
  ]

  const results = []
  for (const group of groups) {
    const missing = []
    const stale = []
    for (const file of group.files) {
      const target = join(dir, file)
      const source = join(sourceRoot, file)
      if (!existsSync(target)) {
        missing.push(file)
        continue
      }
      if (existsSync(source) && sha256(target) !== sha256(source)) stale.push(file)
    }
    let status = 'PASS'
    let detail = '齐全且与源一致'
    if (missing.length > 0) {
      status = 'FAIL'
      detail = '缺失: ' + missing.join(', ')
    } else if (stale.length > 0) {
      status = 'WARN'
      detail = '内容落后于源（建议 --force 更新）: ' + stale.join(', ')
    }
    if (group.requireName && status !== 'FAIL') {
      const text = readFileSync(join(dir, 'SKILL.md'), 'utf8')
      if (!/^name:\s*stop-wishing\s*$/m.test(text)) {
        status = 'FAIL'
        detail = 'front-matter 里没有 name: stop-wishing'
      }
    }
    results.push({ label: group.label, status, detail })
  }

  const hasFail = results.some(item => item.status === 'FAIL')
  const hasWarn = results.some(item => item.status === 'WARN')
  return { dir, results, ok: !hasFail && !hasWarn, code: hasFail ? 3 : hasWarn ? 4 : 0 }
}

/** 收集要复制的文件（相对路径），排除 .git/node_modules/test/临时文件。 */
export function collectFiles(root) {
  const files = []
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue
        walk(join(dir, entry.name))
      } else if (entry.isFile()) {
        if (SKIP_FILES.test(entry.name)) continue
        files.push(relative(root, join(dir, entry.name)))
      }
    }
  }
  walk(root)
  return files.sort()
}

export function install(options, home = homedir()) {
  if (!existsSync(join(ROOT, 'SKILL.md'))) {
    return { ok: false, code: 2, message: '源文件缺失: ' + join(ROOT, 'SKILL.md') }
  }
  if (options.unknown?.length) {
    return { ok: false, code: 1, message: '未知参数: ' + options.unknown.join(' ') + '\n\n' + usage() }
  }
  const destinations = resolveDestinations(options, home)
  if (!Array.isArray(destinations)) return { ok: false, code: 1, message: destinations.error + '\n\n' + usage() }
  for (const dest of destinations) {
    if (resolve(dest).startsWith(ROOT)) {
      return { ok: false, code: 2, message: '目标目录不能是源目录本身: ' + dest }
    }
  }

  const files = collectFiles(ROOT)
  const plan = destinations.map(dest => ({
    dest,
    exists: existsSync(dest),
    // --verify 且目标已存在、又没要求覆盖：只做校验，不重装（用于「装完坏了/装旧了」的自检）。
    action: !existsSync(dest) ? '创建' : options.verify && !options.force ? '仅校验（已存在，未覆盖）' : options.force ? '覆盖' : '拒绝（已存在，加 --force）',
  }))
  const defaultHint = !options.tool && !options.dest && !options.target && !options.claude
    ? '提示：可用 --tool dsh|claude|codex|trae 选择目标（默认等价 dsh）'
    : null

  if (options.dryRun) {
    return {
      ok: true,
      code: 0,
      dryRun: true,
      root: ROOT,
      files,
      plan,
      defaultHint,
      verifyPlan: '将校验（逐文件 hash 比对）：SKILL.md 含 name: stop-wishing · scripts/ 四个脚本 · templates/{zh,en} 各 7 份 · LICENSE；与源不一致报 WARN 并退出 4',
    }
  }

  const conflict = plan.find(item => item.action.startsWith('拒绝'))
  if (conflict) {
    return { ok: false, code: 1, message: `目标已存在且未加 --force: ${conflict.dest}`, plan, files, defaultHint }
  }

  for (const item of plan) {
    if (item.action.startsWith('仅校验')) continue
    for (const file of files) {
      const target = join(item.dest, file)
      mkdirSync(dirname(target), { recursive: true })
      copyFileSync(join(ROOT, file), target)
    }
  }

  let verification = null
  if (options.verify) {
    verification = plan.map(item => verifyInstall(item.dest))
    const failing = verification.filter(item => !item.ok)
    if (failing.length > 0) {
      const code = verification.some(item => item.code === 3) ? 3 : 4
      const message = code === 3 ? '自检失败：缺失或不一致，见上方 FAIL' : '自检告警：内容落后于源（建议 --force 更新），见上方 WARN'
      return { ok: false, code, message, plan, files, verification, defaultHint }
    }
  }
  return { ok: true, code: 0, dryRun: false, root: ROOT, files, plan, verification, defaultHint }
}

function printVerification(verification) {
  for (const item of verification) {
    process.stdout.write(`自检目标: ${item.dir}\n`)
    for (const result of item.results) {
      process.stdout.write(`  [${result.status}] ${result.label} — ${result.detail}\n`)
    }
  }
}

if (process.argv[1]?.endsWith('install.js')) {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    process.stdout.write(usage() + '\n')
    process.exitCode = 0
  } else {
    const result = install(options)
    if (result.defaultHint) process.stdout.write(result.defaultHint + '\n')
    if (!result.ok) {
      if (result.verification) printVerification(result.verification)
      process.stderr.write((result.message ?? '安装失败') + '\n')
      process.exitCode = result.code
    } else {
      if (result.dryRun) process.stdout.write('[dry-run] 不会写盘\n')
      process.stdout.write(`源目录: ${result.root}\n`)
      process.stdout.write(`文件数: ${result.files.length}\n`)
      for (const item of result.plan) {
        process.stdout.write(`  -> ${item.dest}  [${item.action}]\n`)
      }
      if (result.verifyPlan) process.stdout.write(result.verifyPlan + '\n')
      if (result.verification) printVerification(result.verification)
      process.stdout.write('文件清单（前 20）:\n')
      for (const file of result.files.slice(0, 20)) process.stdout.write('  - ' + file + '\n')
      if (result.files.length > 20) process.stdout.write(`  ... 其余 ${result.files.length - 20} 个\n`)
      process.exitCode = 0
    }
  }
}
