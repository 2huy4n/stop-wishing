import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { buildPortable } from '../scripts/build-portable.js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const OUT = join(ROOT, 'portable', 'stop-wishing.md')

function cli() {
  return spawnSync(process.execPath, ['scripts/build-portable.js'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 20000,
  })
}

test('build-portable：生成成功（exit 0）且产物存在', () => {
  const out = cli()
  assert.equal(out.status, 0, out.stderr)
  assert.equal(existsSync(OUT), true)
  assert.ok(readFileSync(OUT, 'utf8').length > 2000, '便携版不能是空壳')
})

test('F2：正文里的 `## 9) 硬约束` 恰好出现 1 次（不再重复整节）', () => {
  assert.equal(cli().status, 0)
  const text = readFileSync(OUT, 'utf8')
  const count = (text.match(/^## 9\) 硬约束/gm) ?? []).length
  assert.equal(count, 1, `期望 1 次，实际 ${count} 次`)
  assert.match(text, /## 硬约束速查/, '速查块应换成不带 §9 标题的形式')
})

test('F17：头部措辞与实际内容一致（正文全文 + 速查 + 脚本用法）', () => {
  assert.equal(cli().status, 0)
  const first = readFileSync(OUT, 'utf8').split(/\r?\n/)[0]
  assert.match(first, /正文全文/)
  assert.match(first, /硬约束速查/)
  assert.match(first, /脚本用法/)
})

test('build-portable：产物含关键段落', () => {
  assert.equal(cli().status, 0)
  const text = readFileSync(OUT, 'utf8')
  assert.match(text, /模糊度分档/)
  assert.match(text, /## 脚本用法/)
  assert.match(text, /check-env\.js/)
  assert.match(text, /install\.js/)
})

test('F6：SKILL.md 缺失时返回 2', () => {
  const empty = mkdtempSync(join(tmpdir(), 'sw-portable-missing-'))
  const result = buildPortable(empty)
  assert.equal(result.ok, false)
  assert.equal(result.code, 2)
  assert.match(result.message, /SKILL\.md 不存在/)
})
