#!/usr/bin/env node
// 2026-10-20T19:08+08:00 · 改动：支持 .hardcodeignore（glob : 类型 : 理由，理由必填）、输出区分已抑制/未抑制、命中片段改整行（修 C:/Program Files 被截断）；原因：QA 新增能力 + 缺陷修复；回滚：git checkout pre-qa-fix-20261020-1849
//
// 为什么不做成 ESLint：这个 skill 要用在任意语言的项目里（甚至一堆 .md 笔记），
// 一个零依赖、按行扫的检查器比引入整套 lint 工具更不容易把用户的仓库搞乱。
//
// .hardcodeignore 格式（每行一条，理由必填）：
//   <glob> : <类型> : <理由>
//   类型取 abs-path / secret / url / port / magic-number，或 * 表示全部
//   glob 里 * 任意多字符、? 单字符；不含 / 时按文件名匹配，含 / 时按相对路径匹配
//   没有理由的条目会被拒绝（整次检查报错退出），避免「一律忽略」变成掩盖。
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', 'coverage', '.cache', 'tmp', '.tmp'])
const TEXT_EXT = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json', '.md', '.txt', '.yml', '.yaml', '.sh', '.bash',
  '.ps1', '.py', '.go', '.rs', '.java', '.kt', '.c', '.h', '.cpp', '.hpp', '.css', '.html', '.toml', '.ini', '.env',
])
const MAX_BYTES = 1024 * 1024
const SNIPPET_MAX = 200
const TYPES = new Set(['abs-path', 'secret', 'url', 'port', 'magic-number'])
const DEFAULT_THRESHOLD = 1000

