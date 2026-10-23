import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SKILLS_DIR = join(ROOT, 'skills')
const SKILL_NAMES = ['stop-wishing', 'stop-wishing-review', 'stop-wishing-audit', 'stop-wishing-debt']

function readSkill(name) {
  return readFileSync(join(SKILLS_DIR, name, 'SKILL.md'), 'utf8')
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

test('六个技能目录都存在，且各有 SKILL.md', () => {
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

test('主技能：17 个章节齐全（原 13 章 + ponytail 4 项）', () => {
  const headings = [...MAIN.matchAll(/^## (\d+)\)/gm)].map(match => Number(match[1]))
  assert.deepEqual(headings, Array.from({ length: 17 }, (_, i) => i + 1))
})

test('主技能：定义、三类模糊、许愿句清单、非幻觉区分', () => {
  assert.match(MAIN, /Wishing-driven programming|wishing-driven programming/)
  assert.match(MAIN, /Not AI hallucination/)
  for (const word of ['Goal', 'Boundary', 'Acceptance']) assert.ok(MAIN.includes(word), `缺模糊类型: ${word}`)
  assert.match(MAIN, /Wishful phrases/)
  assert.match(MAIN, /whatever \/ you decide/)
})

test('主技能：用户画像、≤3 问、术语表至少 12 条', () => {
  assert.match(MAIN, /zero technical background/)
  assert.match(MAIN, /≤3 questions per round/)
  assert.match(MAIN, /A\/B\/C options/)
  const terms = ['API', 'Dependency', 'Refactor', 'Deploy', 'Idempotent', 'Git', 'Env variable', 'Rollback', 'Viral license', 'Dynamic linking', 'Derivative work', 'Regression test']
  for (const term of terms) {
    assert.ok(MAIN.includes(`| ${term} |`) || MAIN.includes(`| ${term} `), `术语表缺: ${term}`)
  }
})

test('主技能：模糊度三档 + 先报档位', () => {
  for (const tier of ['**Light**', '**Medium**', '**Heavy**']) assert.ok(MAIN.includes(tier), `缺档位 ${tier}`)
  assert.match(MAIN, /ambiguity, not change size/)
  assert.match(MAIN, /Report the tier and why first|report the tier and why/)
})

test('主技能：需求卡七字段 + 假设区 + 未决区', () => {
  for (const field of ['**Goal**', '**Users and scenario**', '**Input/output**', '**Scope and boundaries**', '**Acceptance**', '**Constraints**', '**Delivery form**']) {
    assert.ok(MAIN.includes(field), `需求卡缺字段: ${field}`)
  }
  assert.match(MAIN, /explicitly not done/)
  assert.match(MAIN, /Assumptions/)
  assert.match(MAIN, /Open questions/)
  assert.match(MAIN, /prototype/)
  assert.match(MAIN, /production/)
})

test('主技能：默认值规则（推荐值 + 理由 + 假设）', () => {
  assert.match(MAIN, /one recommendation/)
  assert.match(MAIN, /one plain reason/)
  assert.match(MAIN, /record it in Assumptions/)
  assert.match(MAIN, /not a failed question/)
})

test('主技能：许可证闸门五选项、默认商用闭源、完整矩阵', () => {
  assert.match(MAIN, /A\) not sure \/ B\) self-use \/ C\) free closed distribution \/ D\) open source \/ E\) commercial/)
  assert.match(MAIN, /No or vague answer → commercial closed-source/)
  const licenseRows = MAIN.split(/\r?\n/).filter(line => line.startsWith('| '))
  const rows = licenseRows.filter(line => line.includes('✅'))
  const whitelist = rows.find(line => line.includes('MIT / Apache-2.0 / BSD / ISC / 0BSD / Unlicense / CC0'))
  assert.ok(whitelist, '缺白名单行')
  assert.equal((whitelist.match(/✅/g) ?? []).length, 4, '白名单四个场景都应可用')
  const gpl = rows.find(line => line.startsWith('| GPL / AGPL |'))
  assert.ok(gpl, '缺 GPL/AGPL 行')
  assert.ok(gpl.includes('| ❌ |') && gpl.endsWith('❌ viral, always refused |'), 'GPL/AGPL 免费闭源与商用闭源都应拒绝')
  const lgpl = rows.find(line => line.startsWith('| LGPL |'))
  assert.ok(lgpl, '缺 LGPL 行')
  assert.match(lgpl, /❌ always refused/)
  const none = licenseRows.find(line => line.startsWith('| No LICENSE |'))
  assert.ok(none, '缺 No LICENSE 行')
  assert.match(none, /self-use only/)
  assert.match(MAIN, /LGPL strict/)
  assert.match(MAIN, /commercial closed-source always refused/)
})

