import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SCRIPT = join(ROOT, 'skills', 'stop-wishing', 'scripts', 'preflight.js')
const SCRIPT_URL = pathToFileURL(SCRIPT).href

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'sw-preflight-'))
}

function writeLock(dir, packages) {
  writeFileSync(join(dir, 'package-lock.json'), JSON.stringify({
    name: 'fixture',
    version: '1.0.0',
    lockfileVersion: 3,
    requires: true,
    packages: { '': { name: 'fixture', version: '1.0.0', license: 'MIT' }, ...packages },
  }, null, 2))
}

function runCli(args) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' })
  return { code: result.status, stdout: result.stdout, stderr: result.stderr }
}

test('preflight：空目录通过，许可证标记为跳过（exit 0，不是 2）', async () => {
  const dir = tempDir()
  try {
    const mod = await import(SCRIPT_URL)
    const result = mod.runPreflight({ dir, use: 'commercial' })
    assert.equal(result.code, 0, JSON.stringify(result))
    assert.equal(result.license.skipped, true)
    assert.match(result.license.reason, /package-lock|node_modules/)
    assert.equal(result.hardcode.ok, true)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('preflight：GPL 依赖在 commercial 下阻断（exit 1）', async () => {
  const dir = tempDir()
  try {
    writeLock(dir, { 'node_modules/gpl-lib': { version: '1.0.0', license: 'GPL-3.0' } })
    const mod = await import(SCRIPT_URL)
    const result = mod.runPreflight({ dir, use: 'commercial' })
    assert.equal(result.code, 1)
    assert.equal(result.license.ok, false)
    assert.equal(result.license.forbidden.length, 1)
    assert.equal(result.license.forbidden[0].name, 'gpl-lib')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('preflight：同目录 self 用途放行 GPL（exit 0）', async () => {
  const dir = tempDir()
  try {
    writeLock(dir, { 'node_modules/gpl-lib': { version: '1.0.0', license: 'GPL-3.0' } })
    const mod = await import(SCRIPT_URL)
    const result = mod.runPreflight({ dir, use: 'self' })
    assert.equal(result.code, 0)
    assert.equal(result.license.counts.forbidden, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('preflight：硬编码命中阻断（exit 1）', async () => {
  const dir = tempDir()
  try {
    mkdirSync(join(dir, 'src'))
    writeFileSync(join(dir, 'src', 'app.js'), 'const url = "https://example.com/api"\n')
    const mod = await import(SCRIPT_URL)
    const result = mod.runPreflight({ dir, use: 'commercial' })
    assert.equal(result.code, 1)
    assert.equal(result.hardcode.ok, false)
    assert.ok(result.hardcode.findings.some(item => item.type === 'url'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('preflight：--skip-hardcode 只跳过硬编码', async () => {
  const dir = tempDir()
  try {
    mkdirSync(join(dir, 'src'))
    writeFileSync(join(dir, 'src', 'app.js'), 'const url = "https://example.com/api"\n')
    const mod = await import(SCRIPT_URL)
    const result = mod.runPreflight({ dir, use: 'commercial', skipHardcode: true })
    assert.equal(result.code, 0)
    assert.equal(result.hardcode.skipped, true)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('preflight：未知用途 exit 2，不误判为危险', async () => {
  const dir = tempDir()
  try {
    const mod = await import(SCRIPT_URL)
    const result = mod.runPreflight({ dir, use: 'nonsense' })
    assert.equal(result.code, 2)
    assert.match(result.message, /未知用途/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('preflight CLI：空目录 exit 0，--json 可解析', () => {
  const dir = tempDir()
  try {
    const out = runCli(['--dir', dir, '--json'])
    assert.equal(out.code, 0, out.stderr)
    const data = JSON.parse(out.stdout)
    assert.equal(data.tool, 'stop-wishing/preflight')
    assert.equal(data.ok, true)
    assert.equal(data.license.skipped, true)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('preflight CLI：GPL 目录 exit 1，文本含「禁止项」', () => {
  const dir = tempDir()
  try {
    writeLock(dir, { 'node_modules/gpl-lib': { version: '1.0.0', license: 'GPL-3.0' } })
    const out = runCli(['--dir', dir, '--use', 'commercial'])
    assert.equal(out.code, 1, out.stderr)
    assert.match(out.stdout, /禁止项/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('preflight CLI：未知参数 exit 2', () => {
  const out = runCli(['--nonsense'])
  assert.equal(out.code, 2)
  assert.match(out.stderr, /未知参数/)
})
