// check-licenses.js 的独立测试：所有输入都用 mkdtemp 现造，不读仓库里的任何 node_modules / package-lock。
//
// 为什么全用临时目录：这个脚本的输入就是「别人项目的依赖树」，如果测试去读本仓库的文件，
// 那么仓库哪天加了依赖、改了 lockfile，测试就会莫名其妙地变红——测到的就不是脚本的行为了。
//
// 契约（SKILL.md §7 用途矩阵 + Lead 的 10 条修订）：
//   CLI: node check-licenses.js [--dir PATH] [--use self|free-closed|open-source|commercial]
//                                [--prod-only] [--strict] [--json] [--rows]
//   默认 dir=cwd、use=commercial；退出码 0 无禁止 / 1 有禁止 / 2 参数或 IO 错误。
//   状态: allowed | warn | forbidden | unknown（被跳过的不参与判定，计入 excluded）
//   导出: parseArgs, classifyLicense(expr,use), scanPackages(dir,{prodOnly}), checkLicenses({dir,use,prodOnly,strict})
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { closeSync, cpSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SCRIPT = join(ROOT, 'skills', 'stop-wishing', 'scripts', 'check-licenses.js')
const SCRIPT_URL = pathToFileURL(SCRIPT).href

// 状态词同时接受英文与中文：契约规定的是状态语义，没规定渲染成哪种文字；
// 只认一种写法会因为措辞差异把「实现对了」判成「测试挂了」。
// 输出可以是英文状态、中文状态或 §7 矩阵里的符号，三种都认。
// (?<!不) 前缀是必须的：表格里「不可用」含「可用」，不加前瞻会把禁止项读成放行项。
const ALLOWED = /allowed|允许|通过|✅|(?<!不)可用/i
const WARN = /warn|警告|注意|需确认|⚠/i
const FORBIDDEN = /forbidden|禁止|拒绝|❌|不可用/i
const UNKNOWN = /unknown|未知/i
const CHINESE = /[\u4e00-\u9fa5]/
const EXPLAIN = /用法|错误|找不到|没有|目录|缺少|缺失|无效|无法|支持/

/**
 * 脚本还没实现时，给一条说得清原因的失败，而不是让 `import` 抛一句 Cannot find module
 * 或者让 spawn 的非 0 退出码冒充「判定为禁止」。
 */
function requireScript() {
  assert.ok(
    existsSync(SCRIPT),
    `check-licenses.js 尚未实现（${SCRIPT} 不存在）。测试是按契约先写好的，脚本落地后再跑；当前失败属于预期。`,
  )
}

/** 直接 import 被测模块（用于测导出函数，不经过 CLI）。 */
async function loadScript() {
  requireScript()
  return import(SCRIPT_URL)
}

const PIPED_STDIO_BLOCKED = /EPERM|EACCES/i

/**
 * 跑一次脚本。正常环境直接用管道拿 stdout/stderr（这就是契约要求的调用方式）。
 * 少数受限沙箱（例如 DSH 的 workspace-write）禁止子进程使用管道 stdio，spawnSync 会返回 EPERM；
 * 这时把子进程的输出重定向到临时文件再读回来——命令、参数、cwd 完全不变，只是不经过管道。
 * 这段回退在正常环境下永远不会触发。
 */
function spawnScript(args, cwd) {
  const piped = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
  })
  if (!piped.error || !PIPED_STDIO_BLOCKED.test(String(piped.error.code ?? piped.error.message))) {
    return { status: piped.status, stdout: piped.stdout ?? '', stderr: piped.stderr ?? '', error: piped.error }
  }
  return spawnScriptWithFiles(args, cwd)
}

function spawnScriptWithFiles(args, cwd) {
  const ioDir = mkdtempSync(join(tmpdir(), 'sw-license-io-'))
  const outPath = join(ioDir, 'stdout.txt')
  const errPath = join(ioDir, 'stderr.txt')
  const outFd = openSync(outPath, 'w')
  const errFd = openSync(errPath, 'w')
  let child
  try {
    child = spawnSync(process.execPath, [SCRIPT, ...args], {
      cwd,
      windowsHide: true,
      timeout: 60000,
      stdio: ['ignore', outFd, errFd],
    })
  } finally {
    closeSync(outFd)
    closeSync(errFd)
  }
  try {
    return {
      status: child.status,
      stdout: readFileSync(outPath, 'utf8'),
      stderr: readFileSync(errPath, 'utf8'),
      error: child.error,
    }
  } finally {
    rmSync(ioDir, { recursive: true, force: true })
  }
}

/** 用 spawnSync 跑 CLI——和用户真正敲命令的路径一致。 */
function run(args, { cwd = ROOT } = {}) {
  requireScript()
  const out = spawnScript(args, cwd)
  assert.equal(out.error, undefined, `spawn 失败：${out.error?.message ?? out.error}`)
  const stdout = out.stdout ?? ''
  const stderr = out.stderr ?? ''
  const all = `${stdout}\n${stderr}`
  // 脚本不存在时 node 自己也会以 1 退出；绝不能让它冒充「有禁止项」。
  assert.doesNotMatch(all, /Cannot find module|ERR_MODULE_NOT_FOUND/, `脚本没能加载：\n${all}`)
  return { status: out.status, stdout, stderr, all }
}

function assertExit(out, expected) {
  assert.equal(
    out.status,
    expected,
    `退出码应为 ${expected}，实际 ${out.status}\n--- stdout ---\n${out.stdout}\n--- stderr ---\n${out.stderr}`,
  )
}

function lines(text) {
  return String(text)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
}

