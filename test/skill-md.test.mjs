import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SKILLS_DIR = join(ROOT, 'skills')
const SKILL_NAMES = ['stop-wishing', 'stop-wishing-review', 'stop-wishing-audit', 'stop-wishing-debt', 'stop-wishing-spec', 'stop-wishing-tickets', 'stop-wishing-setup', 'stop-wishing-report']
const REFS = ['CARD.md', 'EVIDENCE.md', 'LICENSE.md', 'DECISIONS.md', 'GLOSSARY.md']

function readSkill(name) {
  return readFileSync(join(SKILLS_DIR, name, 'SKILL.md'), 'utf8')
}

function readRef(name) {
  return readFileSync(join(SKILLS_DIR, 'stop-wishing', name), 'utf8')
}

function frontMatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text)
  assert.ok(match, 'SKILL.md 必须有 front-matter')
  const fields = {}
  const lines = match[1].split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const kv = /^([a-zA-Z-]+):\s*(.*)$/.exec(lines[i])
    if (!kv) continue
    const [, key, raw] = kv
    if (['>-', '>', '|-', '|'].includes(raw)) {
      const parts = []
      let j = i + 1
      while (j < lines.length && (/^\s+/.test(lines[j]) || lines[j].trim() === '')) {
        parts.push(lines[j].trim())
        j++
      }
      fields[key] = parts.join(' ').trim()
      i = j - 1
    } else {
      fields[key] = raw
    }
  }
  return fields
}

test('八个技能目录都存在，且各有 SKILL.md', () => {
  for (const name of SKILL_NAMES) {
    assert.equal(existsSync(join(SKILLS_DIR, name, 'SKILL.md')), true, `缺 skills/${name}/SKILL.md`)
  }
})

for (const name of SKILL_NAMES) {
  test(`${name}：front-matter 合规（name 与目录名一致、description 中英双语）`, () => {
    const text = readSkill(name)
    const fields = frontMatter(text)
    assert.equal(fields.name, name, 'name 必须与目录名完全一致')
    assert.match(fields.name, /^[a-z0-9]+(-[a-z0-9]+)*$/, 'name 必须是 kebab-case')
    assert.equal(fields['user-invocable'], 'true')
    assert.ok(fields.description && fields.description.length > 20, 'description 必填')
    const englishPart = fields.description.split('中文触发词')[0].trim()
    assert.ok(englishPart.length > 20 && /^[A-Za-z]/.test(englishPart), 'description 要先有英文说明')
    assert.match(fields.description, /[\u4e00-\u9fff]/, 'description 要带中文触发词')
    assert.ok(fields.description.includes(name), 'description 要包含技能名')
  })
}

const MAIN = readSkill('stop-wishing')

