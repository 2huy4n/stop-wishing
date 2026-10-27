#!/usr/bin/env node
// stop-wishing-report renderer. One payload, one selected theme, no dependencies.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SKILL_DIR = dirname(fileURLToPath(import.meta.url))
const CONFIG_NAME = 'report.conf'
const OUTPUT_DIR = 'reports'

export const DEFAULT_CONFIG = `# stop-wishing report config
# false = compact developer report (default)
# true  = hacker-themed report
hacker_mode = false
`

export function parseArgs(argv) {
  const options = { data: null, root: null, init: false, help: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--init') options.init = true
    else if (arg === '--data') {
      options.data = argv[i + 1] ?? null
      i += 1
    } else if (arg === '--root') {
      options.root = argv[i + 1] ?? null
      i += 1
    } else {
      throw new Error(`未知参数: ${arg}`)
    }
  }
  return options
}

export function parseConfig(text) {
  const warnings = []
  let hackerMode = false
  let found = false
  for (const raw of String(text).replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#') || line.startsWith(';')) continue
    const at = line.indexOf('=')
    if (at < 0) {
      warnings.push(`report.conf 忽略无法解析的行: ${line}`)
      continue
    }
    const key = line.slice(0, at).trim().toLowerCase()
    const value = line.slice(at + 1).trim().toLowerCase()
    if (key !== 'hacker_mode') {
      warnings.push(`report.conf 忽略未知配置: ${key}`)
      continue
    }
    found = true
    if (value === 'true') hackerMode = true
    else if (value === 'false') hackerMode = false
    else {
      warnings.push(`report.conf 的 hacker_mode 只能是 true/false，收到 "${value}"，已回落 false`)
      hackerMode = false
    }
  }
  if (!found) warnings.push('report.conf 缺少 hacker_mode，已回落 false')
  return { hackerMode, warnings }
}

export function readConfig(root) {
  const file = join(root, CONFIG_NAME)
  if (!existsSync(file)) {
    return { hackerMode: false, warnings: ['report.conf 不存在，已按 false 处理'], file, exists: false }
  }
  return { ...parseConfig(readFileSync(file, 'utf8')), file, exists: true }
}

export function ensureConfig(root) {
  const file = join(root, CONFIG_NAME)
  if (existsSync(file)) return { ...readConfig(root), created: false }
  writeFileSync(file, DEFAULT_CONFIG, 'utf8')
  return { hackerMode: false, warnings: [], file, exists: true, created: true }
}

const REQUIRED = ['id', 'type', 'title', 'summary', 'created_at', 'sections', 'evidence', 'risks', 'next', 'limits']

export function validateReport(data) {
  const fail = message => { throw new Error(`report.json: ${message}`) }
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('必须是对象')
  for (const key of REQUIRED) if (!(key in data)) fail(`缺少必填字段 ${key}`)
  if (typeof data.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(data.id)) fail('id 非法')
  if (!['prototype', 'delivery'].includes(data.type)) fail('type 必须是 prototype 或 delivery')
  for (const key of ['title', 'summary', 'created_at']) {
    if (typeof data[key] !== 'string' || data[key].trim() === '') fail(`${key} 不能为空`)
  }
  for (const [key, shape] of [['sections', 'object'], ['evidence', 'object'], ['risks', 'object'], ['next', 'object'], ['limits', 'string'], ['stats', 'object']]) {
    if (data[key] === undefined) continue
    if (!Array.isArray(data[key])) fail(`${key} 必须是数组`)
    for (const item of data[key]) {
      if (shape === 'string') {
        if (typeof item !== 'string' || item.trim() === '') fail(`${key} 的条目必须是非空字符串`)
      } else if (!item || typeof item !== 'object' || Array.isArray(item)) {
        fail(`${key} 的条目必须是对象`)
      }
    }
  }
  for (const section of data.sections) {
    if (typeof section.id !== 'string' || typeof section.title !== 'string') fail('section 需要 id 与 title')
    if (!['text', 'list', 'table', 'steps'].includes(section.kind)) fail(`section ${section.id} 的 kind 非法`)
  }
  for (const stat of data.stats ?? []) {
    if (typeof stat.label !== 'string' || typeof stat.value !== 'string') fail('stats 的条目需要 label 与 value 字符串')
  }
  for (const row of data.evidence) {
    if (typeof row.claim !== 'string' || typeof row.proof !== 'string') fail('evidence 的条目需要 claim 与 proof 字符串')
  }
  for (const risk of data.risks) {
    if (!['high', 'medium', 'low'].includes(risk.level)) fail(`risk ${risk.text ?? ''} 的 level 非法`)
    if (typeof risk.text !== 'string' || risk.text.trim() === '') fail('risk.text 不能为空')
  }
  for (const item of data.next) {
    if (typeof item.id !== 'string' || typeof item.title !== 'string') fail('next 需要 id 与 title')
  }
  return data
}

function outputNames(id) {
  const safe = id.replace(/[^A-Za-z0-9._-]/g, '-')
  return { html: safe, md: safe }
}

export async function run(argv, cwd = process.cwd()) {
  const options = parseArgs(argv)
  if (options.help) return { code: 0, text: '用法: node render.js --init | --data <report.json> [--root <项目根>]' }

  const root = resolve(options.root ?? cwd)
  if (options.init) {
    const config = ensureConfig(root)
    return {
      code: 0,
      text: config.created ? `已创建 ${join(root, CONFIG_NAME)}（hacker_mode = false）` : `${join(root, CONFIG_NAME)} 已存在，未修改`,
      config,
    }
  }
  if (!options.data) throw new Error('缺少 --data <report.json>')

  const dataPath = resolve(options.data)
  const data = validateReport(JSON.parse(readFileSync(dataPath, 'utf8')))
  const config = ensureConfig(root)
  const theme = config.hackerMode ? 'hacker' : 'simple'
  const themeDir = join(SKILL_DIR, 'themes', theme)
  const entry = join(themeDir, 'render.mjs')
  if (!existsSync(entry)) throw new Error(`主题缺失: ${theme}`)
  const module = await import(pathToFileURL(entry).href)
  if (typeof module.render !== 'function') throw new Error(`主题 ${theme} 没有导出 render()`)

  const result = await module.render(data)
  const outDir = join(root, OUTPUT_DIR)
  mkdirSync(outDir, { recursive: true })
  const names = outputNames(data.id)
  const htmlPath = join(outDir, `${names.html}-${theme}.html`)
  writeFileSync(htmlPath, result.html, 'utf8')
  let mdPath = null
  if (typeof result.markdown === 'string' && result.markdown.trim() !== '') {
    mdPath = join(outDir, `${names.md}-${theme}.md`)
    writeFileSync(mdPath, result.markdown, 'utf8')
  }
  return {
    code: 0,
    theme,
    config,
    htmlPath,
    mdPath,
    text: [
      `报告: ${htmlPath}`,
      ...(mdPath ? [`Markdown: ${mdPath}`] : []),
      `主题: ${theme}（report.conf: hacker_mode=${config.hackerMode}）`,
      ...(config.warnings.length > 0 ? [`警告: ${config.warnings.join('；')}`] : []),
    ].join('\n'),
  }
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isCli) {
  run(process.argv.slice(2)).then(result => {
    if (result.text) console.log(result.text)
    process.exitCode = result.code
  }).catch(error => {
    console.error(`错误: ${error.message}`)
    process.exitCode = 2
  })
}