// 绝对路径：Windows 盘符 / POSIX 常见根 / 用户目录
const RE_ABS_WIN = /(^|[\s"'(=`])([A-Za-z]:[\\/][^\s"'`)]+)/
const RE_ABS_POSIX = /(^|[\s"'(=`])\/(Users|home|root|var|etc|opt|tmp|mnt|Volumes)\/[^\s"'`)]+/
// 密钥样式
const RE_SECRET = [
  /\bsk-[A-Za-z0-9_-]{16,}/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}/,
  /(api[_-]?key|secret|token|password|passwd)\s*[:=]\s*['"][^'"]{8,}['"]/i,
]
const RE_URL = /https?:\/\/[^\s"'`)<>]+/
const RE_PORT_LABEL = /\b(?:port|PORT)\b\s*[:=]\s*(\d{2,5})\b/
const RE_PORT_COLON = /(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{2,5})\b/
const RE_COMMENT = /^\s*(\/\/|#|\*|<!--|;)/

function isTextFile(file) {
  const ext = extname(file).toLowerCase()
  if (TEXT_EXT.has(ext)) return true
  return ext === ''
}

function* walk(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      yield* walk(full)
    } else if (entry.isFile()) {
      // 抑制清单自己不是被检查对象（它的理由文本里会出现阈值等数字）。
      if (entry.name === '.hardcodeignore') continue
      try {
        if (statSync(full).size > MAX_BYTES) continue
      } catch {
        continue
      }
      if (isTextFile(full)) yield full
    }
  }
}

/** 一行里找魔法数字：跳过日期、版本号、十六进制、颜色值、ISO 标准编号、以及行内注释里的数字。 */
function magicNumbers(line, threshold) {
  const hits = []
  const cleaned = line
    .replace(/\b\d{4}-\d{2}-\d{2}(?:T[\d:.+Z-]+)?\b/g, ' ') // 日期
    .replace(/\b(?:19|20)\d{2}\s*年(?:度)?/g, ' ') // 年份文本（如「2024 年」），不是可配置值
    .replace(/\bISO\s*\d{4,5}\b/g, ' ') // 标准编号如 ISO 8601，不是预算数字
    .replace(/\bv?\d+(?:\.\d+){2,}\b/g, ' ') // 版本号 1.2.3
    .replace(/\b0x[0-9a-fA-F]+\b/g, ' ') // 十六进制
    .replace(/#[0-9a-fA-F]{3,8}\b/g, ' ') // 颜色
  const commentAt = [line.indexOf('//'), line.indexOf('/*')].filter(index => index >= 0)
  const firstComment = commentAt.length > 0 ? Math.min(...commentAt) : Number.POSITIVE_INFINITY
  const re = /(?<![\w.-])(\d+(?:\.\d+)?)(?![\w.-])/g
  let match
  while ((match = re.exec(cleaned)) !== null) {
    const value = Number(match[1])
    if (!Number.isFinite(value)) continue
    if (Math.abs(value) < threshold) continue
    // 行内注释里的数字是说明文字，不是配置值。
    if (match.index >= firstComment) continue
    hits.push({ value, snippet: match[0], index: match.index })
  }
  return hits
}

/** 具名常量（const NAME = 1000）是「禁硬编码」推荐的写法，不该被当成魔法数字。 */
const RE_NAMED_CONSTANT = /^\s*(?:export\s+)?const\s+[A-Za-z_$][\w$]*\s*(?::[^=]+)?=\s*\d/

/** 把整行作为片段（修「C:/Program Files」被空格截断的问题），密钥段打码。 */
function lineSnippet(line) {
  let text = line.trim()
  for (const re of RE_SECRET) {
    text = text.replace(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'), match =>
      match.length > 12 ? match.slice(0, 4) + '***' : '***',
    )
  }
  return text.slice(0, SNIPPET_MAX)
}

export function scanFile(file, options) {
  const findings = []
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    return findings
  }
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const lineNo = i + 1
    const isComment = RE_COMMENT.test(line)
    const push = type => findings.push({ file, line: lineNo, type, snippet: lineSnippet(line) })

    if (RE_ABS_WIN.test(line) || RE_ABS_POSIX.test(line)) push('abs-path')
    if (RE_SECRET.some(re => re.test(line))) push('secret')
    if (RE_URL.test(line)) push('url')
    if (RE_PORT_LABEL.test(line) || RE_PORT_COLON.test(line)) push('port')
    if (!isComment && !RE_NAMED_CONSTANT.test(line) && magicNumbers(line, options.threshold).length > 0) push('magic-number')
  }
  return findings
}

function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const body = escaped.replace(/\*\*/g, '\u0000').replace(/\*/g, '.*').replace(/\u0000/g, '.*').replace(/\?/g, '.')
  return new RegExp('^' + body + '$')
}

export function loadIgnore(root) {
  const file = join(root, '.hardcodeignore')
  if (!existsSync(file)) return { rules: [], errors: [], file: null }
  const rules = []
  const errors = []
  const lines = readFileSync(file, 'utf8').split(/\r?\n/)
  lines.forEach((line, index) => {
    const text = line.trim()
    if (text === '' || text.startsWith('#')) return
    const parts = text.split(':')
    if (parts.length < 3) {
      errors.push(`.hardcodeignore 第 ${index + 1} 行缺少理由（格式：glob : 类型 : 理由）: ${text}`)
      return
    }
    const glob = parts[0].trim()
    const type = parts[1].trim()
    const reason = parts.slice(2).join(':').trim()
    if (!glob || !type || !reason) {
      errors.push(`.hardcodeignore 第 ${index + 1} 行不完整（glob / 类型 / 理由都必填）: ${text}`)
      return
    }
    if (type !== '*' && !TYPES.has(type)) {
      errors.push(`.hardcodeignore 第 ${index + 1} 行类型未知: ${type}`)
      return
    }
    rules.push({ glob, type, reason, matcher: globToRegExp(glob), line: index + 1 })
  })
  return { rules, errors, file }
}

function matches(rule, finding, root) {
  if (rule.type !== '*' && rule.type !== finding.type) return false
  const rel = relative(root, finding.file).split('\\').join('/')
  const base = rel.split('/').pop() ?? rel
  const candidate = rule.glob.includes('/') ? rel : base
  return rule.matcher.test(candidate)
}

export function parseArgs(argv) {
  const options = { path: process.cwd(), threshold: DEFAULT_THRESHOLD, help: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--path') {
      options.path = argv[i + 1] ?? options.path
      i += 1
    } else if (arg.startsWith('--path=')) options.path = arg.slice('--path='.length)
    else if (arg === '--threshold') {
      options.threshold = Number(argv[i + 1] ?? options.threshold)
      i += 1
    } else if (arg.startsWith('--threshold=')) options.threshold = Number(arg.slice('--threshold='.length))
  }
  if (!Number.isFinite(options.threshold) || options.threshold <= 0) options.threshold = DEFAULT_THRESHOLD
  return options
}

