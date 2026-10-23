import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { insertSnapshot, snapshotLines } from '../skills/stop-wishing/scripts/init-docs.js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DOCS = ['project', 'content', 'structure', 'progress', 'todo', 'discipline', 'LICENSES']

function cli(args) {
  return spawnSync(process.execPath, ['skills/stop-wishing/scripts/init-docs.js', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 20000,
  })
}

function docsOf(dir) {
  return readdirSync(join(dir, 'docs')).sort()
}

test('init-docs：中文模板生成 7 份，进度文件含 LICENSES.md', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sw-docs-zh-'))
  const out = cli(['--lang', 'zh', '--dir', dir])
  assert.equal(out.status, 0, out.stderr)
  assert.deepEqual(docsOf(dir), DOCS.map(name => `${name}.md`).sort())
})

test('F1：LICENSES.md 只有一份（大小写不再分叉）', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sw-docs-f1-'))
  assert.equal(cli(['--lang', 'zh', '--dir', dir]).status, 0)
  const matches = docsOf(dir).filter(name => /^licen[cs]es\.md$/i.test(name))
  assert.deepEqual(matches, ['LICENSES.md'], '只允许存在一份 LICENSES.md')
  const lower = readdirSync(join(dir, 'docs')).filter(name => name === 'licenses.md')
  assert.equal(lower.length, 0, '不允许再生成小写 licenses.md')
})

test('F7：progress.md 首行是 H1，环境快照在 H1 之后', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sw-docs-f7-'))
  assert.equal(cli(['--lang', 'zh', '--dir', dir]).status, 0)
  const lines = readFileSync(join(dir, 'docs', 'progress.md'), 'utf8').split(/\r?\n/)
  assert.match(lines[0], /^# /, '首行必须是 H1')
  const snapshotIndex = lines.findIndex(line => line.startsWith('> 环境快照'))
  assert.ok(snapshotIndex > 0, '环境快照必须在 H1 之后')
})

test('F3：未知 git 版本写「未检测到版本」，且进度文件不出现 null', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sw-docs-f3-'))
  assert.equal(cli(['--lang', 'zh', '--dir', dir]).status, 0)
  const text = readFileSync(join(dir, 'docs', 'progress.md'), 'utf8')
  assert.doesNotMatch(text, /git:\s*null/, '不得输出 git: null')
  assert.match(text, /git: /)
})

test('init-docs：英文模板同样生成 7 份，重复生成 exit 1，--force 覆盖', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sw-docs-en-'))
  assert.equal(cli(['--lang', 'en', '--dir', dir]).status, 0)
  assert.equal(docsOf(dir).length, 7)
  const again = cli(['--lang', 'en', '--dir', dir])
  assert.equal(again.status, 1)
  assert.match(again.stderr, /已存在/)
  assert.equal(cli(['--lang', 'en', '--dir', dir, '--force']).status, 0)
})

test('F6：缺 --lang 与未知参数都返回 1，且不建目录', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sw-docs-args-'))
  const missing = cli(['--dir', dir])
  assert.equal(missing.status, 1)
  assert.match(missing.stderr, /--lang/)
  const unknown = cli(['--lang', 'zh', '--dir', dir, '--nope'])
  assert.equal(unknown.status, 1)
  assert.match(unknown.stderr, /未知参数/)
  assert.equal(existsSync(join(dir, 'docs')), false, '参数错误时不该建目录')
})

test('F3 单元：版本未知时写「未检测到版本」，绝不出现 null', () => {
  const env = {
    at: '2026-10-20T19:10+08:00',
    node: { version: 'v24.0.0' },
    git: { ok: true, version: null, source: 'C:/Program Files/Git/cmd/git.exe' },
    bash: { ok: true, version: null, source: 'C:/Program Files/Git/bin/bash.exe', blocked: true },
    platform: 'win32-x64',
    backup: { method: 'git-tag', hint: '打 tag' },
  }
  const text = snapshotLines(env).join('\n')
  assert.match(text, /git: 未检测到版本/)
  assert.doesNotMatch(text, /null/)
})

test('F3/F7 单元：insertSnapshot 把快照插在 H1 之后', () => {
  const markdown = '# 标题\n\n正文\n'
  const result = insertSnapshot(markdown, ['> 快照'])
  const lines = result.split('\n')
  assert.equal(lines[0], '# 标题')
  assert.equal(lines[2], '> 快照')
  assert.ok(result.includes('正文'))
})
