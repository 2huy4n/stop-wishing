import assert from 'node:assert/strict'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { buildPortable } from '../skills/stop-wishing/scripts/build-portable.js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

/**
 * 在临时目录里复制一份 SKILL.md 再生成，避免测试写仓库的 portable/：
 * 生成结果带时间戳，直接写仓库会让工作区每次跑完测试都变脏。
 */
function buildInTemp() {
  const root = mkdtempSync(join(tmpdir(), 'sw-portable-'))
  mkdirSync(join(root, 'skills', 'stop-wishing'), { recursive: true })
  copyFileSync(join(ROOT, 'skills', 'stop-wishing', 'SKILL.md'), join(root, 'skills', 'stop-wishing', 'SKILL.md'))
  const result = buildPortable(root)
  assert.equal(result.ok, true, result.message)
  return readFileSync(join(root, 'portable', 'stop-wishing.md'), 'utf8')
}

test('build-portable：从新路径生成成功，产物不是空壳', () => {
  const text = buildInTemp()
  assert.ok(text.length > 2000, '便携版不能是空壳')
})

test('build-portable：正文里的 `## 9) Hard constraints` 恰好 1 次，速查块另起标题', () => {
  const text = buildInTemp()
  const count = (text.match(/^## 9\) Hard constraints/gm) ?? []).length
  assert.equal(count, 1, `期望 1 次，实际 ${count} 次`)
  assert.match(text, /## Hard constraints quick reference/)
})

test('build-portable：头部说明全文 + 速查 + 脚本用法，并提到卫星技能', () => {
  const text = buildInTemp()
  const first = text.split(/\r?\n/)[0]
  assert.match(first, /full text/i)
  assert.match(first, /hard-constraint quick reference/i)
  assert.match(first, /script usage/i)
  assert.match(text, /satellite skills/i)
})

test('build-portable：产物含关键段落与新脚本路径', () => {
  const text = buildInTemp()
  assert.match(text, /Wishing-driven programming/)
  assert.match(text, /## Script usage/)
  assert.match(text, /skills\/stop-wishing\/scripts\/check-env\.js/)
  assert.match(text, /install\.js/)
})

test('build-portable：SKILL.md 缺失时返回 2', () => {
  const empty = mkdtempSync(join(tmpdir(), 'sw-portable-missing-'))
  const result = buildPortable(empty)
  assert.equal(result.ok, false)
  assert.equal(result.code, 2)
  assert.match(result.message, /SKILL\.md not found/)
})