test('主技能：许可证覆盖范围与自有代码例外三证据', () => {
  for (const word of ['code dependencies', 'fonts', 'icons/images', 'third-party API terms', 'template/sample snippets']) {
    assert.ok(MAIN.includes(word), `覆盖范围缺: ${word}`)
  }
  assert.match(MAIN, /Own-code exception/)
  assert.match(MAIN, /author statement/)
  assert.match(MAIN, /exact words/)
  assert.match(MAIN, /ISO 8601 \+ offset/)
  assert.match(MAIN, /does not spread/)
  assert.match(MAIN, /docs\/LICENSES\.md/)
})

test('主技能：九步工作循环（澄清→卡→搜索→先解释→备份→最小差异→验证→文档→汇报）', () => {
  for (const step of ['Clarify', 'Confirm the card', 'Search', 'Explain first', 'Back up', 'Minimal diff', 'Verify with evidence', 'Update docs', 'Report']) {
    assert.ok(MAIN.includes(step), `工作循环缺: ${step}`)
  }
  assert.match(MAIN, /pre-<change>-YYYYMMDD-HHmm/)
  assert.match(MAIN, /\.bak-YYYYMMDD-HHmm/)
  assert.match(MAIN, /wait for confirmation/i)
})

test('主技能：硬约束（禁硬编码、ISO 8601 本机时区、50%/300 行、搜索留痕、不可逆人批）', () => {
  assert.match(MAIN, /No hardcoding/)
  assert.match(MAIN, /absolute paths, secrets, magic numbers/)
  assert.match(MAIN, /machine's local UTC offset/)
  assert.match(MAIN, /\+09:00/)
  assert.match(MAIN, /50%/)
  assert.match(MAIN, /300 lines/)
  assert.match(MAIN, /Search trail/)
  assert.match(MAIN, /Irreversible needs human approval/)
  assert.match(MAIN, /File-header block/)
})

test('主技能：三列证据格式与 unknown', () => {
  assert.match(MAIN, /\| Assertion \| Evidence \| Source \|/)
  assert.match(MAIN, /No evidence → "unverified" or "unknown"/)
})

test('主技能：冲突裁决顺序', () => {
  const start = MAIN.indexOf('## 11) Conflict resolution')
  const end = MAIN.indexOf('## 12)', start)
  const section = MAIN.slice(start, end)
  const order = ['safety/irreversible risk', 'explicit user instruction', 'evidence', 'minimal diff', 'reuse', 'beauty/consistency']
  let last = -1
  for (const item of order) {
    const index = section.indexOf(item)
    assert.ok(index > last, `冲突裁决顺序不对: ${item}`)
    last = index
  }
})

test('主技能：失败最多 3 次后升级、逃生门仍先解释', () => {
  assert.match(MAIN, /Max 3 attempts per problem/)
  assert.match(MAIN, /stop and escalate/)
  assert.match(MAIN, /clarification skipped, risk accepted/)
  assert.match(MAIN, /Still explain first/)
  assert.match(MAIN, /Only the confirmation wait is waived/)
})

test('主技能（ponytail）：lite/full/ultra 三档严格度', () => {
  for (const level of ['**lite**', '**full**', '**ultra**']) assert.ok(MAIN.includes(level), `缺严格度 ${level}`)
  assert.match(MAIN, /stop-wishing lite\|full\|ultra/)
  assert.match(MAIN, /default \*\*full\*\*/)
})

test('主技能（ponytail）：收尾强制句、Never cut、卫星技能指针', () => {
  assert.match(MAIN, /Mandatory closing lines/)
  assert.match(MAIN, /Skipped: <what was not done>\. Unverified: <what was not tested>\. Risk:/)
  assert.match(MAIN, /Never cut/)
  for (const item of ['validation', 'error handling that prevents data loss', 'security', 'accessibility', 'hardware calibration']) {
    assert.ok(MAIN.includes(item), `Never cut 缺: ${item}`)
  }
  assert.match(MAIN, /stop-wishing-review/)
  assert.match(MAIN, /stop-wishing-audit/)
  assert.match(MAIN, /stop-wishing-debt/)
})

test('审查技能：两轴（Intent / Engineering）、六维、12 条坏味道、并行与串行降级、输出格式', () => {
  const text = readSkill('stop-wishing-review')
  for (const dim of ['Bug', 'Risk', 'Scale', 'Missing test', 'Speed', 'Lean']) assert.ok(text.includes(`**${dim}**`) || text.includes(dim), `审查缺维度: ${dim}`)
  assert.match(text, /Intent/)
  assert.match(text, /Engineering/)
  assert.match(text, /docs\/project\.md/)
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
