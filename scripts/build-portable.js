#!/usr/bin/env node
// 2026-10-20T19:04+08:00 · 改动：portable 不再重复 §9（正文已有，改为单列的速查块）、头部措辞对齐实际内容；原因：QA F2/F17；回滚：git checkout pre-qa-fix-20261020-1849
//
// 为什么要便携版：很多编辑器（或同事）只会读一个 md 文件，不会点进 templates/ 与 scripts/；
// 把「必须记住的几条」压成一页，才可能被真的用起来。
// 注意：正文本身已经完整包含 §9，所以这里只**摘出要点**做速查块，不再复述整节。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stamp } from './check-env.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export function stripFrontMatter(markdown) {
  const text = markdown.replace(/^\uFEFF/, '')
  if (!text.startsWith('---')) return text
  const end = text.indexOf('\n---', 3)
  if (end === -1) return text
  const after = text.indexOf('\n', end + 4)
  return after === -1 ? '' : text.slice(after + 1)
}

export function extractSection(markdown, heading) {
  const start = markdown.indexOf(heading)
  if (start === -1) return ''
  const next = markdown.indexOf('\n## ', start + heading.length)
  return next === -1 ? markdown.slice(start) : markdown.slice(start, next + 1)
}

/** 从 §9 里摘出「- **xxx**：…」这类要点行（去掉编号列表与解释段）。 */
export function condenseHardRules(section) {
  return section
    .split(/\r?\n/)
    .filter(line => /^\s*-\s+\*\*/.test(line))
    .map(line => line.replace(/^\s*-\s+/, '- '))
}

export const SCRIPT_USAGE = `## 脚本用法（零依赖，Node.js）

\`\`\`bash
# 1) 体检：git / bash / node / 是否 git 仓库；退出码 0 就绪，1 缺关键项
node scripts/check-env.js

# 2) 初始化 7 份项目文档（中/英，含 LICENSES.md）：退出码 0 成功，1 参数错误或已存在（无 --force），2 模板缺失
node scripts/init-docs.js --lang zh --dir .

# 3) 扫硬编码：绝对路径/密钥/URL/端口/魔法数字；支持 .hardcodeignore（glob : 类型 : 理由）
#    退出码 0 干净（或全部被抑制），2 有未抑制命中 / .hardcodeignore 非法
node scripts/check-hardcode.js --path . --threshold 1000

# 4) 复制到用户级 skills 目录（默认不覆盖）
node install.js --dry-run
node install.js --claude

# 5) 重新生成本文件
node scripts/build-portable.js
\`\`\`
`

export function buildPortable(root = ROOT) {
  const skillPath = join(root, 'SKILL.md')
  if (!existsSync(skillPath)) return { ok: false, code: 2, message: 'SKILL.md 不存在: ' + skillPath }
  const markdown = readFileSync(skillPath, 'utf8')
  const body = stripFrontMatter(markdown).trim()
  const hardRules = condenseHardRules(extractSection(body, '## 9) 硬约束'))
  const header = [
    '# stop-wishing · 便携版（正文全文 + 硬约束速查 + 脚本用法）',
    '',
    '> 生成于 ' + stamp() + '，来源 `SKILL.md`（重新生成：`node scripts/build-portable.js`）。',
    '> 本文件 = SKILL.md 正文全文（含 §9）+ 下方速查块 + 脚本用法；完整细节仍在 SKILL.md。',
    '',
  ].join('\n')
  const quick = ['## 硬约束速查（摘自 §9，正文里已有完整版）', '', ...hardRules, ''].join('\n')
  const content = [header, body, '', '---', '', quick, '---', '', SCRIPT_USAGE].join('\n')
  const outDir = join(root, 'portable')
  const out = join(outDir, 'stop-wishing.md')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(out, content, 'utf8')
  return { ok: true, code: 0, out, bytes: Buffer.byteLength(content, 'utf8'), quickRules: hardRules.length }
}

if (process.argv[1]?.endsWith('build-portable.js')) {
  const result = buildPortable()
  if (result.ok) process.stdout.write(`已生成 ${result.out}（${result.bytes} B，速查 ${result.quickRules} 条）\n`)
  else process.stderr.write(result.message + '\n')
  process.exitCode = result.code
}
