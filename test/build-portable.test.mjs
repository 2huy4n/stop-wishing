import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { buildPortable } from '../skills/stop-wishing/scripts/build-portable.js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const OUT = join(ROOT, 'portable', 'stop-wishing.md')

function cli() {
  return spawnSync(process.execPath, ['skills/stop-wishing/scripts/build-portable.js'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 20000,
  })
}

test('build-portable：从新路径生成成功（exit 0）且产物存在', () => {
  const out = cli()
  assert.equal(out.status, 0, out.stderr)
  assert.equal(existsSync(OUT), true)
  assert.ok(readFileSync(OUT, 'utf8').length > 2000, '便携版不能是空壳')
})

test('build-portable：正文里的 `## 9) Hard constraints` 恰好 1 次，速查块另起标题', () => {
  assert.equal(cli().status, 0)
  const text = readFileSync(OUT, 'utf8')
  const count = (text.match(/^## 9\) Hard constraints/gm) ?? []).length
  assert.equal(count, 1, `期望 1 次，实际 ${count} 次`)
  assert.match(text, /## Hard constraints quick reference/)
})

test('build-portable：头部说明全文 + 速查 + 脚本用法，并提到三个卫星技能', () => {
  assert.equal(cli().status, 0)
  const text = readFileSync(OUT, 'utf8')
  const first = text.split(/\r?\n/)[0]
  assert.match(first, /full text/i)
  assert.match(first, /hard-constraint quick reference/i)
  assert.match(first, /script usage/i)
  assert.match(text, /satellite skills/i)
})

test('build-portable：产物含关键段落与新脚本路径', () => {
  assert.equal(cli().status, 0)
  const text = readFileSync(OUT, 'utf8')
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
