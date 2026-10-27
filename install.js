#!/usr/bin/env node
// 2026-10-23T15:46+08:00 · 改动：扩到七个技能（新增 setup）并给主技能加 setup 脚本；原因：新增初始化工作流；回滚：git checkout pre-setup-20261023-1528
//
// 为什么默认不覆盖：用户的 skills 目录里可能已经有改过的版本，「安装」把它冲掉是典型的
// 不可逆操作（SKILL.md §9 要求人批）。
// 为什么 --verify 要比 hash：只数文件「齐不齐」会骗人——旧版本文件齐全但内容落后，
// 用户以为装对了、其实没用上修复。
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, rmdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)))
const VERSION = (() => {
  try {
    return readFileSync(join(ROOT, 'VERSION'), 'utf8').trim()
  } catch {
    return 'unknown'
  }
})()
const SKILLS_ROOT = join(ROOT, 'skills')
const SKIP_DIRS = new Set(['.git', 'node_modules', 'test', 'tmp', '.tmp', 'dist', 'coverage'])
const SKIP_FILES = /\.(log|tmp|bak)$|\.bak-|^\.install-manifest\.json$/
// 每个技能安装后都必须携带的许可与归属声明（MIT 要求副本保留声明）。
const NOTICE_FILES = ['LICENSE', 'THIRD-PARTY-NOTICES.md']
// 安装清单：升级时据此删除「上一版有、这一版没有」的文件，避免旧脚本残留。
const MANIFEST = '.install-manifest.json'
// 没有清单的旧安装也要清掉这些已知废弃文件；清单机制覆盖以后的新增废弃项。
const LEGACY_STALE = ['scripts/build-portable.js']

export const TOOL_ORDER = ['dsh', 'claude', 'codex', 'trae']
/** 每个工具对应的 skills 根目录（八个技能会作为子目录放在这里）。 */
export const TOOL_TARGETS = {
  dsh: ['.agents', 'skills'],
  codex: ['.agents', 'skills'],
  trae: ['.agents', 'skills'],
  claude: ['.claude', 'skills'],
}

export const SKILL_NAMES = ['stop-wishing', 'stop-wishing-review', 'stop-wishing-audit', 'stop-wishing-debt', 'stop-wishing-spec', 'stop-wishing-tickets', 'stop-wishing-setup', 'stop-wishing-report']
export const MAIN_SKILL = 'stop-wishing'
export const SCRIPT_NAMES = ['check-env', 'init-docs', 'check-hardcode', 'check-licenses', 'preflight', 'check-tickets', 'setup']
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
    '用法: node install.js [--tool <dsh|claude|codex|trae>] [--dest <skills根目录>] [--verify] [--dry-run] [--force] [--target <base>]',
    '',
    '  安装 skills/ 下的全部八个技能：stop-wishing、stop-wishing-review、stop-wishing-audit、stop-wishing-debt、stop-wishing-spec、stop-wishing-tickets、stop-wishing-setup、stop-wishing-report。',
    '',
    '  --tool    按用户所用工具选 skills 根目录（推荐 AI 用这个）：',
    '              dsh / codex / trae -> ~/.agents/skills',
    '              claude             -> ~/.claude/skills',
    '  --dest    【skills 根目录】装成 <目录>/stop-wishing、<目录>/stop-wishing-review、<目录>/stop-wishing-audit、<目录>/stop-wishing-debt、<目录>/stop-wishing-spec、<目录>/stop-wishing-tickets',
    '              例: --dest <目录>  →  <目录>/stop-wishing/SKILL.md + 五个卫星技能目录',
    '  --verify  安装后自检：逐个技能校验 SKILL.md 存在、front-matter name 与目录名一致、与源 hash 一致；',
    '              主技能额外校验 scripts/ 7 个、5 个参考文件、templates/{zh,en} 各 8 份（7 份文档 + AGENTS.md.tpl）、LICENSE。',
    '              [PASS] 齐全且与源一致 / [WARN] 齐全但内容落后于源（退出码 4）/ [FAIL] 缺失或不一致（退出码 3）',
    '  --dry-run 只打印会复制什么、将校验什么，不写盘',
    '  --force   目标已存在时覆盖（默认拒绝）',
    '  --target  【兼容旧用法】只给 base 目录，八个技能装到 <base>/stop-wishing{,-review,-audit,-debt,-spec,-tickets,-setup,-report}',
    '',
    '不给 --tool/--dest/--target 时默认 ~/.agents/skills（等价 --tool dsh）。',
    '退出码: 0 成功或 dry-run / 1 参数或覆盖冲突 / 2 源文件缺失 / 3 自检失败（缺失或不一致） / 4 自检告警（内容落后于源）',
  ].join('\n')
}

