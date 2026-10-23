#!/usr/bin/env node
// 2026-10-23T12:20+08:00 · 改动：适配四技能结构——读取 skills/stop-wishing/SKILL.md，正文英文、§9 标题改为 Hard constraints；便携版仍只输出主技能并注明三个卫星技能；回滚：git checkout pre-split-20261023-1220
//
// 为什么要便携版：很多编辑器（或同事）只会读一个 md 文件，不会点进 templates/ 与 scripts/；
// 把「必须记住的几条」压成一页，才可能被真的用起来。
// 注意：正文本身已经完整包含 §9，所以这里只**摘出要点**做速查块，不再复述整节。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stamp } from './check-env.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

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

export const SCRIPT_USAGE = `## Script usage (zero dependencies, Node.js)

Run from the repository root:

\`\`\`bash
# 1) Readiness: git / bash / node / git repo; exit 0 ready, 1 missing a critical item
node skills/stop-wishing/scripts/check-env.js

# 2) Generate the 7 project docs (zh/en, including LICENSES.md); exit 0 OK, 1 bad args or exists, 2 template missing
node skills/stop-wishing/scripts/init-docs.js --lang zh --dir .

# 3) Scan hardcoding: absolute paths / secrets / URLs / ports / magic numbers; supports .hardcodeignore
#    exit 0 clean (or all suppressed), 2 unsuppressed hits or invalid ignore file
node skills/stop-wishing/scripts/check-hardcode.js --path . --threshold 1000

# 4) Install all four skills into a skills root (default: ~/.agents/skills)
node install.js --dry-run
node install.js --tool dsh --verify
node install.js --tool claude --verify

# 5) Regenerate this portable file
node skills/stop-wishing/scripts/build-portable.js
\`\`\`

Satellite skills are documented separately: \`skills/stop-wishing-review\`, \`skills/stop-wishing-audit\`, \`skills/stop-wishing-debt\`.
`

export function buildPortable(root = ROOT) {
  const skillPath = join(root, 'skills', 'stop-wishing', 'SKILL.md')
  if (!existsSync(skillPath)) return { ok: false, code: 2, message: 'SKILL.md not found: ' + skillPath }
  const markdown = readFileSync(skillPath, 'utf8')
  const body = stripFrontMatter(markdown).trim()
  const hardRules = condenseHardRules(extractSection(body, '## 9) Hard constraints'))
  const header = [
    '# stop-wishing · portable edition (full text + hard-constraint quick reference + script usage)',
    '',
    '> Generated ' + stamp() + ' from `skills/stop-wishing/SKILL.md` (regenerate: `node skills/stop-wishing/scripts/build-portable.js`).',
    '> This file = the full SKILL.md body (including §9) + the quick reference below + script usage.',
    '> The three satellite skills (review / audit / debt) are separate directories under `skills/`.',
    '',
  ].join('\n')
  const quick = ['## Hard constraints quick reference (condensed from §9; the body above is authoritative)', '', ...hardRules, ''].join('\n')
  const content = [header, body, '', '---', '', quick, '---', '', SCRIPT_USAGE].join('\n')
  const outDir = join(root, 'portable')
  const out = join(outDir, 'stop-wishing.md')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(out, content, 'utf8')
  return { ok: true, code: 0, out, bytes: Buffer.byteLength(content, 'utf8'), quickRules: hardRules.length }
}

if (process.argv[1]?.endsWith('build-portable.js')) {
  const result = buildPortable()
  if (result.ok) process.stdout.write(`Generated ${result.out} (${result.bytes} B, ${result.quickRules} quick rules)\n`)
  else process.stderr.write(result.message + '\n')
  process.exitCode = result.code
}
