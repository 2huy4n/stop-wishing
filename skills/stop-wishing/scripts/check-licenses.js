#!/usr/bin/env node
// 2026-10-26T21:33+08:00 · 新建 check-licenses.js：按 SKILL.md §7 扫描 package-lock.json（优先，含传递依赖）/ node_modules，判定依赖许可证在 self/free-closed/open-source/commercial 下能否使用；回滚点：本文件尚未提交，删除即可完全撤销。
//
// 为什么零依赖：这是 skill 自带的自检脚本，不该为了查许可证再装一轮包；也不联网，SPDX 解析全部在本地完成。
// 输入源：<dir>/package-lock.json 的 packages（lockfileVersion>=2，全量含传递依赖）优先；node_modules 只补缺失字段，
// 没有可用 lock 时退回 node_modules 顶层包；两边都没有有效包 -> 退出码 2。
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const USES = ['self', 'free-closed', 'open-source', 'commercial']
const DEFAULT_USE = 'commercial'
const LOCK_FILE = 'package-lock.json'
const NODE_MODULES_DIR = 'node_modules'
const PROJECT_FILE = 'package.json'
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']

const USE_LABELS = {
  self: '自用',
  'free-closed': '免费闭源分发',
  'open-source': '开源（同许可）',
  commercial: '商用（收费 / 公司内部）',
}

const STATUS_LABELS = { allowed: '可用', warn: '需确认', forbidden: '禁止', unknown: '未知' }

// 强度排序只用于比较：AND 取最大（最严格），OR 取最小（最有利）。
const STATUS_ORDER = { allowed: 0, warn: 1, unknown: 2, forbidden: 3 }

// 许可证桶。分类口径见 SKILL.md §7；矩阵在下方 FAMILY_DECISIONS 里，一处改完全局生效。
const PERMISSIVE_IDS = [
  'MIT',
  'MIT-0',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  '0BSD',
  'Unlicense',
  'CC0-1.0',
  'Zlib',
  'BlueOak-1.0.0',
]

const COPYLEFT_GROUPS = [
  ['gpl', ['GPL-2.0-only', 'GPL-2.0-or-later', 'GPL-3.0-only', 'GPL-3.0-or-later']],
  ['agpl', ['AGPL-3.0-only', 'AGPL-3.0-or-later']],
  ['lgpl', [
    'LGPL-2.0-only',
    'LGPL-2.0-or-later',
    'LGPL-2.1-only',
    'LGPL-2.1-or-later',
    'LGPL-3.0-only',
    'LGPL-3.0-or-later',
  ]],
  ['weak', ['MPL-2.0', 'EPL-2.0', 'EUPL-1.2']],
  ['server', ['SSPL-1.0', 'BUSL-1.1']],
]

// 归一表：小写写法 -> 规整 id。废弃的 GPL-2.0 与 GPL-2.0-only 同桶；`+` 后缀在 canonicalLicense 里换算成 -or-later。
const ID_ALIASES = new Map([
  ['gpl-2.0', 'GPL-2.0-only'],
  ['gpl-3.0', 'GPL-3.0-only'],
  ['agpl-3.0', 'AGPL-3.0-only'],
  ['lgpl-2.0', 'LGPL-2.0-only'],
  ['lgpl-2.1', 'LGPL-2.1-only'],
  ['lgpl-3.0', 'LGPL-3.0-only'],
  ['apache 2.0', 'Apache-2.0'],
])

// 已知 id 表：小写 -> { id, family }。
const KNOWN_LICENSES = new Map()
for (const id of PERMISSIVE_IDS) KNOWN_LICENSES.set(id.toLowerCase(), { id, family: 'permissive' })
for (const [family, ids] of COPYLEFT_GROUPS) {
  for (const id of ids) KNOWN_LICENSES.set(id.toLowerCase(), { id, family })
}

// 常见宽松例外：不直接判死，按基础许可判定，但至少要人工确认（warn）。
const PERMISSIVE_EXCEPTIONS = [
  'classpath-exception',
  'llvm-exception',
  'autoconf-exception',
  'bison-exception',
  'openssl-exception',
]

// 用途矩阵（SKILL.md §7 + 评审补洞）：
//   GPL/AGPL/LGPL：self/open-source 允许，free-closed/commercial 禁止
//   MPL/EPL/EUPL（弱 copyleft）：self/open-source 允许，free-closed/commercial 需确认
//   SSPL/BUSL、CC-BY-NC、专有（UNLICENSED）：只有 self 允许
//   缺 license 字段 / SEE LICENSE IN ...：unknown（缺字段不等于仓库没有 LICENSE 文件）
const FAMILY_DECISIONS = {
  permissive: { self: 'allowed', 'free-closed': 'allowed', 'open-source': 'allowed', commercial: 'allowed' },
  gpl: { self: 'allowed', 'free-closed': 'forbidden', 'open-source': 'allowed', commercial: 'forbidden' },
  agpl: { self: 'allowed', 'free-closed': 'forbidden', 'open-source': 'allowed', commercial: 'forbidden' },
  lgpl: { self: 'allowed', 'free-closed': 'warn', 'open-source': 'allowed', commercial: 'forbidden' },
  weak: { self: 'allowed', 'free-closed': 'warn', 'open-source': 'allowed', commercial: 'warn' },
  server: { self: 'allowed', 'free-closed': 'forbidden', 'open-source': 'forbidden', commercial: 'forbidden' },
  noncommercial: { self: 'allowed', 'free-closed': 'forbidden', 'open-source': 'forbidden', commercial: 'forbidden' },
  proprietary: { self: 'allowed', 'free-closed': 'forbidden', 'open-source': 'forbidden', commercial: 'forbidden' },
  unknown: { self: 'unknown', 'free-closed': 'unknown', 'open-source': 'unknown', commercial: 'unknown' },
}