/** 取出提到某个包的那些行，用来把「状态」绑到具体的包上，而不是只看汇总里出现过某个词。 */
function scopeOf(text, name) {
  return lines(text)
    .filter(line => line.includes(name))
    .join('\n')
}

function assertPackageStatus(text, name, pattern, label) {
  const scope = scopeOf(text, name)
  assert.notEqual(scope, '', `${label}：输出里没有提到 ${name}\n--- 实际输出 ---\n${text}`)
  assert.match(scope, pattern, `${label}：${name} 那一行没有出现期望的状态\n--- ${name} 那一行 ---\n${scope}`)
}

/**
 * 默认文本输出只逐条列「禁止 / 需确认 / 未知」，放行的包只在汇总里计数（「可用 N 个」）。
 * 因此「某个包是 allowed」这类断言走 --json：逐包一条记录，语义不依赖排版。
 */
function assertJsonStatus(dir, name, expected, label, extraArgs = []) {
  const out = run(['--dir', dir, '--json', ...extraArgs])
  const report = parseJson(out)
  const item = findPackage(report, name)
  assert.ok(item, `${label}：JSON 的 packages 里没有 ${name}：${JSON.stringify(report.packages)}`)
  assert.equal(
    normalize(item.status),
    expected,
    `${label}：${name} 的状态应为 ${expected}，实际 ${normalize(item.status)}（${JSON.stringify(item)}）`,
  )
  return { out, report }
}

/** scanPackages 的返回形状契约里没写死：数组，或 { packages, excluded, source } 都接受。 */
function scanList(result) {
  if (Array.isArray(result)) return result
  if (Array.isArray(result?.packages)) return result.packages
  assert.fail(`scanPackages 的返回值既不是数组也没有 packages 数组：${JSON.stringify(result)}`)
}

/** classifyLicense 的返回形状契约里没写死（字符串或带 status 的对象），因此两者都接受。 */
function normalize(raw) {
  const value = String(raw).trim().toLowerCase()
  if (['allowed', 'ok', 'permit', '允许', '通过'].includes(value)) return 'allowed'
  if (['warn', 'warning', '警告', '注意'].includes(value)) return 'warn'
  if (['forbidden', 'denied', 'deny', '禁止', '拒绝'].includes(value)) return 'forbidden'
  if (['unknown', '未知'].includes(value)) return 'unknown'
  if (['excluded', 'skip', 'skipped', '跳过'].includes(value)) return 'excluded'
  return value
}

function statusOf(result) {
  if (typeof result === 'string') return normalize(result)
  if (result && typeof result === 'object') {
    for (const key of ['status', 'state', 'verdict', 'result']) {
      if (typeof result[key] === 'string') return normalize(result[key])
    }
  }
  assert.fail(`classifyLicense 的返回值里找不到状态字段：${JSON.stringify(result)}`)
}

// ---------------------------------------------------------------- 夹具构造

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'sw-license-'))
}