function isInside(child, parent) {
  const target = resolve(child)
  const base = resolve(parent)
  return target === base || target.startsWith(base + sep)
}

function normalizeRelative(file) {
  return file.split(sep).join('/')
}

function readManifest(dest) {
  try {
    const parsed = JSON.parse(readFileSync(join(dest, MANIFEST), 'utf8'))
    return Array.isArray(parsed.files) ? parsed.files.map(normalizeRelative) : null
  } catch {
    return null
  }
}

function pruneEmptyDirs(dir, stop) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) pruneEmptyDirs(join(dir, entry.name), stop)
  }
  if (dir !== stop && readdirSync(dir).length === 0) rmdirSync(dir)
}

export function pruneStaleFiles(dest, currentFiles) {
  const previous = readManifest(dest)
  const current = new Set(currentFiles.map(normalizeRelative))
  const stale = new Set()
  if (previous) for (const file of previous) if (!current.has(file)) stale.add(file)
  for (const file of LEGACY_STALE) if (!current.has(file)) stale.add(file)
  const removed = []
  for (const file of stale) {
    const target = resolve(dest, file)
    if (!isInside(target, dest) || !existsSync(target)) continue
    rmSync(target, { force: true })
    removed.push(file)
  }
  if (removed.length > 0) pruneEmptyDirs(dest, dest)
  return removed
}

export function writeManifest(dest, files) {
  const list = files.map(normalizeRelative).filter(file => file !== MANIFEST).sort()
  writeFileSync(join(dest, MANIFEST), `${JSON.stringify({ version: VERSION, files: list }, null, 2)}\n`)
  return list
}