// 传播强度：permissive(0) < 弱 copyleft(1) < 强 copyleft/专有(2)。unknown 无法比较 -> null。
const FAMILY_STRENGTH = {
  permissive: 0,
  weak: 1,
  gpl: 2,
  agpl: 2,
  lgpl: 2,
  server: 2,
  noncommercial: 2,
  proprietary: 2,
  unknown: null,
}

const FAMILY_DESCRIPTIONS = {
  permissive: '宽松许可证，保留版权声明即可',
  gpl: 'GPL 强 copyleft，传染整份作品',
  agpl: 'AGPL 强 copyleft，连网络服务使用也算',
  lgpl: 'LGPL copyleft：自由分发需动态链接且可替换（warn），商用闭源拒绝',
  weak: 'MPL/EPL/EUPL 弱 copyleft，按文件承担开源义务',
  server: 'SSPL/BUSL 服务端限制许可证',
  noncommercial: 'CC-BY-NC 禁止商业使用',
  proprietary: '专有许可，不授权分发与商用',
  unknown: '不在已知许可证表中，条款未知',
}

export function parseArgs(argv = []) {
  const options = {
    dir: process.cwd(),
    use: DEFAULT_USE,
    prodOnly: false,
    strict: false,
    json: false,
    rows: false,
    help: false,
    unknown: [],
  }

  // --flag=value 与 --flag value 都支持；取值缺失记进 unknown，由 CLI 判成退出码 2。
  const readValue = (arg, index) => {
    const equal = arg.indexOf('=')
    if (equal !== -1) {
      const inline = arg.slice(equal + 1).trim()
      return inline === '' ? { value: null, next: index } : { value: inline, next: index }
    }
    const next = argv[index + 1]
    if (next === undefined || String(next).startsWith('-')) return { value: null, next: index }
    return { value: String(next), next: index + 1 }
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i])
    if (arg === '--json') options.json = true
    else if (arg === '--rows') options.rows = true
    else if (arg === '--prod-only') options.prodOnly = true
    else if (arg === '--strict') options.strict = true
    else if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--dir' || arg.startsWith('--dir=')) {
      const read = readValue(arg, i)
      if (read.value === null) options.unknown.push(arg)
      else {
        options.dir = read.value
        i = read.next
      }
    } else if (arg === '--use' || arg.startsWith('--use=')) {
      const read = readValue(arg, i)
      if (read.value === null) options.unknown.push(arg)
      else {
        options.use = read.value
        i = read.next
      }
    } else options.unknown.push(arg)
  }
  return options
}

function usage() {
  return [
    '用法: node check-licenses.js [--dir PATH] [--use self|free-closed|open-source|commercial] [--prod-only] [--strict] [--json] [--rows] [--help]',
    '',
    '  --dir PATH   项目根目录，默认 process.cwd()',
    '               先读 <dir>/package-lock.json 的 packages（全量含传递依赖），node_modules 只补缺失字段；',
    '               没有可用 lock 时退回 <dir>/node_modules 顶层包（含 @scope/*，不递归包内 node_modules）',
    '  --use NAME   用途判定，默认 commercial；没把握一律按 commercial 处理（SKILL.md §7）',
    '                 self        自用',
    '                 free-closed 免费闭源分发',
    '                 open-source 开源（同许可，依赖强度不得高于项目自身）',
    '                 commercial  商用（收费或公司内部）',
    '  --prod-only  只看生产依赖（排除 lock 里 dev=true 的包）',
    '  --strict     未知许可证按失败处理（status 仍记 unknown，只影响退出码）',
    '  --json       输出 JSON：tool/at/dir/use/source/packages/counts/ok',
    '  --rows       输出 docs/LICENSES.md 可用的 5 列表格行（--json 优先）',
    '  --help, -h   打印本用法',
    '',
    '判定口径（SKILL.md §7）:',
    '  permissive（MIT/Apache-2.0/BSD/ISC/0BSD/Unlicense/CC0/Zlib/BlueOak）任何用途可用；',
    '  GPL/AGPL/LGPL 仅 self 与 open-source 可用；MPL/EPL/EUPL 闭源与商用需确认；',
    '  SSPL/BUSL、CC-BY-NC、UNLICENSED 只有 self 可用；缺 license 字段 / SEE LICENSE IN ... 一律 unknown；',
    '  SPDX 表达式：AND 取最严格、OR 取最有利；常见宽松例外（Classpath/LLVM/Autoconf/Bison/OpenSSL）不直接判死，统一 warn；',
    '退出码: 0 无禁止项（未知仅警告）/ 1 有禁止项（--strict 时未知也失败）/ 2 参数或 IO 错误',
  ].join('\n')
}