test('主技能：不超过 60 行，只做路由 + 判断层', () => {
  const lines = MAIN.split(/\r?\n/).length
  assert.ok(lines <= 60, `SKILL.md 必须 ≤60 行，当前 ${lines}`)
  assert.match(MAIN, /^## Route to details/m)
  assert.match(MAIN, /^## Scripts/m)
})

test('review：60 行路由 + 三个按需参考文件', () => {
  const text = readSkill('stop-wishing-review')
  assert.ok(text.split(/\r?\n/).length <= 60, 'review SKILL.md 必须 ≤60 行')
  for (const ref of ['INTENT.md', 'ENGINEERING.md', 'REPORT.md']) {
    assert.equal(existsSync(join(SKILLS_DIR, 'stop-wishing-review', ref)), true, `缺 ${ref}`)
  }
  const route = /## 2\) Route to details\r?\n([\s\S]*?)\r?\n## 3\)/.exec(text)?.[1] ?? ''
  for (const ref of ['INTENT.md', 'ENGINEERING.md', 'REPORT.md']) {
    assert.match(route, new RegExp(`\\| .*${ref.replace('.', '\\.')}.*\\|`), `路由表缺 ${ref}`)
  }
  assert.match(text, /Read `INTENT\.md` and `ENGINEERING\.md` before forming findings; read `REPORT\.md` before planning the run and before writing\./)
})

test('主技能：七步循环与硬规则仍在正文', () => {
  for (const step of ['Clarify', 'Card', 'Search', 'Explain first', 'Back up', 'Minimal diff', 'Verify', 'Close']) {
    assert.ok(MAIN.includes(step), `工作循环缺: ${step}`)
  }
  for (const rule of ['No guessing', 'No scope creep', 'No hardcoding', 'Irreversible', 'Explain before code', 'Evidence or it didn', 'Licence gate', 'Failure: max 3 attempts', 'Never cut']) {
    assert.ok(MAIN.includes(rule), `硬规则缺: ${rule}`)
  }
  assert.match(MAIN, /Skipped \/ Unverified \/ Risk/)
})

test('主技能：许可判断层没有被完全删除', () => {
  assert.match(MAIN, /A unsure \/ B self \/ C free closed \/ D open source \/ E commercial/)
  assert.match(MAIN, /vague → commercial/)
  assert.match(MAIN, /GPL\/AGPL\/LGPL are forbidden/)
  assert.match(MAIN, /docs\/LICENSES\.md/)
})

test('主技能：preflight 契约与退出码语义', () => {
  assert.match(MAIN, /node scripts\/preflight\.js/)
  assert.match(MAIN, /0 clear, 1 blocking, 2 bad input\/IO/)
  assert.match(MAIN, /exit 2 is not danger|`exit 2` is not danger/)
})

test('主技能：五个参考文件都存在，且都在路由表里', () => {
  for (const ref of REFS) {
    assert.equal(existsSync(join(SKILLS_DIR, 'stop-wishing', ref)), true, `缺参考文件: ${ref}`)
    assert.ok(MAIN.includes(ref), `路由表没有指向 ${ref}`)
  }
})

test('CARD.md：三档、七字段、假设、AGENTS.md、只 offer 一次', () => {
  const text = readRef('CARD.md')
  for (const tier of ['**Light**', '**Medium**', '**Heavy**']) assert.ok(text.includes(tier), `缺档位 ${tier}`)
  for (const field of ['Goal', 'Users and scenario', 'Input/output', 'Scope and boundaries', 'Acceptance', 'Constraints', 'Delivery form']) {
    assert.ok(text.includes(field), `需求卡缺字段: ${field}`)
  }
  assert.match(text, /explicitly not done/)
  assert.match(text, /Assumptions/)
  assert.match(text, /Open questions/)
  assert.match(text, /AGENTS\.md/)
  assert.match(text, /offer the next step \*\*once\*\*/)
})

test('EVIDENCE.md：证据表、三次失败、收尾三行', () => {
  const text = readRef('EVIDENCE.md')
  assert.match(text, /\| Assertion \| Evidence \| Source \|/)
  assert.match(text, /No evidence → write "unverified" or "unknown"/)
  assert.match(text, /Max 3 attempts per problem/)
  assert.match(text, /stop and escalate/)
  assert.match(text, /Skipped: <what was not done>\. Unverified: <what was not tested>\. Risk:/)
})

test('LICENSE.md：五选项、矩阵、LGPL、自有代码例外、覆盖范围', () => {
  const text = readRef('LICENSE.md')
  assert.match(text, /\*\*A\*\* — not sure/)
  assert.match(text, /No or vague answer → commercial closed-source/)
  const rows = text.split(/\r?\n/).filter(line => line.startsWith('| '))
  const whitelist = rows.find(line => line.includes('MIT / Apache-2.0 / BSD / ISC / 0BSD / Unlicense / CC0'))
  assert.ok(whitelist, '缺白名单行')
  assert.equal((whitelist.match(/✅/g) ?? []).length, 4, '白名单四个场景都应可用')
  const gpl = rows.find(line => line.startsWith('| GPL / AGPL |'))
  assert.ok(gpl && gpl.includes('| ❌ |') && gpl.endsWith('❌ viral, always refused |'), 'GPL/AGPL 免费闭源与商用闭源都应拒绝')
  const lgpl = rows.find(line => line.startsWith('| LGPL |'))
  assert.ok(lgpl && /❌ always refused/.test(lgpl), 'LGPL 商用闭源必须拒绝')
  const none = rows.find(line => line.startsWith('| No LICENSE |'))
  assert.ok(none && /self-use only/.test(none), '缺 No LICENSE 行')
  assert.match(text, /LGPL strict/)
  for (const word of ['code dependencies', 'fonts', 'icons/images', 'third-party API terms', 'template/sample snippets']) {
    assert.ok(text.includes(word), `覆盖范围缺: ${word}`)
  }
  assert.match(text, /Own-code exception/)
  assert.match(text, /author statement/)
  assert.match(text, /does not spread/)
})

test('DECISIONS.md：默认值、冲突顺序、Never cut', () => {
  const text = readRef('DECISIONS.md')
  assert.match(text, /one recommendation/)
  assert.match(text, /not a failed question/)
  const order = ['Safety / irreversible risk', 'Explicit user instruction', 'Evidence', 'Minimal diff', 'Reuse', 'Beauty / consistency']
  let last = -1
  for (const item of order) {
    const index = text.indexOf(item)
    assert.ok(index > last, `冲突裁决顺序不对: ${item}`)
    last = index
  }
  assert.match(text, /Never cut/)
  for (const item of ['validation', 'error handling that prevents data loss', 'security', 'accessibility', 'hardware calibration']) {
    assert.ok(text.includes(item), `Never cut 缺: ${item}`)
  }
})

test('GLOSSARY.md：术语表、147 条、深链、缺失再联网', () => {
  const text = readRef('GLOSSARY.md')
  for (const term of ['API', 'Dependency', 'Refactor', 'Deploy', 'Idempotent', 'Git', 'Env variable', 'Rollback', 'Viral license', 'Dynamic linking', 'Derivative work', 'Regression test']) {
    assert.ok(text.includes(`| ${term} |`), `术语表缺: ${term}`)
  }
  assert.match(text, /147 entries/)
  assert.match(text, /#term-/)
  assert.match(text, /web search/)
  assert.match(text, /Never dump the glossary/)
})

test('审查技能：两轴（Intent / Engineering）、六维、12 条坏味道、并行与串行降级、输出格式', () => {
  const reviewDir = join(SKILLS_DIR, 'stop-wishing-review')
  const text = ['SKILL.md', 'INTENT.md', 'ENGINEERING.md', 'REPORT.md']
    .map(file => readFileSync(join(reviewDir, file), 'utf8'))
    .join('\n')
  for (const dim of ['Bug', 'Risk', 'Scale', 'Missing test', 'Speed', 'Lean']) assert.ok(text.includes(dim), `审查缺维度: ${dim}`)
  assert.match(text, /Intent/)
  assert.match(text, /Engineering/)
  assert.match(text, /docs\/project\.md/)
  assert.match(text, /docs\/specs\//, '审查应先找 stop-wishing-spec 写的规格')
  assert.match(text, /card_sha256/, '审查应读取规格的卡片哈希')
  assert.match(text, /Spec drift/, '审查应报告卡片漂移')
  assert.match(text, /Scope creep/)
  assert.match(text, /Looks done, is wrong/)
  const smells = ['Mysterious Name', 'Duplicated Code', 'Repeated Switches', 'Feature Envy', 'Data Clumps', 'Message Chains', 'Primitive Obsession', 'Speculative Generality', 'Refused Bequest', 'Middle Man', 'Shotgun Surgery', 'Divergent Change']
  for (const smell of smells) assert.ok(text.includes(smell), `缺坏味道: ${smell}`)
  assert.match(text, /sub-agent/i)
  assert.match(text, /Not parallel: sub-agent tool unavailable/)
  assert.match(text, /Spec source:/)
  assert.match(text, /Read-only/)
  assert.match(text, /diff[\s\S]*caller[\s\S]*tests[\s\S]*docs/i)
  assert.match(text, /grep`? \*\*all\*\* callers|grep.*all.*callers/i)
  assert.match(text, /assumed load/)
  assert.match(text, /Check before you report/i)
  assert.match(text, /No concrete trigger scenario/)
  assert.match(text, /shortcut:` comment is a \*\*recorded decision/)
  assert.match(text, /What this change does:/)
  for (const group of ['Must fix', 'Should fix', 'Nice to have']) assert.ok(text.includes(group), `缺分组 ${group}`)
  for (const part of ['What this is:', 'Problem:', 'Fix:', 'If we skip it:']) assert.ok(text.includes(part), `缺四段 ${part}`)
  assert.match(text, /Verdict:/)
  assert.match(text, /Lean: -N lines possible/)
  assert.match(text, /Not checked:/)
  assert.match(text, /Spec source: none/)
  assert.match(text, /Intent: no spec available — not reviewed/)
  assert.match(text, /drift — provisional/)
  assert.match(text, /draft — provisional/)
  assert.match(text, /drift \+ draft — provisional/)
  assert.match(text, /Skipped: <what was not reviewed>/)
})

test('审计技能：先测绘、主流程、最多 20 条、输出格式', () => {
  const text = readSkill('stop-wishing-audit')
  assert.match(text, /Read-only/)
  for (const item of ['README', 'Build and deploy', 'Dependencies', 'Entry points', 'Tests', 'Assumed load']) {
    assert.ok(text.includes(item), `测绘缺: ${item}`)
  }
  for (const flow of ['Money', 'Authentication', 'Data writes', 'Background jobs', 'Cross-process shared state']) {
    assert.ok(text.includes(flow), `主流程缺: ${flow}`)
  }
  for (const dim of ['Bug', 'Risk', 'Scale', 'Missing test', 'Speed', 'Lean']) assert.ok(text.includes(dim), `审计缺维度: ${dim}`)
  assert.match(text, /at most 20 findings/i)
  assert.match(text, /Omitted: N further findings/)
  assert.match(text, /What this repo does:/)
  for (const part of ['What this is:', 'Problem:', 'Fix:', 'If we skip it:']) assert.ok(text.includes(part), `缺四段 ${part}`)
  assert.match(text, /Verdict:/)
  assert.match(text, /Lean: -N lines possible/)
  assert.match(text, /Not checked:/)
  assert.match(text, /Skipped: <what was not audited>/)
})

test('债务技能：grep 命令、输出格式、计数结尾、只读', () => {
  const text = readSkill('stop-wishing-debt')
  assert.match(text, /Read-only/)
  assert.ok(text.includes("git grep --no-index --exclude-standard -nE '(#|//|/[*]) ?(shortcut|ponytail):'"), 'grep 命令必须逐字保留')
  assert.match(text, /keyboard shortcut/)
  assert.ok(text.includes('<file>:<line>, <what was simplified>. ceiling: <limit>. upgrade: <trigger>.'))
  assert.ok(text.includes('upgrade: no-trigger'))
  assert.ok(text.includes('<N> markers, <M> with no trigger.'))
})

test('每个技能都有 agents/openai.yaml（display_name + short_description）', () => {
  for (const name of SKILL_NAMES) {
    const file = join(SKILLS_DIR, name, 'agents', 'openai.yaml')
    assert.equal(existsSync(file), true, `缺 ${name}/agents/openai.yaml`)
    const text = readFileSync(file, 'utf8')
    assert.match(text, /display_name:\s*".+"/, `${name} 缺 display_name`)
    assert.match(text, /short_description:\s*".+"/, `${name} 缺 short_description`)
  }
})

test('技能互引：setup 用完整名字提到 stop-wishing-debt', () => {
  assert.match(readSkill('stop-wishing-setup'), /stop-wishing-debt/)
})