function writeJson(dir, segments, value) {
  const full = join(dir, ...segments)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

/**
 * 由测试包描述生成 package.json 内容。
 *   license: null  -> 故意不写 license 字段（对应「无 license → unknown」）
 *   licenses: [...] -> 旧式数组（对应 Lead 修订 1：按 OR 处理）
 *   repository      -> 对应 --rows 的 Source URL 列
 */
function manifest(pkg) {
  const record = { name: pkg.name, version: pkg.version ?? '1.0.0' }
  if (Array.isArray(pkg.licenses)) record.licenses = pkg.licenses
  else if (pkg.license === null) {
    // 故意留空：这是「没有 license 字段」的夹具。
  } else record.license = pkg.license ?? 'MIT'
  if (pkg.repository !== undefined) record.repository = pkg.repository
  if (pkg.dev) record.dev = true
  return record
}

/** 造 <dir>/node_modules/<name>/package.json。 */
function nmDir(packages) {
  const dir = tempDir()
  for (const pkg of packages) {
    writeJson(dir, ['node_modules', ...String(pkg.name).split('/'), 'package.json'], manifest(pkg))
  }
  return dir
}

/** 造项目自身的 <dir>/package.json（open-source 模式判定依赖是否比项目更严时要用）。 */
function withProject(dir, project) {
  writeJson(dir, ['package.json'], manifest(project))
  return dir
}

/**
 * 只造 package-lock.json（node_modules 可另行创建）。
 * extraEntries 用来注入 root ""、link:true、file: 这类需要被跳过的条目。
 */
function lockDir(packages, { lockfileVersion = 3, extraEntries = {} } = {}) {
  const dir = tempDir()
  const entries = { '': { name: 'fixture', version: '1.0.0' } }
  for (const pkg of packages) {
    const record = { version: pkg.version ?? '1.0.0' }
    if (Array.isArray(pkg.licenses)) record.licenses = pkg.licenses
    else if (pkg.license !== null && pkg.license !== undefined) record.license = pkg.license
    if (pkg.dev) record.dev = true
    entries[`node_modules/${pkg.name}`] = record
  }
  Object.assign(entries, extraEntries)
  writeJson(dir, ['package-lock.json'], {
    name: 'fixture',
    version: '1.0.0',
    lockfileVersion,
    requires: true,
    packages: entries,
  })
  return dir
}

/** --json 必须是一段纯 JSON：前面混人类可读的提示就没法给机器用。 */
function parseJson(out) {
  try {
    return JSON.parse(out.stdout)
  } catch (error) {
    assert.fail(`--json 输出不是合法 JSON（${error.message}）\n--- stdout ---\n${out.stdout}\n--- stderr ---\n${out.stderr}`)
  }
}

/** 包记录里的 name 可能是裸名，也可能是 name@version；两种都认。 */
function findPackage(report, name) {
  const list = Array.isArray(report?.packages) ? report.packages : []
  const byName = list.find(item => {
    const raw = String(item?.name ?? item?.id ?? '')
    return raw === name || raw.startsWith(`${name}@`)
  })
  return byName ?? list.find(item => JSON.stringify(item).includes(name))
}

function hasPackage(list, name) {
  return list.some(item => {
    const raw = String(item?.name ?? item?.id ?? '')
    return raw === name || raw.startsWith(`${name}@`) || JSON.stringify(item).includes(name)
  })
}

/**
 * 被跳过的条目数：实现可以把它们放在 counts.excluded，也可以放一个 excluded 数组。
 * 两种形状都是「计入 excluded」，这只是取值方式不同。
 */
function excludedCount(report) {
  if (typeof report?.counts?.excluded === 'number') return report.counts.excluded
  if (Array.isArray(report?.excluded)) return report.excluded.length
  return null
}

/**
 * counts 必须能把每个包算清楚、且只算一次。
 * 允许两种账法：judged === packages 条数（excluded 单独算），
 * 或 judged + excluded === packages 条数（excluded 也列在 packages 里）。
 */
function assertCounts(report) {
  const counts = report?.counts
  assert.equal(
    Boolean(counts) && typeof counts === 'object' && !Array.isArray(counts),
    true,
    `counts 应为对象：${JSON.stringify(counts)}`,
  )
  for (const key of ['allowed', 'warn', 'forbidden', 'unknown']) {
    assert.equal(typeof counts[key], 'number', `counts.${key} 应为数字：${JSON.stringify(counts)}`)
  }
  const judged = counts.allowed + counts.warn + counts.forbidden + counts.unknown
  const excluded = excludedCount(report) ?? 0
  const total = Array.isArray(report.packages) ? report.packages.length : 0
  assert.ok(
    judged === total || judged + excluded === total,
    `counts 对不上 packages：allowed+warn+forbidden+unknown=${judged}, excluded=${excluded}, packages=${total}\n${JSON.stringify(counts)}`,
  )
}

// ---------------------------------------------------------------- 参数解析

test('parseArgs：默认 use=commercial、dir=cwd、四个开关为假', async () => {
  const { parseArgs } = await loadScript()
  const options = parseArgs([])
  assert.equal(options.use, 'commercial', '契约默认 use=commercial')
  // 契约说「默认 dir=cwd」，实现可以在解析时取 cwd，也可以留空到运行期再取。
  assert.ok(
    options.dir === null || options.dir === undefined || resolve(options.dir) === process.cwd(),
    `dir 默认值应等价于 cwd，实际：${JSON.stringify(options.dir)}`,
  )
  assert.equal(Boolean(options.prodOnly), false)
  assert.equal(Boolean(options.strict), false)
  assert.equal(Boolean(options.json), false)
  assert.equal(Boolean(options.rows), false)
})

test('parseArgs：识别 --dir / --use / --prod-only / --strict / --json / --rows', async () => {
  const { parseArgs } = await loadScript()
  const options = parseArgs(['--dir', '/tmp/somewhere', '--use', 'self', '--prod-only', '--strict', '--json', '--rows'])
  assert.equal(options.dir, '/tmp/somewhere')
  assert.equal(options.use, 'self')
  assert.equal(options.prodOnly, true)
  assert.equal(options.strict, true)
  assert.equal(options.json, true)
  assert.equal(options.rows, true)
})

// ---------------------------------------------------------------- classifyLicense：基础矩阵

test('classifyLicense：MIT × commercial → allowed', async () => {
  const { classifyLicense } = await loadScript()
  assert.equal(statusOf(classifyLicense('MIT', 'commercial')), 'allowed')
})

test('classifyLicense：GPL-3.0 × commercial → forbidden，× self → allowed', async () => {
  const { classifyLicense } = await loadScript()
  assert.equal(statusOf(classifyLicense('GPL-3.0', 'commercial')), 'forbidden', 'GPL 对商业闭源是传染的')
  assert.equal(statusOf(classifyLicense('GPL-3.0', 'self')), 'allowed', '自用不涉及分发，矩阵里是 ✅')
  assert.equal(statusOf(classifyLicense('GPL-3.0', 'free-closed')), 'forbidden', '免费闭源分发仍是闭源')
})

test('classifyLicense：AGPL-3.0 × free-closed → forbidden，× self → allowed', async () => {
  const { classifyLicense } = await loadScript()
  assert.equal(statusOf(classifyLicense('AGPL-3.0', 'free-closed')), 'forbidden', 'AGPL 的网络条款同样传染')
  assert.equal(statusOf(classifyLicense('AGPL-3.0', 'self')), 'allowed')
})

test('classifyLicense：MIT OR GPL-3.0 × commercial → allowed（可选宽松分支）', async () => {
  const { classifyLicense } = await loadScript()
  assert.equal(statusOf(classifyLicense('MIT OR GPL-3.0', 'commercial')), 'allowed', 'OR 里有一条能走就该放行')
})

test('classifyLicense：GPL-3.0 AND MIT × commercial → forbidden', async () => {
  const { classifyLicense } = await loadScript()
  assert.equal(statusOf(classifyLicense('GPL-3.0 AND MIT', 'commercial')), 'forbidden', 'AND 是叠加义务，GPL 分支传染')
})

test('classifyLicense：空表达式 → unknown（不猜成 MIT）', async () => {
  const { classifyLicense } = await loadScript()
  assert.equal(statusOf(classifyLicense('', 'commercial')), 'unknown')
  assert.equal(statusOf(classifyLicense('   ', 'commercial')), 'unknown')
})

// ---------------------------------------------------------------- classifyLicense：矩阵新增项

test('classifyLicense：MPL-2.0 × commercial → warn（不是 forbidden）', async () => {
  const { classifyLicense } = await loadScript()
  assert.equal(statusOf(classifyLicense('MPL-2.0', 'commercial')), 'warn', 'MPL 是文件级传染，商业闭源下是警告')
})

test('classifyLicense：SSPL-1.0 × commercial → forbidden', async () => {
  const { classifyLicense } = await loadScript()
  assert.equal(statusOf(classifyLicense('SSPL-1.0', 'commercial')), 'forbidden')
})

test('classifyLicense：CC-BY-NC-4.0 × commercial → forbidden', async () => {
  const { classifyLicense } = await loadScript()
  assert.equal(statusOf(classifyLicense('CC-BY-NC-4.0', 'commercial')), 'forbidden', 'NC 明确排除商业使用')
})

// ---------------------------------------------------------------- classifyLicense：WITH 例外

test('classifyLicense：GPL-2.0 WITH Classpath-exception-2.0 × commercial → warn', async () => {
  const { classifyLicense } = await loadScript()
  const status = statusOf(classifyLicense('GPL-2.0 WITH Classpath-exception-2.0', 'commercial'))
  assert.equal(status, 'warn', 'Classpath 例外放宽了链接义务，商业下是警告而不是禁止')
})

test('classifyLicense：未知 WITH 例外 → unknown（不当作已知例外放行）', async () => {
  const { classifyLicense } = await loadScript()
  assert.equal(statusOf(classifyLicense('GPL-2.0 WITH No-Such-Exception-9.9', 'commercial')), 'unknown')
})

// ---------------------------------------------------------------- classifyLicense：SPDX 归一

test('classifyLicense：Apache 2.0（空格写法）× commercial → allowed', async () => {
  const { classifyLicense } = await loadScript()
  assert.equal(statusOf(classifyLicense('Apache 2.0', 'commercial')), 'allowed', '写法不规范也要归一到 Apache-2.0')
})

test('classifyLicense：GPL-2.0+ / GPL-3.0-or-later × commercial → forbidden', async () => {
  const { classifyLicense } = await loadScript()
  assert.equal(statusOf(classifyLicense('GPL-2.0+', 'commercial')), 'forbidden', '+ 只是「或更高版本」，仍属 GPL')
  assert.equal(statusOf(classifyLicense('GPL-3.0-or-later', 'commercial')), 'forbidden')
})

test('classifyLicense：大小写混写归一到同一结论', async () => {
  const { classifyLicense } = await loadScript()
  assert.equal(statusOf(classifyLicense('mit', 'commercial')), 'allowed')
  assert.equal(statusOf(classifyLicense('gPl-3.0', 'commercial')), 'forbidden')
})

test('classifyLicense：括号不配 → unknown（不猜）', async () => {
  const { classifyLicense } = await loadScript()
  assert.equal(statusOf(classifyLicense('(MIT OR GPL-3.0', 'commercial')), 'unknown')
})

// ---------------------------------------------------------------- classifyLicense：UNLICENSED / SEE LICENSE IN

test('classifyLicense：UNLICENSED × self → allowed 或 warn；× commercial → forbidden', async () => {
  const { classifyLicense } = await loadScript()
  const self = statusOf(classifyLicense('UNLICENSED', 'self'))
  assert.ok(['allowed', 'warn'].includes(self), `自用下 UNLICENSED 可放行（或警告），实际 ${self}`)
  assert.equal(statusOf(classifyLicense('UNLICENSED', 'commercial')), 'forbidden', 'UNLICENSED 是明确的「不许用」')
})

test('classifyLicense：SEE LICENSE IN LICENSE → unknown', async () => {
  const { classifyLicense } = await loadScript()
  assert.equal(statusOf(classifyLicense('SEE LICENSE IN LICENSE', 'commercial')), 'unknown', '指向文件就得人去读，脚本不许猜')
})

// ---------------------------------------------------------------- scanPackages

test('scanPackages：读 node_modules 下每个包的 package.json', async () => {
  const { scanPackages } = await loadScript()
  const dir = nmDir([
    { name: 'mit-one', license: 'MIT' },
    { name: 'gpl-three', license: 'GPL-3.0' },
  ])
  const found = scanList(scanPackages(dir, {}))
  assert.ok(hasPackage(found, 'mit-one'), '应扫到 mit-one')
  assert.ok(hasPackage(found, 'gpl-three'), '应扫到 gpl-three')
  const gpl = found.find(item => JSON.stringify(item).includes('gpl-three'))
  assert.match(JSON.stringify(gpl), /GPL-3\.0/, '扫出来的记录里应带上原始 SPDX 表达式')
})

test('scanPackages：没有 node_modules 时从 package-lock.json 读', async () => {
  const { scanPackages } = await loadScript()
  const dir = lockDir([
    { name: 'mit-one', license: 'MIT' },
    { name: 'gpl-three', license: 'GPL-3.0' },
  ])
  const found = scanList(scanPackages(dir, {}))
  assert.ok(hasPackage(found, 'mit-one'), 'lockfile 里的 mit-one 应被读到')
  assert.ok(hasPackage(found, 'gpl-three'), 'lockfile 里的 gpl-three 应被读到')
  const gpl = found.find(item => JSON.stringify(item).includes('gpl-three'))
  assert.match(JSON.stringify(gpl), /GPL-3\.0/, 'lockfile 里的 license 字段应被读到')
})

test('scanPackages：node_modules 与 lock 同时存在时仍会读 lock（lock 优先）', async () => {
  const { scanPackages } = await loadScript()
  const locked = lockDir([{ name: 'only-in-lock', license: 'GPL-3.0' }])
  // 两个输入同时存在：只读 node_modules 的实现会漏掉 lock 里这一条。
  const nmSource = nmDir([{ name: 'node-modules-pkg', license: 'MIT' }])
  cpSync(join(nmSource, 'node_modules'), join(locked, 'node_modules'), { recursive: true })

  const found = scanList(scanPackages(locked, {}))
  assert.ok(hasPackage(found, 'only-in-lock'), 'lock 优先：有 node_modules 时也要读 lock 里的依赖')
})

// ---------------------------------------------------------------- CLI：放行

test('CLI：MIT 包在 commercial 下 exit 0', () => {
  const dir = nmDir([{ name: 'mit-one', license: 'MIT' }])
  const out = run(['--dir', dir])
  assertExit(out, 0)
  assert.match(out.all, CHINESE, '输出应是中文（仓库既有脚本的约定）')
  assert.match(out.all, /可用\s*1\s*个/, `汇总应说明有 1 个包可用：\n${out.all}`)
  assertJsonStatus(dir, 'mit-one', 'allowed', 'MIT 在商业闭源下应 allowed')
})

test('CLI：不给 --dir 时按 cwd 扫描（契约默认 dir=cwd）', () => {
  const dir = nmDir([{ name: 'mit-one', license: 'MIT' }])
  const out = run(['--json'], { cwd: dir })
  assertExit(out, 0)
  const report = parseJson(out)
  const item = findPackage(report, 'mit-one')
  assert.ok(item, `默认 cwd 应被当成扫描目录：${JSON.stringify(report.packages)}`)
  assert.equal(normalize(item.status), 'allowed')
})

// ---------------------------------------------------------------- CLI：禁止

test('CLI：GPL-3.0 在 commercial 下 exit 1，同一目录 self 下 exit 0', () => {
  const dir = nmDir([{ name: 'gpl-three', license: 'GPL-3.0' }])

  const commercial = run(['--dir', dir, '--use', 'commercial'])
  assertExit(commercial, 1)
  assert.match(commercial.all, CHINESE)
  assertPackageStatus(commercial.all, 'gpl-three', FORBIDDEN, 'GPL-3.0 在商业闭源下应 forbidden')

  const self = run(['--dir', dir, '--use', 'self'])
  assertExit(self, 0)
  assertJsonStatus(dir, 'gpl-three', 'allowed', '同一棵树在自用下应放行', ['--use', 'self'])
})

test('CLI：AGPL-3.0 在 free-closed 下 exit 1', () => {
  const dir = nmDir([{ name: 'agpl-net', license: 'AGPL-3.0' }])
  const out = run(['--dir', dir, '--use', 'free-closed'])
  assertExit(out, 1)
  assert.match(out.all, CHINESE)
  assertPackageStatus(out.all, 'agpl-net', FORBIDDEN, 'AGPL-3.0 在免费闭源分发下应 forbidden')
})

test('CLI：GPL-3.0 AND MIT 在 commercial 下 exit 1', () => {
  const dir = nmDir([{ name: 'forced-and', license: 'GPL-3.0 AND MIT' }])
  const out = run(['--dir', dir, '--use', 'commercial'])
  assertExit(out, 1)
  assertPackageStatus(out.all, 'forced-and', FORBIDDEN, 'AND 里含 GPL 分支，整体应 forbidden')
})

test('CLI：UNLICENSED 在 commercial 下 exit 1', () => {
  const dir = nmDir([{ name: 'unlicensed-pkg', license: 'UNLICENSED' }])
  const out = run(['--dir', dir, '--use', 'commercial'])
  assertExit(out, 1)
  assertPackageStatus(out.all, 'unlicensed-pkg', FORBIDDEN, 'UNLICENSED 商业闭源下应拒绝')
})

test('CLI：UNLICENSED 在 self 下 exit 0', () => {
  const dir = nmDir([{ name: 'unlicensed-pkg', license: 'UNLICENSED' }])
  const out = run(['--dir', dir, '--use', 'self'])
  assertExit(out, 0)
})

// ---------------------------------------------------------------- CLI：宽松分支

test('CLI：MIT OR GPL-3.0 在 commercial 下 exit 0', () => {
  const dir = nmDir([{ name: 'dual-or', license: 'MIT OR GPL-3.0' }])
  const out = run(['--dir', dir, '--use', 'commercial'])
  assertExit(out, 0)
  assertJsonStatus(dir, 'dual-or', 'allowed', '有 MIT 可选，应走宽松分支', ['--use', 'commercial'])
})

// ---------------------------------------------------------------- CLI：旧式 licenses 数组按 OR

test('CLI：旧式 licenses:[{type}] 数组按 OR 处理（两种顺序都放行）', () => {
  // 先 MIT 后 GPL：OR 放行。只取第一个元素的实现也能蒙对，所以下面再来一个反序夹具。
  const mitFirst = nmDir([{ name: 'legacy-a', licenses: [{ type: 'MIT' }, { type: 'GPL-3.0' }] }])
  assertExit(run(['--dir', mitFirst, '--use', 'commercial']), 0)
  assertJsonStatus(mitFirst, 'legacy-a', 'allowed', '旧式数组是 OR，有 MIT 分支就该放行', ['--use', 'commercial'])

  // 先 GPL 后 MIT：如果被当成 AND（或只取第一个），这里会 exit 1。
  const gplFirst = nmDir([{ name: 'legacy-b', licenses: [{ type: 'GPL-3.0' }, { type: 'MIT' }] }])
  assertExit(run(['--dir', gplFirst, '--use', 'commercial']), 0)
  assertJsonStatus(gplFirst, 'legacy-b', 'allowed', '旧式数组元素顺序不该改变结论', ['--use', 'commercial'])
})

// ---------------------------------------------------------------- CLI：warn 不算失败

test('CLI：MPL-2.0 在 commercial 下 warn 且 exit 0', () => {
  const dir = nmDir([{ name: 'mpl-pkg', license: 'MPL-2.0' }])
  const out = run(['--dir', dir, '--json'])
  assertExit(out, 0)
  const report = parseJson(out)
  assert.equal(report.ok, true, 'warn 是警告，ok 仍为 true')
  assert.equal(report.counts.forbidden, 0)
  assert.equal(report.counts.warn, 1, 'MPL-2.0 应计入 warn')
  const item = findPackage(report, 'mpl-pkg')
  assert.ok(item, `JSON 里应有 mpl-pkg：${JSON.stringify(report.packages)}`)
  assert.equal(normalize(item.status), 'warn')
})

test('CLI：GPL-2.0 WITH Classpath-exception-2.0 在 commercial 下 warn 且 exit 0', () => {
  const dir = nmDir([{ name: 'classpath-pkg', license: 'GPL-2.0 WITH Classpath-exception-2.0' }])
  const out = run(['--dir', dir, '--json'])
  assertExit(out, 0)
  const report = parseJson(out)
  assert.equal(report.counts.forbidden, 0, '已知例外不该判成 forbidden')
  assert.equal(report.counts.warn, 1)
  assert.equal(normalize(findPackage(report, 'classpath-pkg').status), 'warn')
})

test('CLI：SPDX 写法不规范时仍按归一后的结论判定', () => {
  const dir = nmDir([
    { name: 'apache-space', license: 'Apache 2.0' },
    { name: 'gpl-plus', license: 'GPL-2.0+' },
  ])
  const out = run(['--dir', dir, '--json'])
  assertExit(out, 1)
  const report = parseJson(out)
  assert.equal(normalize(findPackage(report, 'apache-space').status), 'allowed', 'Apache 2.0 应归一到 Apache-2.0')
  assert.equal(normalize(findPackage(report, 'gpl-plus').status), 'forbidden', 'GPL-2.0+ 仍是 GPL')
})

// ---------------------------------------------------------------- 无 license

test('CLI：无 license 字段 → unknown 且 exit 0', () => {
  const dir = nmDir([{ name: 'no-license-pkg', license: null }])
  const out = run(['--dir', dir])
  assertExit(out, 0)
  // 状态走 --json：文本模式把包列在「未知 N 个」分组下，行内不一定重复状态词。
  assertJsonStatus(dir, 'no-license-pkg', 'unknown', '缺 license 字段应判 unknown，不猜成 MIT')
})

test('CLI：无 license 字段 + --strict → exit 1（状态仍是 unknown）', () => {
  const dir = nmDir([{ name: 'no-license-pkg', license: null }])
  const out = run(['--dir', dir, '--strict'])
  assertExit(out, 1)
  const { report } = assertJsonStatus(
    dir,
    'no-license-pkg',
    'unknown',
    '--strict 只升级退出码，不该把 unknown 改写成 forbidden',
    ['--strict'],
  )
  assert.equal(report.ok, false, '--strict 下 unknown 应让 ok 变 false')
})

test('CLI：SEE LICENSE IN LICENSE → unknown 且 exit 0', () => {
  const dir = nmDir([{ name: 'see-license-pkg', license: 'SEE LICENSE IN LICENSE' }])
  const out = run(['--dir', dir])
  assertExit(out, 0)
  assertJsonStatus(dir, 'see-license-pkg', 'unknown', '指向许可证文件时应交给人读')
})

// ---------------------------------------------------------------- package-lock 回退 / 优先

test('CLI：只有 package-lock.json（无 node_modules）也能判定', () => {
  const dir = lockDir([
    { name: 'mit-one', license: 'MIT' },
    { name: 'gpl-three', license: 'GPL-3.0' },
  ])
  const out = run(['--dir', dir])
  assertExit(out, 1)
  assertPackageStatus(out.all, 'gpl-three', FORBIDDEN, 'lockfile 里的 GPL 依赖应 forbidden')
  assertJsonStatus(dir, 'mit-one', 'allowed', 'lockfile 里的 MIT 依赖应 allowed')
})

test('CLI：传递依赖只在 lock 里出现（node_modules 没有）→ 仍 forbidden', () => {
  const nmSource = nmDir([{ name: 'mit-one', license: 'MIT' }])
  const locked = lockDir([
    { name: 'mit-one', license: 'MIT' },
    { name: 'gpl-transitive', license: 'GPL-3.0' },
  ])
  cpSync(join(nmSource, 'node_modules'), join(locked, 'node_modules'), { recursive: true })

  const out = run(['--dir', locked, '--json'])
  assertExit(out, 1)
  const report = parseJson(out)
  const transitive = findPackage(report, 'gpl-transitive')
  assert.ok(transitive, `lock 里的传递依赖必须被算进来：${JSON.stringify(report.packages)}`)
  assert.equal(normalize(transitive.status), 'forbidden')
})

test('CLI：空 node_modules + 有效 lock → 用 lock，不报错', () => {
  const dir = lockDir([{ name: 'mit-one', license: 'MIT' }])
  mkdirSync(join(dir, 'node_modules'), { recursive: true })
  const out = run(['--dir', dir, '--json'])
  assertExit(out, 0)
  const report = parseJson(out)
  assert.equal(report.source, 'package-lock.json', `应按 lock 扫描而不是报错：${JSON.stringify(report.source)}`)
  const item = findPackage(report, 'mit-one')
  assert.ok(item, 'lock 里的依赖应被读到')
  assert.equal(normalize(item.status), 'allowed')
})

// ---------------------------------------------------------------- 跳过的条目

test('CLI：lock 根条目 ""、link:true、file: 本地包都跳过并计入 excluded', () => {
  const dir = lockDir([{ name: 'mit-one', license: 'MIT' }], {
    extraEntries: {
      // link:true 的工作区链接，没有 license——被判定的话会变 unknown
      'node_modules/link-pkg': { link: true, resolved: '../link-pkg' },
      // file: 本地包，带 GPL——被判定的话会直接 forbidden
      'node_modules/file-local-pkg': { version: '1.0.0', resolved: 'file:../file-local-pkg', license: 'GPL-3.0' },
    },
  })

  const out = run(['--dir', dir, '--json'])
  assertExit(out, 0)
  const report = parseJson(out)
  assert.equal(report.counts.forbidden, 0, 'file: 本地包不该参与判定')
  assert.ok((excludedCount(report) ?? 0) >= 2, `跳过项应计入 excluded：${JSON.stringify(report.counts)}`)
  const fileLocal = findPackage(report, 'file-local-pkg')
  if (fileLocal) assert.equal(normalize(fileLocal.status), 'excluded', 'file: 包若列出，状态只能是 excluded')
  const linkPkg = findPackage(report, 'link-pkg')
  if (linkPkg) assert.equal(normalize(linkPkg.status), 'excluded', 'link: 包若列出，状态只能是 excluded')

  // 根条目 "" 没有 license；如果被当普通包判定就是 unknown，--strict 会把退出码抬到 1。
  const strict = run(['--dir', dir, '--strict', '--json'])
  assertExit(strict, 0)
  assert.equal(parseJson(strict).counts.unknown, 0, '根条目 "" 不该被算成 unknown')
})

// ---------------------------------------------------------------- 输入缺失 / 参数错误 → 2

test('CLI：空目录（无 node_modules 也无 package-lock）→ exit 2', () => {
  const dir = tempDir()
  const out = run(['--dir', dir])
  assertExit(out, 2)
  assert.match(out.all, CHINESE, '退出码 2 应给出中文原因')
  assert.match(out.all, EXPLAIN, `退出码 2 应说清缺什么，而不是只抛栈：\n${out.all}`)
})

test('CLI：只有 package.json、两种输入都没有 → exit 2', () => {
  const dir = tempDir()
  withProject(dir, { name: 'fixture' })
  const out = run(['--dir', dir])
  assertExit(out, 2)
  assert.match(out.all, EXPLAIN, `应说明缺少 node_modules / package-lock.json：\n${out.all}`)
})

test('CLI：--use 取值非法 → exit 2（参数错误）', () => {
  const dir = nmDir([{ name: 'mit-one', license: 'MIT' }])
  const out = run(['--dir', dir, '--use', 'bogus'])
  assertExit(out, 2)
  assert.match(out.all, CHINESE)
})

// ---------------------------------------------------------------- --json

test('CLI：--json 可 JSON.parse，含 ok/counts/packages 且按包给出状态', () => {
  const dir = nmDir([
    { name: 'mit-one', license: 'MIT' },
    { name: 'gpl-three', license: 'GPL-3.0' },
  ])
  const out = run(['--dir', dir, '--json'])
  assertExit(out, 1)
  const report = parseJson(out)
  assert.equal(typeof report.ok, 'boolean', `ok 应是布尔：${JSON.stringify(report.ok)}`)
  assert.equal(report.ok, false, '有禁止项时 ok 必须为 false')
  assert.ok(Array.isArray(report.packages), 'packages 应是数组')
  assert.equal(report.packages.length, 2)
  assertCounts(report)

  const gpl = findPackage(report, 'gpl-three')
  assert.ok(gpl, `JSON 里应有 gpl-three：${JSON.stringify(report.packages)}`)
  assert.equal(normalize(gpl.status), 'forbidden')
  assert.match(JSON.stringify(gpl), /GPL-3\.0/, 'JSON 记录应带上原始 SPDX 表达式')

  const mit = findPackage(report, 'mit-one')
  assert.ok(mit, `JSON 里应有 mit-one：${JSON.stringify(report.packages)}`)
  assert.equal(normalize(mit.status), 'allowed')
})

test('CLI：--json 全放行时 ok=true 且计数分布正确', () => {
  const dir = nmDir([{ name: 'mit-one', license: 'MIT' }])
  const out = run(['--dir', dir, '--json'])
  assertExit(out, 0)
  const report = parseJson(out)
  assert.equal(report.ok, true)
  assertCounts(report)
  assert.equal(report.counts.allowed, 1)
  assert.equal(report.counts.warn, 0)
  assert.equal(report.counts.forbidden, 0)
  assert.equal(report.counts.unknown, 0)
})

// ---------------------------------------------------------------- --rows

test('CLI：--rows 是 5 列表格，表头匹配，每个包一行', () => {
  const dir = nmDir([
    { name: 'mit-one', license: 'MIT', repository: { type: 'git', url: 'git+https://example.com/repo.git' } },
    { name: 'no-repo-pkg', license: 'Apache-2.0' },
    { name: 'gpl-three', license: 'GPL-3.0' },
  ])
  const out = run(['--dir', dir, '--rows'])
  assertExit(out, 1)

  const rows = lines(out.stdout)
  assert.ok(rows.length >= 4, `--rows 至少要有表头 + 3 行数据，实际 ${rows.length} 行：\n${out.stdout}`)

  const header = rows[0]
  assert.doesNotMatch(header, /mit-one|no-repo-pkg|gpl-three/, `第一行应是表头而不是数据行：${header}`)
  const columns = {
    Name: /name|名称|包名/i,
    Version: /version|版本/i,
    License: /license|许可证/i,
    'Commercial usability': /commercial|usability|商用|商业可用|商业/i,
    'Source URL': /source\s*url|source|url|来源|仓库|网址/i,
  }
  for (const [column, pattern] of Object.entries(columns)) {
    assert.match(header, pattern, `表头缺少「${column}」这一列：${header}`)
  }

  // 有 repository 的包：URL 列应给出地址
  assert.match(scopeOf(out.stdout, 'mit-one'), /example\.com/, '有 repository 时应输出地址')
  // 没有 repository 的包：URL 列约定写 not declared
  assert.match(scopeOf(out.stdout, 'no-repo-pkg'), /not declared/i, '缺 repository 时 URL 列应为 not declared')
  assert.match(scopeOf(out.stdout, 'no-repo-pkg'), ALLOWED, 'Apache-2.0 在商业闭源下应 allowed')
  assert.match(scopeOf(out.stdout, 'gpl-three'), FORBIDDEN, '行里应能看出禁止项')
})

// ---------------------------------------------------------------- checkLicenses

test('checkLicenses：返回 ok/counts/packages，strict 只改 ok 不改状态', async () => {
  const { checkLicenses } = await loadScript()
  const dir = nmDir([{ name: 'no-license-pkg', license: null }])

  const lax = checkLicenses({ dir, use: 'commercial' })
  assert.equal(typeof lax.ok, 'boolean')
  assert.equal(lax.ok, true, '默认下 unknown 只是警告，不算失败')
  assertCounts(lax)
  assert.equal(lax.counts.unknown, 1, '无 license 的包应计入 unknown')

  const strict = checkLicenses({ dir, use: 'commercial', strict: true })
  assert.equal(strict.ok, false, 'strict 下 unknown 应让 ok 变 false')
  assert.equal(strict.counts.unknown, 1, 'strict 不应把状态改写成别的')
})

test('checkLicenses：commercial 下 GPL 让 ok=false', async () => {
  const { checkLicenses } = await loadScript()
  const dir = nmDir([{ name: 'gpl-three', license: 'GPL-3.0' }])
  const report = checkLicenses({ dir, use: 'commercial' })
  assert.equal(report.ok, false)
  assert.equal(report.counts.forbidden, 1)
  assert.equal(normalize(findPackage(report, 'gpl-three').status), 'forbidden')
})

// ---------------------------------------------------------------- --prod-only

test('CLI：dev:true 依赖默认纳入；--prod-only 排除且不计入 forbidden', () => {
  const dir = lockDir([
    { name: 'mit-one', license: 'MIT' },
    { name: 'gpl-three', license: 'GPL-3.0', dev: true },
  ])

  // 默认连 dev 一起看：dev 里的 GPL 也算禁止项。
  const all = run(['--dir', dir, '--json'])
  assertExit(all, 1)
  const allReport = parseJson(all)
  assert.equal(allReport.counts.forbidden, 1, '默认应扫到 dev 的 GPL 并判 forbidden')
  assert.equal(normalize(findPackage(allReport, 'gpl-three').status), 'forbidden')

  const prodOnly = run(['--dir', dir, '--prod-only', '--json'])
  assertExit(prodOnly, 0)
  const report = parseJson(prodOnly)
  assert.equal(report.ok, true)
  assert.equal(report.counts.forbidden, 0, '--prod-only 下 dev 的 GPL 不该再算禁止项')
  assert.ok(findPackage(report, 'mit-one'), '生产依赖仍要报告')
  const devItem = findPackage(report, 'gpl-three')
  if (devItem) assert.notEqual(normalize(devItem.status), 'forbidden', 'dev 依赖不得被算成禁止项')
})

// ---------------------------------------------------------------- open-source 模式

test('CLI：open-source 模式下依赖 GPL 比项目 MIT 更严 → warn（code=dependency-stronger-than-project）', () => {
  const dir = nmDir([{ name: 'gpl-dep', license: 'GPL-3.0' }])
  withProject(dir, { name: 'fixture', license: 'MIT' })

  const out = run(['--dir', dir, '--use', 'open-source', '--json'])
  assertExit(out, 0)
  const report = parseJson(out)
  assert.equal(report.ok, true, 'warn 不拦退出码')
  assert.equal(report.counts.forbidden, 0, 'open-source 模式下 GPL 不是 forbidden，而是 warn')
  assert.equal(report.counts.warn >= 1, true, '应至少有一个 warn')

  const dep = findPackage(report, 'gpl-dep')
  assert.ok(dep, `JSON 里应有 gpl-dep：${JSON.stringify(report.packages)}`)
  assert.equal(normalize(dep.status), 'warn')
  assert.match(
    JSON.stringify(report),
    /dependency-stronger-than-project/,
    `警告应带机器可读的 code：${JSON.stringify(report)}`,
  )
})

test('LGPL 与 §7 表格一致：free-closed 只 warn，commercial 才 forbidden', async () => {
  const mod = await import(SCRIPT_URL)
  assert.equal(statusOf(mod.classifyLicense('LGPL-3.0', 'free-closed')), 'warn')
  assert.equal(statusOf(mod.classifyLicense('LGPL-3.0', 'commercial')), 'forbidden')
  assert.equal(statusOf(mod.classifyLicense('LGPL-3.0', 'open-source')), 'allowed')
})