function normalizeUse(use) {
  const value = typeof use === 'string' ? use.trim().toLowerCase() : ''
  return USES.includes(value) ? value : DEFAULT_USE
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

function isDirectory(path) {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function isFile(path) {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

/** 本地时间戳：ISO 8601，含本机 UTC 偏移（不写死时区）。 */
function stamp(date = new Date()) {
  const pad = value => String(value).padStart(2, '0')
  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const abs = Math.abs(offset)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

/**
 * 把 package.json / lock 条目里的许可证字段转成表达式文本。
 * 支持 license 字符串、license:{type|name}、旧式 licenses 数组（数组按 OR：任选其一即可）。
 */
function toLicenseExpression(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    const text = value.trim()
    return text === '' ? null : text
  }
  if (Array.isArray(value)) {
    const parts = value
      .map(item => {
        if (typeof item === 'string') return item.trim()
        if (item && typeof item === 'object') return String(item.type ?? item.name ?? '').trim()
        return ''
      })
      .filter(Boolean)
    if (parts.length === 0) return null
    return parts.length === 1 ? parts[0] : parts.join(' OR ')
  }
  if (typeof value === 'object') {
    const inner = value.type ?? value.name
    return typeof inner === 'string' && inner.trim() !== '' ? inner.trim() : null
  }
  return String(value).trim() || null
}

/** 别名归一：大小写不敏感 + Apache 2.0 写法统一（多词别名先替换，否则会被切成两个 token）。 */
function normalizeExpression(text) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/apache\s+(?:license\s+)?(?:,?\s*version\s*)?2\.0/gi, 'Apache-2.0')
    .replace(/\s+/g, ' ')
    .trim()
}

function canonicalLicense(token) {
  if (typeof token !== 'string') return null
  let text = token.trim()
  if (text === '') return null

  let orLater = false
  if (text.endsWith('+')) {
    orLater = true
    text = text.slice(0, -1).trim()
  }
  const lower = text.toLowerCase()
  if (lower.startsWith('cc-by-nc')) return { id: text.toUpperCase(), family: 'noncommercial' }
  if (lower === 'unlicensed') return { id: 'UNLICENSED', family: 'proprietary' }

  const alias = ID_ALIASES.get(lower)
  const known = alias ? KNOWN_LICENSES.get(alias.toLowerCase()) : KNOWN_LICENSES.get(lower)
  if (!known) return null

  let id = known.id
  if (orLater && id.endsWith('-only')) id = id.slice(0, -'-only'.length) + '-or-later'
  return { id, family: known.family }
}

function isKnownException(name) {
  const lower = String(name).trim().toLowerCase()
  if (lower === '') return false
  return PERMISSIVE_EXCEPTIONS.some(prefix => lower === prefix || lower.startsWith(`${prefix}-`))
}

function codeForFamily(family, status) {
  switch (family) {
    case 'permissive':
      return 'permissive'
    case 'gpl':
    case 'agpl':
    case 'lgpl':
      return status === 'allowed' ? 'copyleft-allowed' : 'copyleft-forbidden'
    case 'weak':
      return status === 'allowed' ? 'weak-copyleft-allowed' : 'weak-copyleft-warn'
    case 'server':
      return status === 'allowed' ? 'server-copyleft-allowed' : 'server-copyleft-forbidden'
    case 'noncommercial':
      return status === 'allowed' ? 'noncommercial-allowed' : 'noncommercial-forbidden'
    case 'proprietary':
      return status === 'allowed' ? 'proprietary-allowed' : 'proprietary-forbidden'
    default:
      return 'unknown-license'
  }
}

function leafReason(display, family, status, use) {
  const head = family === 'unknown'
    ? `${display} ${FAMILY_DESCRIPTIONS.unknown}`
    : `${display}：${FAMILY_DESCRIPTIONS[family]}`
  const tail = status === 'allowed'
    ? `，当前用途「${USE_LABELS[use]}」可用`
    : status === 'warn'
      ? `，当前用途「${USE_LABELS[use]}」需人工确认`
      : status === 'forbidden'
        ? `，当前用途「${USE_LABELS[use]}」不可用`
        : '，需人工确认后再用'
  return `${head}${tail}（${codeForFamily(family, status)}）`
}

function tokenizeExpression(text) {
  return text
    .replace(/\(/g, ' ( ')
    .replace(/\)/g, ' ) ')
    .split(/\s+/)
    .filter(Boolean)
}

/** SPDX 表达式解析：AND 比 OR 结合更紧；括号必须成对，否则整体 unknown。 */
function parseExpression(text) {
  const tokens = tokenizeExpression(text)
  const state = { index: 0, error: null }
  const peek = () => tokens[state.index]
  const isOperator = token => {
    if (token === undefined) return false
    const upper = token.toUpperCase()
    return upper === 'AND' || upper === 'OR' || upper === 'WITH'
  }

  function parseOr() {
    const children = [parseAnd()]
    while (!state.error && peek() !== undefined && peek().toUpperCase() === 'OR') {
      state.index += 1
      children.push(parseAnd())
    }
    if (children.some(child => child === null)) return null
    return children.length === 1 ? children[0] : { kind: 'or', children }
  }

  function parseAnd() {
    const children = [parsePrimary()]
    while (!state.error && peek() !== undefined && peek().toUpperCase() === 'AND') {
      state.index += 1
      children.push(parsePrimary())
    }
    if (children.some(child => child === null)) return null
    return children.length === 1 ? children[0] : { kind: 'and', children }
  }

  function parsePrimary() {
    if (state.error) return null
    if (state.index >= tokens.length) {
      state.error = '表达式不完整'
      return null
    }
    const token = tokens[state.index]
    if (token === '(') {
      state.index += 1
      const inner = parseOr()
      if (state.error) return null
      if (tokens[state.index] !== ')') {
        state.error = '括号不匹配'
        return null
      }
      state.index += 1
      return inner
    }
    if (token === ')' || isOperator(token)) {
      state.error = `意外的操作符 ${token}`
      return null
    }
    state.index += 1
    let exception = null
    if (peek() !== undefined && peek().toUpperCase() === 'WITH') {
      state.index += 1
      const next = peek()
      if (next === undefined || next === ')' || isOperator(next)) {
        state.error = 'WITH 后缺少例外名'
        return null
      }
      exception = next
      state.index += 1
    }
    return { kind: 'leaf', token, exception }
  }

  const ast = parseOr()
  if (!state.error && state.index < tokens.length) state.error = `多余的 token：${tokens[state.index]}`
  if (state.error) return { ok: false, ast: null, error: state.error }
  return { ok: true, ast, error: null }
}

function stringifyExpression(node) {
  if (node === null || node === undefined) return ''
  if (node.kind === 'leaf') {
    const canonical = canonicalLicense(node.token)
    const display = canonical ? canonical.id : node.token
    return node.exception ? `${display} WITH ${node.exception}` : display
  }
  const joined = node.children
    .map(child => stringifyExpression(child))
    .join(node.kind === 'and' ? ' AND ' : ' OR ')
  return `(${joined})`
}

function evaluateLeaf(leaf, use) {
  const canonical = canonicalLicense(leaf.token)
  const display = canonical ? canonical.id : leaf.token
  const family = canonical ? canonical.family : 'unknown'
  const baseStatus = FAMILY_DECISIONS[family][use]
  const strength = FAMILY_STRENGTH[family]
  let status = baseStatus
  let code = codeForFamily(family, baseStatus)
  let reason = leafReason(display, family, baseStatus, use)

  if (leaf.exception) {
    if (!isKnownException(leaf.exception)) {
      status = 'unknown'
      code = 'exception-unknown'
      reason = `${display} 附带未知例外 ${leaf.exception}：例外条款未知，需人工确认（${code}）`
    } else if (family === 'unknown') {
      status = 'unknown'
      code = 'unknown-license'
      reason = `${display} 不在已知许可证表中，附带例外 ${leaf.exception}：需人工确认（${code}）`
    } else {
      // 常见宽松例外（Classpath/LLVM/Autoconf/Bison/OpenSSL）可能放宽传染范围，不直接判死：
      // 基础许可再强也降为 warn，由人确认例外条款是否适用于当前用法。
      status = 'warn'
      code = 'exception-manual-review'
      reason = `${display} 附带常见宽松例外 ${leaf.exception}：例外可能放宽传染范围（例如链接例外），不直接判死，但必须人工确认（${code}）`
    }
  }

  return {
    status,
    code,
    strength,
    licenses: canonical ? [display] : [leaf.token],
    reason,
  }
}

function evaluateNode(node, use) {
  if (node.kind === 'leaf') return evaluateLeaf(node, use)

  const isAnd = node.kind === 'and'
  const children = node.children.map(child => evaluateNode(child, use))
  let chosen = children[0]
  for (const child of children.slice(1)) {
    const worse = STATUS_ORDER[child.status] > STATUS_ORDER[chosen.status]
    const better = STATUS_ORDER[child.status] < STATUS_ORDER[chosen.status]
    if (isAnd ? worse : better) chosen = child
  }

  const strengths = children.map(child => child.strength)
  const strength = isAnd
    ? (strengths.some(value => value === null) ? null : Math.max(...strengths))
    : (strengths.filter(value => value !== null).length === 0 ? null : Math.min(...strengths.filter(value => value !== null)))

  const licenses = []
  for (const child of children) {
    for (const id of child.licenses) {
      if (!licenses.includes(id)) licenses.push(id)
    }
  }

  return {
    status: chosen.status,
    code: chosen.code,
    strength,
    licenses,
    reason: `${stringifyExpression(node)} 按 ${isAnd ? 'AND 取最严格' : 'OR 取最有利'}：${chosen.reason}`,
  }
}

/** 缺 license 字段：不等于仓库真的没有 LICENSE 文件，所以按 unknown 处理（--strict 才失败）。 */
function missingLicenseVerdict(label) {
  const code = 'license-field-missing'
  return {
    status: 'unknown',
    licenses: [],
    reason: `${label}：缺字段不等于仓库没有 LICENSE 文件，需人工确认（${code}）`,
    code,
    normalized: null,
    strength: null,
  }
}

/**
 * 判定一条许可证表达式在当前用途下的结论。
 * 返回 { status, licenses, reason, code, normalized, strength }：
 *   status  allowed | warn | forbidden | unknown
 *   code    稳定的机器可读原因码（reason 末尾同样带一份）
 *   normalized 归一后的 SPDX 表达式（无法归一为 null）
 */
export function classifyLicense(expression, use) {
  const currentUse = normalizeUse(use)
  const raw = toLicenseExpression(expression)
  if (raw === null) return missingLicenseVerdict('未声明 license 字段')

  const text = normalizeExpression(raw)
  if (text === '') return missingLicenseVerdict('license 字段为空')

  if (/^see\s+licen[cs]e\s+in\b/i.test(text)) {
    const code = 'license-file-reference'
    return {
      status: 'unknown',
      licenses: [],
      reason: `「${text}」指向许可证文件：脚本不读文件内容，需人工确认（${code}）`,
      code,
      normalized: null,
      strength: null,
    }
  }

  if (/^unlicensed$/i.test(text)) {
    const status = FAMILY_DECISIONS.proprietary[currentUse]
    const code = codeForFamily('proprietary', status)
    return {
      status,
      licenses: ['UNLICENSED'],
      reason: `UNLICENSED 表示专有软件：当前用途「${USE_LABELS[currentUse]}」${status === 'allowed' ? '仅限自用' : '不可用'}（${code}）`,
      code,
      normalized: 'UNLICENSED',
      strength: FAMILY_STRENGTH.proprietary,
    }
  }

  const parsed = parseExpression(text)
  if (!parsed.ok) {
    const code = 'spdx-invalid'
    return {
      status: 'unknown',
      licenses: [],
      reason: `SPDX 表达式无法解析（${parsed.error}）：${text}（${code}）`,
      code,
      normalized: null,
      strength: null,
    }
  }

  const evaluated = evaluateNode(parsed.ast, currentUse)
  return {
    status: evaluated.status,
    licenses: evaluated.licenses,
    reason: evaluated.reason,
    code: evaluated.code,
    normalized: stringifyExpression(parsed.ast),
    strength: evaluated.strength,
  }
}

function readPackageJson(dirPath) {
  const file = join(dirPath, PROJECT_FILE)
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    return null
  }
  let data
  try {
    data = JSON.parse(stripBom(text))
  } catch {
    return null
  }
  return data && typeof data === 'object' && !Array.isArray(data) ? data : null
}