export function checkHardcode(options) {
  const root = resolve(options.path)
  let stat
  try {
    stat = statSync(root)
  } catch (error) {
    return { ok: false, code: 2, findings: [], suppressed: [], message: '路径不存在: ' + root, error: String(error.message ?? error) }
  }
  const ignore = loadIgnore(stat.isDirectory() ? root : resolve(root, '..'))
  if (ignore.errors.length > 0) {
    return {
      ok: false,
      code: 2,
      findings: [],
      suppressed: [],
      message: '配置文件有误，已中止：\n' + ignore.errors.map(item => '  - ' + item).join('\n'),
    }
  }
  const files = stat.isDirectory() ? [...walk(root)] : [root]
  const findings = []
  for (const file of files) findings.push(...scanFile(file, options))

  const suppressed = []
  const active = []
  for (const finding of findings) {
    const rule = ignore.rules.find(item => (item.type === '*' || item.type === finding.type) && matches(item, finding, root))
    if (rule) suppressed.push({ ...finding, reason: rule.reason })
    else active.push(finding)
  }
  return {
    ok: active.length === 0,
    code: active.length === 0 ? 0 : 2,
    files: files.length,
    findings: active,
    suppressed,
    ignoredRules: ignore.rules.length,
    root,
  }
}

if (process.argv[1]?.endsWith('check-hardcode.js')) {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    process.stdout.write(
      [
        '用法: node scripts/check-hardcode.js [--path <目录或文件>] [--threshold <数字>]',
        '',
        '  --path      要扫的路径（默认当前目录；跳过 node_modules/.git/dist 等）',
        '  --threshold 魔法数字阈值（默认 1000；绝对值 >= 阈值才算命中）',
        '',
        '  .hardcodeignore（放在被扫目录根部）每行：glob : 类型 : 理由（理由必填，类型可写 *）',
        '',
        '输出: 文件:行:类型:整行片段；已抑制的命中带 [已抑制] 前缀；末尾给出总数与抑制数',
        '退出码: 0 干净（或全部被抑制）/ 2 有未抑制命中或 .hardcodeignore 非法',
      ].join('\n') + '\n',
    )
    process.exitCode = 0
  } else {
    const result = checkHardcode(options)
    if (result.message) {
      process.stderr.write(result.message + '\n')
      process.exitCode = result.code
    } else {
      for (const finding of result.findings) {
        process.stdout.write(`${finding.file}:${finding.line}:${finding.type}:${finding.snippet}\n`)
      }
      for (const finding of result.suppressed) {
        process.stdout.write(`[已抑制] ${finding.file}:${finding.line}:${finding.type}:${finding.snippet}（理由：${finding.reason}）\n`)
      }
      process.stdout.write(
        `扫描 ${result.files} 个文件，命中 ${result.findings.length + result.suppressed.length} 处（已抑制 ${result.suppressed.length}，未抑制 ${result.findings.length}）\n`,
      )
      process.exitCode = result.code
    }
  }
}
