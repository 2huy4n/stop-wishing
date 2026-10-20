import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

function cli(args) {
  return spawnSync(process.execPath, ['scripts/check-hardcode.js', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 20000,
  })
}

function fixture(name, files) {
  const dir = mkdtempSync(join(tmpdir(), `sw-hc-${name}-`))
  for (const [file, content] of Object.entries(files)) writeFileSync(join(dir, file), content, 'utf8')
  return dir
}

test('修复：年份文本（如 2024 年）不算魔法数字，但代码里的 2024 仍然算', () => {
  const docDir = fixture('year-doc', { 'doc.md': '发布于 2024 年 10 月，维护到 2026 年度。\n' })
  const doc = cli(['--path', docDir])
  assert.equal(doc.status, 0, doc.stdout + doc.stderr)

  const codeDir = fixture('year-code', { 'sample.js': 'spend(2024)\n' })
  const code = cli(['--path', codeDir])
  assert.equal(code.status, 2, '代码里的 2024 不能被当成年份放过')
  assert.match(code.stdout, /:magic-number:/)
})

test('check-hardcode：干净样例 exit 0，且不误报阈值以下的数字', () => {
  const dir = fixture('clean', { 'sample.js': ['const retries = 2', 'const ratio = 0.5', 'export { retries, ratio }', ''].join('\n') })
  const out = cli(['--path', dir])
  assert.equal(out.status, 0, out.stdout + out.stderr)
  assert.match(out.stdout, /命中 0 处/)
})

test('check-hardcode：脏样例 exit 2，五类都能命中', () => {
  const dir = fixture('dirty', {
    'sample.js': [
      'const home = "C:\\\\Users\\\\demo\\\\project"',
      'const key = "sk-abcdefghijklmnopqrstuvwxyz123456"',
      'const endpoint = "https://example.com/api/v1"',
      'const port = 8080',
      'configure({ timeout: 5000 })',
      '',
    ].join('\n'),
  })
  const out = cli(['--path', dir])
  assert.equal(out.status, 2, out.stdout + out.stderr)
  for (const type of ['abs-path', 'secret', 'url', 'port', 'magic-number']) {
    assert.match(out.stdout, new RegExp(`:${type}:`), `缺少 ${type} 命中`)
  }
  assert.match(out.stdout, /sample\.js:1:abs-path:/)
})

test('check-hardcode：--threshold 改变魔法数字判据', () => {
  const dir = fixture('threshold', { 'sample.js': 'const options = { budget: 500 }\n' })
  assert.equal(cli(['--path', dir]).status, 0, '默认 1000 时 500 不算魔法数字')
  assert.equal(cli(['--path', dir, '--threshold', '100']).status, 2, '阈值 100 时 500 命中')
})

test('修复：含空格的路径按整行输出，不再被截成 C:/Program', () => {
  const dir = fixture('space', { 'sample.js': 'const config = "C:/Program Files/My App/config.json"\n' })
  const out = cli(['--path', dir])
  assert.equal(out.status, 2)
  assert.match(out.stdout, /Program Files/)
  assert.doesNotMatch(out.stdout, /C:\/Program:/)
})

test('.hardcodeignore：带理由的条目可抑制命中，输出区分已抑制/未抑制', () => {
  const dir = fixture('ignore-ok', {
    'sample.js': 'const endpoint = "https://example.com/api/v1"\n',
    '.hardcodeignore': 'sample.js : url : 这是文档里的示例地址\n',
  })
  const out = cli(['--path', dir])
  assert.equal(out.status, 0, out.stdout + out.stderr)
  assert.match(out.stdout, /\[已抑制\].*url/)
  assert.match(out.stdout, /已抑制 1，未抑制 0/)
})

test('.hardcodeignore：只抑制指定类型，其他类型仍报错', () => {
  const dir = fixture('ignore-type', {
    'sample.js': ['const endpoint = "https://example.com/api/v1"', 'configure({ timeout: 5000 })', ''].join('\n'),
    '.hardcodeignore': 'sample.js : url : 示例地址\n',
  })
  const out = cli(['--path', dir])
  assert.equal(out.status, 2, '剩下 magic-number 应导致失败')
  assert.match(out.stdout, /已抑制 1，未抑制 1/)
})

test('.hardcodeignore：缺少理由的条目被拒绝（exit 2 并报错）', () => {
  const dir = fixture('ignore-bad', {
    'sample.js': 'configure({ timeout: 5000 })\n',
    '.hardcodeignore': 'sample.js : magic-number\n',
  })
  const out = cli(['--path', dir])
  assert.equal(out.status, 2)
  assert.match(out.stderr, /缺少理由/)
})

test('.hardcodeignore：以 * 抑制全部类型', () => {
  const dir = fixture('ignore-star', {
    'sample.js': ['const endpoint = "https://example.com/api/v1"', 'configure({ timeout: 5000 })', ''].join('\n'),
    '.hardcodeignore': 'sample.js : * : 冒烟样例整份忽略\n',
  })
  const out = cli(['--path', dir])
  assert.equal(out.status, 0, out.stdout + out.stderr)
  assert.match(out.stdout, /已抑制 2，未抑制 0/)
})