/** 项目自身信息：direct 判定用 deps 名单，open-source 判定用自身 license 作强度基准。 */
function readProjectInfo(root) {
  const empty = { name: null, license: null, deps: new Set() }
  const data = readPackageJson(root)
  if (!data) return empty
  const deps = new Set()
  for (const field of DEPENDENCY_FIELDS) {
    const map = data[field]
    if (map && typeof map === 'object' && !Array.isArray(map)) {
      for (const name of Object.keys(map)) deps.add(name)
    }
  }
  return {
    name: typeof data.name === 'string' && data.name.trim() !== '' ? data.name.trim() : null,
    license: toLicenseExpression(data.license ?? data.licenses),
    deps,
  }
}

function normalizeSourceUrl(value) {
  if (typeof value !== 'string') return null
  let url = value.trim().replace(/^git\+/i, '')
  if (url === '') return null
  if (/^https?:\/\//i.test(url)) return url
  let match = /^git:\/\/github\.com\/(.+)$/i.exec(url)
  if (match) return `https://github.com/${match[1]}`
  match = /^git@github\.com:(.+)$/i.exec(url)
  if (match) return `https://github.com/${match[1]}`
  match = /^github:([^#]+)$/i.exec(url)
  if (match) return `https://github.com/${match[1]}`
  return null
}

function trimUrl(url) {
  return url.replace(/#.*$/, '').replace(/\.git$/i, '').replace(/\/+$/, '')
}

/** 出处 URL：优先 repository，其次 homepage；都没有返回 null（表格里写 not declared）。 */
function extractSourceUrl(data) {
  if (!data || typeof data !== 'object') return null
  const repository = data.repository
  const repoUrl = typeof repository === 'string'
    ? repository
    : repository && typeof repository === 'object' && typeof repository.url === 'string'
      ? repository.url
      : ''
  const repo = normalizeSourceUrl(repoUrl)
  if (repo) return trimUrl(repo)
  const homepage = normalizeSourceUrl(data.homepage)
  return homepage ? trimUrl(homepage) : null
}

function extractLicense(data) {
  if (!data || typeof data !== 'object') return null
  return toLicenseExpression(data.license ?? data.licenses)
}

function nameFromKey(key) {
  const match = /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)$/.exec(key)
  if (match) return match[1]
  const parts = key.split('/')
  return parts[parts.length - 1] ?? key
}

function compareText(left, right) {
  const a = left === null || left === undefined ? '' : String(left)
  const b = right === null || right === undefined ? '' : String(right)
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/** 稳定排序：先 name 后 version，保证两次运行输出一致。 */
function sortPackages(packages) {
  return packages.slice().sort((a, b) => compareText(a.name, b.name) || compareText(a.version, b.version))
}

/** 同一个 name@version 可能出现在 lock 的不同路径：合并成一行，direct/dev 取合并后的口径。 */
function dedupePackages(packages) {
  const byKey = new Map()
  const result = []
  for (const pkg of packages) {
    const key = `${pkg.name}@${pkg.version ?? ''}`
    const existing = byKey.get(key)
    if (!existing) {
      const copy = { ...pkg }
      byKey.set(key, copy)
      result.push(copy)
      continue
    }
    existing.direct = existing.direct || pkg.direct
    existing.dev = existing.dev && pkg.dev
    if (!existing.license && pkg.license) existing.license = pkg.license
    if (!existing.sourceUrl && pkg.sourceUrl) existing.sourceUrl = pkg.sourceUrl
  }
  return result
}

function dependencyError(message) {
  const error = new Error(message)
  error.code = 'E_NO_DEPENDENCIES'
  return error
}

/**
 * 读 lock 的 packages（lockfileVersion>=2）：全量含传递依赖。
 * 跳过根 ""、link:true、file: 本地包与工作区目录，计入 excluded；
 * node_modules 只用来补缺失的 name/version/license（不改变 lock 的包清单）。
 */
function readLockPackages(root, lockPath, options) {
  let data
  try {
    data = JSON.parse(stripBom(readFileSync(lockPath, 'utf8')))
  } catch (error) {
    return { packages: [], error: `${LOCK_FILE} 解析失败：${messageOf(error)}` }
  }
  if (!data || typeof data !== 'object' || Number(data.lockfileVersion) < 2) return { packages: [], error: null }
  const entries = data.packages
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) return { packages: [], error: null }

  const packages = []
  for (const key of Object.keys(entries)) {
    if (key === '') continue
    const entry = entries[key]
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    if (!key.startsWith(`${NODE_MODULES_DIR}/`)) {
      options.excluded.push({ name: nameFromKey(key), version: entry.version ?? null, reason: 'local' })
      continue
    }
    if (entry.link === true) {
      options.excluded.push({ name: nameFromKey(key), version: entry.version ?? null, reason: 'link' })
      continue
    }
    if (typeof entry.resolved === 'string' && /^file:/i.test(entry.resolved)) {
      options.excluded.push({ name: nameFromKey(key), version: entry.version ?? null, reason: 'file' })
      continue
    }
    if (key.includes('..') || key.startsWith('/') || /^[A-Za-z]:/.test(key)) continue

    const keyName = nameFromKey(key)
    const dev = entry.dev === true
    if (options.prodOnly && dev) continue

    let name = typeof entry.name === 'string' && entry.name.trim() !== '' ? entry.name.trim() : keyName
    let version = typeof entry.version === 'string' && entry.version.trim() !== '' ? entry.version.trim() : null
    let license = extractLicense(entry)
    let sourceUrl = extractSourceUrl(entry)

    // node_modules 只补缺失字段：lock 里几乎都带 name/version/license，缺了才落盘读一次。
    if (!version || !license) {
      const installed = readPackageJson(join(root, key))
      if (installed) {
        if (!name) name = typeof installed.name === 'string' ? installed.name.trim() : keyName
        if (!version) version = typeof installed.version === 'string' ? installed.version.trim() : null
        if (!license) license = extractLicense(installed)
        if (!sourceUrl) sourceUrl = extractSourceUrl(installed)
      }
    }

    packages.push({
      name: name || keyName,
      version: version || null,
      license: license || null,
      direct: options.project.deps.has(keyName) && key === `${NODE_MODULES_DIR}/${keyName}`,
      dev,
      sourceUrl: sourceUrl || null,
    })
  }

  return { packages: dedupePackages(packages), error: null }
}

function readInstalledPackage(packageDir, fallbackName, options) {
  const data = readPackageJson(packageDir)
  if (!data) return null
  const dev = data.dev === true
  if (options.prodOnly && dev) return null
  const name = typeof data.name === 'string' && data.name.trim() !== '' ? data.name.trim() : fallbackName
  const version = typeof data.version === 'string' && data.version.trim() !== '' ? data.version.trim() : null
  return {
    name,
    version,
    license: extractLicense(data),
    direct: options.project.deps.has(name) || options.project.deps.has(fallbackName),
    dev,
    sourceUrl: extractSourceUrl(data) || null,
  }
}

/** 回退源：node_modules 顶层包（含 @scope/*），不递归包内 node_modules。 */
function scanInstalledPackages(nodeModulesDir, options) {
  const packages = []
  let entries
  try {
    entries = readdirSync(nodeModulesDir, { withFileTypes: true })
  } catch {
    return packages
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (entry.name.startsWith('@')) {
      const scopeDir = join(nodeModulesDir, entry.name)
      if (!isDirectory(scopeDir)) continue
      let scoped
      try {
        scoped = readdirSync(scopeDir, { withFileTypes: true })
      } catch {
        continue
      }
      for (const item of scoped) {
        if (item.name.startsWith('.')) continue
        const packageDir = join(scopeDir, item.name)
        if (!isDirectory(packageDir)) continue
        const pkg = readInstalledPackage(packageDir, `${entry.name}/${item.name}`, options)
        if (pkg) packages.push(pkg)
      }
      continue
    }
    const packageDir = join(nodeModulesDir, entry.name)
    if (!isDirectory(packageDir)) continue
    const pkg = readInstalledPackage(packageDir, entry.name, options)
    if (pkg) packages.push(pkg)
  }
  return packages
}

/**
 * 包清单扫描：lock 优先（全量含传递依赖），没有可用 lock 或 lock 无有效包时退回 node_modules；
 * 两个来源都没有有效包 -> 抛错（CLI 退出码 2）。
 * 返回 { source, packages, excluded }。
 */
export function scanPackages(dir, options = {}) {
  const root = resolve(dir || process.cwd())
  if (!isDirectory(root)) throw dependencyError(`目录不存在: ${root}`)

  const prodOnly = Boolean(options.prodOnly)
  const project = readProjectInfo(root)
  const excluded = []
  let lockIssue = null
  let packages = []
  let source = null

  const lockPath = join(root, LOCK_FILE)
  if (isFile(lockPath)) {
    const lock = readLockPackages(root, lockPath, { prodOnly, project, excluded })
    if (lock.error) lockIssue = lock.error
    if (lock.packages.length > 0) {
      packages = lock.packages
      source = LOCK_FILE
    } else {
      // lock 不可用（v1/空）时，excluded 描述的是没被采用的清单，清掉避免误报。
      excluded.length = 0
    }
  }

  if (packages.length === 0) {
    const nodeModulesDir = join(root, NODE_MODULES_DIR)
    if (isDirectory(nodeModulesDir)) {
      const installed = scanInstalledPackages(nodeModulesDir, { prodOnly, project })
      if (installed.length > 0) {
        packages = installed
        source = NODE_MODULES_DIR
      }
    }
  }

  if (packages.length === 0) {
    const hint = lockIssue ? `；${lockIssue}` : ''
    throw dependencyError(`在 ${root} 下没有可检查的依赖包（${LOCK_FILE} 的 packages 与 ${NODE_MODULES_DIR} 顶层包都为空）${hint}`)
  }

  return { source, packages: sortPackages(packages), excluded }
}

export function checkLicenses(options = {}) {
  const dir = resolve(options.dir || process.cwd())
  const use = normalizeUse(options.use)
  const prodOnly = Boolean(options.prodOnly)
  const strict = Boolean(options.strict)
  const counts = { total: 0, allowed: 0, warn: 0, forbidden: 0, unknown: 0, excluded: 0 }

  let scanned
  try {
    scanned = scanPackages(dir, { prodOnly })
  } catch (error) {
    return { ok: false, code: 2, dir, use, source: null, packages: [], counts, message: messageOf(error) }
  }

  // open-source 模式：依赖强度不得高于项目自身（permissive < 弱 copyleft < 强 copyleft）。
  const project = readProjectInfo(dir)
  const projectStrength = use === 'open-source' ? classifyLicense(project.license, use).strength : null

  const packages = scanned.packages.map(pkg => {
    const verdict = classifyLicense(pkg.license, use)
    let status = verdict.status
    let code = verdict.code
    let reason = verdict.reason

    if (use === 'open-source'
      && projectStrength !== null
      && verdict.strength !== null
      && verdict.strength > projectStrength
      && status !== 'forbidden'
      && status !== 'unknown') {
      status = 'warn'
      code = 'dependency-stronger-than-project'
      reason = `${reason}；依赖许可证强度高于项目自身（${project.license ?? '未声明'} < ${pkg.license ?? '未声明'}）：${code}`
    }

    // --strict 不改写包的 status：unknown 仍是 unknown，只在下面单独计入失败。
    return {
      name: pkg.name,
      version: pkg.version,
      license: pkg.license,
      licenseNormalized: verdict.normalized,
      direct: pkg.direct === true,
      dev: pkg.dev === true,
      sourceUrl: pkg.sourceUrl ?? null,
      status,
      code,
      reason,
    }
  })

  counts.total = packages.length
  counts.excluded = Array.isArray(scanned.excluded) ? scanned.excluded.length : 0
  for (const pkg of packages) counts[pkg.status] += 1

  const strictFailure = strict && counts.unknown > 0
  const ok = counts.forbidden === 0 && !strictFailure
  return { ok, code: ok ? 0 : 1, dir, use, source: scanned.source, packages, counts }
}

function sourceLabel(source) {
  if (source === LOCK_FILE) return `${LOCK_FILE} 的 packages（lockfileVersion>=2，全量含传递依赖）`
  if (source === NODE_MODULES_DIR) return `${NODE_MODULES_DIR} 顶层包（没有可用 lock 时的回退）`
  return '未知'
}

function packageLabel(pkg) {
  return `${pkg.name || '未命名'}@${pkg.version ?? '?'}`
}

function conclusionFor(result, options) {
  if (result.counts.forbidden > 0) {
    return `结论: 有 ${result.counts.forbidden} 个禁止项 → 必须替换或移除后再用（退出码 1）。`
  }
  if (options.strict && result.counts.unknown > 0) {
    return `结论: 没有禁止项；--strict：${result.counts.unknown} 个未知按失败处理（退出码 1）。`
  }
  if (result.counts.unknown > 0) {
    return `结论: 没有禁止项；${result.counts.unknown} 个未知许可证需人工确认（退出码 0，--strict 时会失败）。`
  }
  if (result.counts.warn > 0) {
    return `结论: 没有禁止项；${result.counts.warn} 个需确认项请人工核对（退出码 0）。`
  }
  return '结论: 全部允许，可以继续（仍要保留版权声明与出处记录）。'
}

function renderText(result, options) {
  const lines = []
  const directCount = result.packages.filter(pkg => pkg.direct).length
  const devCount = result.packages.filter(pkg => pkg.dev).length
  const excluded = result.counts.excluded ?? 0

  lines.push('许可证检查（stop-wishing SKILL.md §7）')
  lines.push('')
  lines.push(`扫描目录: ${result.dir}`)
  lines.push(`用途判定: ${USE_LABELS[result.use]}（${result.use}）`)
  lines.push(`许可证来源: ${sourceLabel(result.source)}`)
  lines.push(`包数量: ${result.counts.total}（direct ${directCount} / dev ${devCount}${excluded > 0 ? ` / 排除 ${excluded}` : ''}）`)
  if (options.prodOnly && result.source === LOCK_FILE) lines.push('过滤: --prod-only 已排除 dev 依赖')
  if (options.strict) lines.push('严格: --strict 把未知许可证按失败处理（status 仍记为 unknown）')
  lines.push('')

  for (const status of ['forbidden', 'warn', 'unknown']) {
    const list = result.packages.filter(pkg => pkg.status === status)
    lines.push(`${STATUS_LABELS[status]} ${list.length} 个${list.length > 0 ? ':' : ''}`)
    for (const pkg of list) {
      lines.push(`  - [${STATUS_LABELS[status]}] ${packageLabel(pkg)} ${pkg.license ?? '未声明'} — ${pkg.reason}`)
    }
  }
  lines.push(`可用 ${result.counts.allowed} 个`)
  lines.push('')

  const hints = []
  if (result.counts.unknown > 0 && options.strict) {
    hints.push(`--strict：${result.counts.unknown} 个未知按失败处理；包的 status 仍是 unknown，便于区分「禁止」与「未知」。`)
  }
  if (result.counts.unknown > 0 && !options.strict) {
    hints.push('未知许可证不默认放行；确认条款后写进 docs/LICENSES.md，或用 --strict 让未知直接失败。')
  }
  if (excluded > 0) {
    hints.push(`排除的 ${excluded} 个是 link/file/本地工作区包，不参与许可证判定。`)
  }
  if (options.prodOnly && result.source === NODE_MODULES_DIR) {
    hints.push('node_modules 无法区分 dev/prod，--prod-only 只在 package-lock.json 来源下生效。')
  }
  for (const hint of hints) lines.push(`提示: ${hint}`)

  lines.push(conclusionFor(result, options))
  return lines.join('\n')
}

function cell(value, fallback) {
  const text = value === null || value === undefined || value === '' ? fallback : String(value)
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

function usability(status) {
  if (status === 'allowed') return '可用'
  if (status === 'forbidden') return '不可用'
  return '需确认'
}

/** docs/LICENSES.md 的 5 列：名称 / 版本 / 许可证 / 商用可用性 / 出处 URL。 */
function renderRows(result) {
  const lines = [
    '| Name | Version | License | Commercial usability | Source URL |',
    '| --- | --- | --- | --- | --- |',
  ]
  for (const pkg of result.packages) {
    lines.push(`| ${cell(pkg.name, 'not declared')} | ${cell(pkg.version, 'not declared')} | ${cell(pkg.license, '未声明')} | ${usability(pkg.status)} | ${cell(pkg.sourceUrl, 'not declared')} |`)
  }
  return lines.join('\n')
}

function renderJson(result, options = {}) {
  return JSON.stringify({
    tool: 'stop-wishing/check-licenses',
    at: stamp(),
    dir: result.dir,
    use: result.use,
    strict: Boolean(options.strict),
    source: result.source,
    packages: result.packages,
    counts: result.counts,
    ok: result.ok,
  }, null, 2)
}

if (process.argv[1]?.endsWith('check-licenses.js')) {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    process.stdout.write(`${usage()}\n`)
    process.exitCode = 0
  } else if (options.unknown.length > 0) {
    process.stderr.write(`无法识别或缺少取值的参数: ${options.unknown.join(' ')}\n\n${usage()}\n`)
    process.exitCode = 2
  } else {
    const use = String(options.use ?? '').trim().toLowerCase()
    if (!USES.includes(use)) {
      process.stderr.write(`--use 取值非法: ${options.use}（允许 ${USES.join(' / ')}）\n\n${usage()}\n`)
      process.exitCode = 2
    } else {
      const result = checkLicenses({ dir: options.dir, use, prodOnly: options.prodOnly, strict: options.strict })
      if (result.code === 2) {
        process.stderr.write(`${result.message ?? '检查失败'}\n`)
        process.exitCode = 2
      } else if (options.json) {
        process.stdout.write(`${renderJson(result, { strict: options.strict })}\n`)
        process.exitCode = result.code
      } else if (options.rows) {
        process.stdout.write(`${renderRows(result)}\n`)
        process.exitCode = result.code
      } else {
        process.stdout.write(`${renderText(result, { prodOnly: options.prodOnly, strict: options.strict })}\n`)
        process.exitCode = result.code
      }
    }
  }
}
