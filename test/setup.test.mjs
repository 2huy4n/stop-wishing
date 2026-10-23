import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SCRIPT = join(ROOT, 'skills', 'stop-wishing', 'scripts', 'setup.js')
const BEGIN = '<!-- stop-wishing-setup:begin -->'
const END = '<!-- stop-wishing-setup:end -->'

function run(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 20000,
  })
}

function freshProject() {
  return mkdtempSync(join(tmpdir(), 'sw-setup-'))
}

function read(root, rel) {
  return readFileSync(join(root, rel), 'utf8')
}

test('空目录首次运行 → 三个文件创建，标记段存在，exit 0', () => {
  const root = freshProject()
  const out = run(['--dir', root])
  assert.equal(out.status, 0, out.stdout + out.stderr)
  for (const rel of ['docs/agents/issue-tracker.md', 'docs/agents/domain.md', 'docs/agents/triage-labels.md']) {
    assert.equal(existsSync(join(root, rel)), true, `${rel} 应被创建`)
    assert.ok(read(root, rel).includes(BEGIN) && read(root, rel).includes(END), `${rel} 缺标记段`)
  }
  assert.match(out.stdout, /created\tdocs\/agents\/issue-tracker\.md/)
})

test('再跑一次 → 全部 unchanged，且文件字节不变', () => {
  const root = freshProject()
  assert.equal(run(['--dir', root]).status, 0)
  const before = {}
  for (const rel of ['docs/agents/issue-tracker.md', 'docs/agents/domain.md', 'docs/agents/triage-labels.md']) before[rel] = read(root, rel)
  const out = run(['--dir', root])
  assert.equal(out.status, 0, out.stdout + out.stderr)
  for (const rel of Object.keys(before)) {
    assert.equal(read(root, rel), before[rel], `${rel} 内容变了`)
    assert.match(out.stdout, new RegExp(`unchanged\\t${rel.replace(/\//g, '\\/')}`))
  }
})

test('已存在文件段外有自定义内容 → 重跑后段外原样保留', () => {
  const root = freshProject()
  assert.equal(run(['--dir', root]).status, 0)
  const rel = 'docs/agents/issue-tracker.md'
  const customHead = '# 我自己写的抬头\n\n这段不许动。\n\n'
  const customTail = '\n\n## 尾注\n\n段外内容也要保留。\n'
  writeFileSync(join(root, rel), customHead + read(root, rel) + customTail, 'utf8')
  assert.equal(run(['--dir', root]).status, 0)
  const after = read(root, rel)
  assert.ok(after.startsWith(customHead), '段外头部被改动')
  assert.ok(after.endsWith(customTail), '段外尾部被改动')
  assert.equal((after.match(/stop-wishing-setup:begin/g) ?? []).length, 1, '不应重复插入标记段')
})

test('--labels none → 不创建 triage-labels.md', () => {
  const root = freshProject()
  const out = run(['--dir', root, '--labels', 'none'])
  assert.equal(out.status, 0, out.stdout + out.stderr)
  assert.equal(existsSync(join(root, 'docs/agents/triage-labels.md')), false)
  assert.equal(existsSync(join(root, 'docs/agents/issue-tracker.md')), true)
})

test('--agents-md 且无 AGENTS.md/CLAUDE.md → 不创建 AGENTS.md，输出说明', () => {
  const root = freshProject()
  const out = run(['--dir', root, '--agents-md'])
  assert.equal(out.status, 0, out.stdout + out.stderr)
  assert.equal(existsSync(join(root, 'AGENTS.md')), false, '绝不创建 AGENTS.md')
  assert.equal(existsSync(join(root, 'CLAUDE.md')), false)
  assert.match(out.stdout, /agents-md: skipped/)
  assert.match(out.stdout, /绝不创建|按约定/)
})

test('--agents-md 且有 AGENTS.md → 追加 Project docs 段；重跑不重复', () => {
  const root = freshProject()
  writeFileSync(join(root, 'AGENTS.md'), '# 项目约定\n\n手写内容。\n', 'utf8')
  assert.equal(run(['--dir', root, '--agents-md']).status, 0)
  const first = read(root, 'AGENTS.md')
  assert.match(first, /## Project docs/)
  assert.equal((first.match(/stop-wishing:project-docs:begin/g) ?? []).length, 1)
  assert.ok(first.startsWith('# 项目约定\n\n手写内容。\n'), '原有内容被改动')

  const second = run(['--dir', root, '--agents-md'])
  assert.equal(second.status, 0)
  const again = read(root, 'AGENTS.md')
  assert.equal((again.match(/## Project docs/g) ?? []).length, 1, '不应重复追加')
  assert.equal(again, first, '重跑不应改字节')
})

test('--dry-run → 不写盘', () => {
  const root = freshProject()
  const out = run(['--dir', root, '--dry-run'])
  assert.equal(out.status, 0, out.stdout + out.stderr)
  assert.match(out.stdout, /\[dry-run\] 不会写盘/)
  assert.equal(existsSync(join(root, 'docs')), false, 'dry-run 不应创建 docs/')
})

test('--json → 结构化输出 {files, agentsMd, questions}', () => {
  const root = freshProject()
  const out = run(['--dir', root, '--json', '--issue-tracker', 'other'])
  assert.equal(out.status, 0, out.stdout + out.stderr)
  const parsed = JSON.parse(out.stdout)
  assert.ok(Array.isArray(parsed.files) && parsed.files.length === 3)
  for (const file of parsed.files) {
    assert.equal(typeof file.path, 'string')
    assert.ok(['created', 'updated', 'unchanged'].includes(file.action))
  }
  assert.equal(typeof parsed.agentsMd, 'object')
  assert.ok(Array.isArray(parsed.questions) && parsed.questions.length >= 1, 'other 应产生待确认问题')
})

test('参数错误 → exit 1；目录不存在 → exit 2', () => {
  const bad = run(['--dir', freshProject(), '--layout', 'huge'])
  assert.equal(bad.status, 1)
  assert.match(bad.stderr, /--layout 非法/)
  const missing = run(['--dir', join(tmpdir(), 'sw-setup-not-exist-' + Date.now())])
  assert.equal(missing.status, 2)
  assert.match(missing.stderr, /目录不存在/)
})
