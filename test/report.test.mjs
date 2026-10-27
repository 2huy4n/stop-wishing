import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { parseConfig, validateReport } from '../skills/stop-wishing-report/render.js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const CLI = join(ROOT, 'skills', 'stop-wishing-report', 'render.js')
const SAMPLE = join(ROOT, 'skills', 'stop-wishing-report', 'examples', 'delivery.json')

function run(args, cwd = ROOT) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30000,
  })
}

function temp() {
  return mkdtempSync(join(tmpdir(), 'sw-report-'))
}

function renderIn(root, data = SAMPLE) {
  return run(['--data', data, '--root', root])
}

test('parseConfig：true/false、注释、缺键与非法值', () => {
  assert.deepEqual(parseConfig('hacker_mode = true').hackerMode, true)
  assert.deepEqual(parseConfig('# comment\nhacker_mode = false').hackerMode, false)
  const invalid = parseConfig('hacker_mode = yes')
  assert.equal(invalid.hackerMode, false)
  assert.match(invalid.warnings.join('\n'), /只能是 true\/false/)
  const missing = parseConfig('# only comments')
  assert.equal(missing.hackerMode, false)
  assert.match(missing.warnings.join('\n'), /缺少 hacker_mode/)
})

test('validateReport：缺字段与非法 type 抛出明确错误', () => {
  assert.throws(() => validateReport({}), /缺少必填字段/)
  const sample = JSON.parse(readFileSync(SAMPLE, 'utf8'))
  assert.throws(() => validateReport({ ...sample, type: 'other' }), /type/)
  assert.throws(() => validateReport({ ...sample, id: '../x' }), /id/)
})

test('默认 false：只生成 simple HTML + Markdown，不生成 hacker', () => {
  const root = temp()
  try {
    const out = renderIn(root)
    assert.equal(out.status, 0, out.stdout + out.stderr)
    const html = join(root, 'reports', '2026-10-27-license-gate-simple.html')
    const md = join(root, 'reports', '2026-10-27-license-gate-simple.md')
    assert.equal(existsSync(html), true)
    assert.equal(existsSync(md), true)
    assert.equal(existsSync(join(root, 'reports', '2026-10-27-license-gate-hacker.html')), false)
    const text = readFileSync(html, 'utf8')
    assert.match(text, /data-theme="simple"/)
    assert.match(text, /给交付加一道许可证闸门/)
    assert.match(text, /证据/)
    assert.doesNotMatch(text, /data-theme="hacker"/)
    assert.match(out.stdout, /主题: simple/)
    assert.equal(readFileSync(join(root, 'report.conf'), 'utf8').includes('hacker_mode = false'), true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('配置 true：只生成 hacker HTML，不生成 Markdown', () => {
  const root = temp()
  try {
    writeFileSync(join(root, 'report.conf'), 'hacker_mode = true\n', 'utf8')
    const out = renderIn(root)
    assert.equal(out.status, 0, out.stdout + out.stderr)
    const html = join(root, 'reports', '2026-10-27-license-gate-hacker.html')
    assert.equal(existsSync(html), true)
    assert.equal(existsSync(join(root, 'reports', '2026-10-27-license-gate-hacker.md')), false)
    const text = readFileSync(html, 'utf8')
    assert.match(text, /data-theme="hacker"/)
    assert.match(text, /NODE E/)
    assert.doesNotMatch(text, /data-theme="simple"/)
    assert.match(out.stdout, /主题: hacker/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('非法配置：回落 simple 并警告，不猜 true', () => {
  const root = temp()
  try {
    writeFileSync(join(root, 'report.conf'), 'hacker_mode = yes\n', 'utf8')
    const out = renderIn(root)
    assert.equal(out.status, 0, out.stdout + out.stderr)
    assert.equal(existsSync(join(root, 'reports', '2026-10-27-license-gate-simple.html')), true)
    assert.match(out.stdout, /已回落 false/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('--init 创建配置；重复调用不覆盖', () => {
  const root = temp()
  try {
    const first = run(['--init', '--root', root])
    assert.equal(first.status, 0, first.stdout + first.stderr)
    assert.equal(existsSync(join(root, 'report.conf')), true)
    writeFileSync(join(root, 'report.conf'), '# custom\nhacker_mode = true\n', 'utf8')
    const second = run(['--init', '--root', root])
    assert.equal(second.status, 0)
    assert.match(second.stdout, /已存在，未修改/)
    assert.match(readFileSync(join(root, 'report.conf'), 'utf8'), /custom/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('坏 payload：exit 2，不写报告', () => {
  const root = temp()
  try {
    const bad = join(root, 'bad.json')
    writeFileSync(bad, '{"id":"x"}', 'utf8')
    const out = renderIn(root, bad)
    assert.equal(out.status, 2)
    assert.match(out.stderr, /report.json/)
    assert.equal(existsSync(join(root, 'reports')), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('缺少 --data：exit 2', () => {
  const out = run([])
  assert.equal(out.status, 2)
  assert.match(out.stderr, /--data/)
})

test('SKILL.md 不超过 60 行', () => {
  const lines = readFileSync(join(ROOT, 'skills', 'stop-wishing-report', 'SKILL.md'), 'utf8').trimEnd().split(/\r?\n/).length
  assert.ok(lines <= 60, `report SKILL.md 行数 ${lines} 超过 60`)
})

test('仓库内不出现禁用词（用码点构造，避免测试自身带入）', () => {
  const banned = String.fromCharCode(0x5609, 0x8c6a)
  const allowed = new Set(['.md', '.js', '.mjs', '.json', '.css', '.html', '.yaml', '.yml', '.txt', '.conf', '.tpl'])
  const skip = new Set(['.git', 'node_modules', 'reports'])
  const hits = []
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      if (skip.has(name)) continue
      const full = join(dir, name)
      const info = statSync(full)
      if (info.isDirectory()) walk(full)
      else if (allowed.has(extname(name)) && readFileSync(full, 'utf8').includes(banned)) hits.push(full)
    }
  }
  walk(ROOT)
  assert.deepEqual(hits, [], `禁用词出现在: ${hits.join(', ')}`)
})
