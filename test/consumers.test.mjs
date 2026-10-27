import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

const CONSUMERS = {
  'stop-wishing-spec': ['docs/agents/domain.md'],
  'stop-wishing-tickets': ['docs/agents/issue-tracker.md', 'docs/agents/triage-labels.md'],
  'stop-wishing-review': ['docs/agents/issue-tracker.md'],
  'stop-wishing-audit': ['docs/agents/domain.md'],
  'stop-wishing-debt': ['docs/agents/domain.md'],
}

test('setup CONSUMERS.md 的五个读取关系都有实际 SKILL.md 引用', () => {
  for (const [skill, refs] of Object.entries(CONSUMERS)) {
    const text = readFileSync(join(ROOT, 'skills', skill, 'SKILL.md'), 'utf8')
    for (const ref of refs) {
      assert.ok(text.includes(ref), `${skill} 缺少 ${ref} 的读取说明`)
    }
  }
})

test('tickets 不把 issue tracker 当成 ticket 目录', () => {
  const text = readFileSync(join(ROOT, 'skills', 'stop-wishing-tickets', 'SKILL.md'), 'utf8')
  assert.match(text, /ticket files always stay in `docs\/tickets\/`/)
  assert.match(text, /issues are not tickets|Issues are not tickets/i)
})

test('无 docs/agents 时五个技能都有文档化回退', () => {
  const fallbacks = {
    'stop-wishing-spec': /GLOSSARY\.md/,
    'stop-wishing-tickets': /docs\/issues\//,
    'stop-wishing-review': /docs\/issues\//,
    'stop-wishing-audit': /GLOSSARY\.md[\s\S]*docs\/adr\//,
    'stop-wishing-debt': /GLOSSARY\.md[\s\S]*docs\/adr\//,
  }
  for (const [skill, pattern] of Object.entries(fallbacks)) {
    const text = readFileSync(join(ROOT, 'skills', skill, 'SKILL.md'), 'utf8')
    assert.match(text, pattern, `${skill} 缺少无配置回退`)
  }
})