/** 解析目标 skills 根目录列表。home 可注入，便于测试不碰真实家目录。 */
export function resolveDestinations(options, home = homedir()) {
  if (options.dest) return [resolve(options.dest)]
  if (options.tool) {
    const parts = TOOL_TARGETS[options.tool]
    if (!parts) return { error: `未知 --tool: ${options.tool}（可选：${TOOL_ORDER.join(' | ')}）` }
    return [join(home, ...parts)]
  }
  const base = options.target ? resolve(options.target) : join(home, '.agents', 'skills')
  const destinations = [base]
  if (options.claude) destinations.push(join(home, '.claude', 'skills'))
  return destinations
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

/** 只读 front-matter 里的 name，避免把正文里的示例当成真的 name。 */
export function frontMatterName(text) {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text.replace(/^\uFEFF/, ''))
  if (!block) return null
  const line = /^name:\s*(.+?)\s*$/m.exec(block[1])
  return line ? line[1].replace(/^["']|["']$/g, '') : null
}

/** 自检：逐文件与源 hash 比对，输出 PASS / WARN（落后于源）/ FAIL（缺失或不一致）。 */
export function verifyInstall(dir, skillName = MAIN_SKILL, sourceRoot = ROOT) {
  const sourceDir = join(sourceRoot, 'skills', skillName)
  const groups = [
    { label: `SKILL.md exists and name: ${skillName}`, files: ['SKILL.md'], requireName: skillName },
  ]
  if (skillName === MAIN_SKILL) {
    groups.push({ label: 'scripts/ seven scripts present', files: SCRIPT_NAMES.map(name => `scripts/${name}.js`) })
    groups.push({ label: 'templates/zh/ eight files', files: [...TEMPLATE_NAMES.map(name => `templates/zh/${name}.md`), 'templates/zh/AGENTS.md.tpl'] })
    groups.push({ label: 'templates/en/ eight files', files: [...TEMPLATE_NAMES.map(name => `templates/en/${name}.md`), 'templates/en/AGENTS.md.tpl'] })
    groups.push({ label: 'assets/ glossary and translations', files: ['assets/vibe-coding-glossary.html', 'assets/en.json'] })
    groups.push({ label: 'references/ five files present', files: ['CARD.md', 'EVIDENCE.md', 'LICENSE.md', 'DECISIONS.md', 'GLOSSARY.md'] })
  }
  if (skillName === 'stop-wishing-report') {
    groups.push({
      label: 'report runtime and both themes present',
      files: [
        'render.js',
        'schema.json',
        'report.conf.example',
        'themes/simple/render.mjs',
        'themes/simple/style.css',
        'themes/simple/RENDER.md',
        'themes/hacker/render.mjs',
        'themes/hacker/style.css',
        'themes/hacker/RENDER.md',
        'examples/delivery.json',
      ],
    })
  }
  groups.push({ label: 'agents/openai.yaml present', files: ['agents/openai.yaml'] })
  groups.push({ label: 'license and third-party notices', files: NOTICE_FILES })

  const results = []
  for (const group of groups) {
    const missing = []
    const stale = []
    for (const file of group.files) {
      const target = join(dir, file)
      const source = NOTICE_FILES.includes(file) && !existsSync(join(sourceDir, file))
        ? join(sourceRoot, file)
        : join(sourceDir, file)
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
      const name = frontMatterName(readFileSync(join(dir, 'SKILL.md'), 'utf8'))
      if (name !== group.requireName) {
        status = 'FAIL'
        detail = `front-matter name 是 ${name ?? '缺失'}，应为 ${group.requireName}`
      }
    }
    results.push({ label: group.label, status, detail })
  }

  const hasFail = results.some(item => item.status === 'FAIL')
  const hasWarn = results.some(item => item.status === 'WARN')
  return { dir, skill: skillName, results, ok: !hasFail && !hasWarn, code: hasFail ? 3 : hasWarn ? 4 : 0 }
}

/** 收集一个技能目录下要复制的文件（相对路径），排除 .git/node_modules/test/临时文件。 */
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

/** 源文件完整性：八个技能的 SKILL.md 都必须存在。 */
export function missingSources() {
  return SKILL_NAMES.filter(name => !existsSync(join(SKILLS_ROOT, name, 'SKILL.md')))
}

export function install(options, home = homedir()) {
  const missing = missingSources()
  if (missing.length > 0) {
    return { ok: false, code: 2, message: '源文件缺失: ' + missing.map(name => join(SKILLS_ROOT, name, 'SKILL.md')).join(', ') }
  }
  if (options.unknown?.length) {
    return { ok: false, code: 1, message: '未知参数: ' + options.unknown.join(' ') + '\n\n' + usage() }
  }
  const destinations = resolveDestinations(options, home)
  if (!Array.isArray(destinations)) return { ok: false, code: 1, message: destinations.error + '\n\n' + usage() }
  for (const root of destinations) {
    if (isInside(root, ROOT)) {
      return { ok: false, code: 2, message: '目标目录不能位于源仓库内: ' + root }
    }
  }

  const files = SKILL_NAMES.flatMap(name => {
    const list = collectFiles(join(SKILLS_ROOT, name))
    for (const notice of NOTICE_FILES) if (!list.includes(notice)) list.push(notice)
    return list.map(file => `${name}/${file}`)
  })
  const plan = []
  for (const root of destinations) {
    const rootHasInstall = SKILL_NAMES.some(name => existsSync(join(root, name)))
    for (const skill of SKILL_NAMES) {
      const dest = join(root, skill)
      const exists = existsSync(dest)
      // --verify 且已经装过至少一个技能：只校验，不补装缺失的技能——否则「缺失」永远发现不了。
      const verifyOnly = options.verify && !options.force && rootHasInstall
      const action = verifyOnly
        ? '仅校验（已存在，未覆盖）'
        : !exists
          ? '创建'
          : options.force
            ? '覆盖'
            : '拒绝（已存在，加 --force）'
      plan.push({ root, skill, dest, exists, action })
    }
  }
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
      verifyPlan: '将逐个技能校验：SKILL.md 存在且 name 与目录名一致、与源 hash 一致；每个技能另查 LICENSE 与 THIRD-PARTY-NOTICES.md；主技能再加 scripts/ 7 个、5 个参考文件、templates/{zh,en} 各 8 份；不一致报 WARN 并退出 4',
    }
  }

  const conflict = plan.find(item => item.action.startsWith('拒绝'))
  if (conflict) {
    // 已存在时不只报「拒绝」：列出与源相比哪些文件缺失/落后，用户才知道该不该 --force。
    const sourceDir = join(SKILLS_ROOT, conflict.skill)
    const list = collectFiles(sourceDir)
    for (const notice of NOTICE_FILES) if (!list.includes(notice)) list.push(notice)
    const diffs = []
    for (const file of list) {
      const target = join(conflict.dest, file)
      const source = NOTICE_FILES.includes(file) && !existsSync(join(sourceDir, file))
        ? join(ROOT, file)
        : join(sourceDir, file)
      if (!existsSync(target)) diffs.push(`缺失 ${file}`)
      else if (existsSync(source) && sha256(target) !== sha256(source)) diffs.push(`落后 ${file}`)
    }
    const detail = diffs.length === 0
      ? '与源一致，无需更新；确要重装再加 --force'
      : `与源比较：${diffs.length} 个文件不同\n` + diffs.slice(0, 10).map(item => '  - ' + item).join('\n') + (diffs.length > 10 ? `\n  ... 其余 ${diffs.length - 10} 个` : '')
    return { ok: false, code: 1, message: `目标已存在且未加 --force: ${conflict.dest}\n${detail}`, plan, files, defaultHint }
  }

  for (const item of plan) {
    if (item.action.startsWith('仅校验')) continue
    const sourceDir = join(SKILLS_ROOT, item.skill)
    const skillFiles = collectFiles(sourceDir)
    skillFiles.push(...NOTICE_FILES.filter(file => !skillFiles.includes(file)))
    for (const file of skillFiles) {
      const from = NOTICE_FILES.includes(file) && !existsSync(join(sourceDir, file))
        ? join(ROOT, file)
        : join(sourceDir, file)
      const target = join(item.dest, file)
      mkdirSync(dirname(target), { recursive: true })
      copyFileSync(from, target)
    }
    if (item.action === '覆盖') pruneStaleFiles(item.dest, skillFiles)
    writeManifest(item.dest, skillFiles)
  }

  let verification = null
  if (options.verify) {
    verification = plan.map(item => verifyInstall(item.dest, item.skill))
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
    process.stdout.write(`自检目标: ${item.dir} (${item.skill})\n`)
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
      process.stdout.write(`版本: ${VERSION}（来自 VERSION）\n`)
      process.stderr.write((result.message ?? '安装失败') + '\n')
      process.exitCode = result.code
    } else {
      if (result.dryRun) process.stdout.write('[dry-run] 不会写盘\n')
      process.stdout.write(`源目录: ${result.root}\n`)
      process.stdout.write(`版本: ${VERSION}（来自 VERSION）\n`)
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
