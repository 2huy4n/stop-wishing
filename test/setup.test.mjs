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
  // 语义：本地 issue 放 docs/issues/；docs/tickets/ 是我们自己的工作切片，两者分开。
  const tracker = read(root, 'docs/agents/issue-tracker.md')
  assert.match(tracker, /- \*\*Where:\*\* `docs\/issues\/`/, 'Where 行应指向 docs/issues/')
  assert.match(tracker, /- \*\*Create:\*\* 在 `docs\/issues\/` 新建/, 'Create 行应指向 docs/issues/')
  assert.match(tracker, /- \*\*Read:\*\* 读 `docs\/issues\/\*\.md`/, 'Read 行应指向 docs/issues/')
  assert.doesNotMatch(tracker, /Create:\*\* 在 `docs\/tickets\/`/, 'Create 不得再写 docs/tickets/')
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

test('--agents-md 只写存在的指针，不写不存在的 docs/project 等', () => {
  const root = freshProject()
  writeFileSync(join(root, 'AGENTS.md'), '# 项目约定\n', 'utf8')
  assert.equal(run(['--dir', root, '--agents-md']).status, 0)
  const text = read(root, 'AGENTS.md')
  assert.match(text, /docs\/agents\/issue-tracker\.md/)
  assert.match(text, /docs\/agents\/domain\.md/)
  for (const missing of ['docs/project.md', 'docs/progress.md', 'docs/todo.md', 'docs/discipline.md', 'docs/structure.md', 'docs/tickets/']) {
    assert.doesNotMatch(text, new RegExp(missing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `不应指向不存在的 ${missing}`)
  }
  assert.equal((text.match(/^- `/gm) ?? []).length, 2, '空仓库只应有两条存在的指针')
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

test('标记段残缺 → 停下报错，不写任何文件', () => {
  const root = freshProject()
  assert.equal(run(['--dir', root]).status, 0)
  const rel = 'docs/agents/domain.md'
  const broken = read(root, rel).replace(END, '')
  writeFileSync(join(root, rel), broken, 'utf8')
  const otherBefore = read(root, 'docs/agents/issue-tracker.md')

  const out = run(['--dir', root])
  assert.equal(out.status, 1, out.stdout + out.stderr)
  assert.match(out.stderr, /标记段异常/)
  assert.equal(read(root, rel), broken, '出错时不得改残缺文件')
  assert.equal(read(root, 'docs/agents/issue-tracker.md'), otherBefore, '出错时其它文件也不得改')
})

test('标记段重复 → 停下报错，不替换', () => {
  const root = freshProject()
  assert.equal(run(['--dir', root]).status, 0)
  const rel = 'docs/agents/domain.md'
  const doubled = read(root, rel) + '\n' + read(root, rel)
  writeFileSync(join(root, rel), doubled, 'utf8')
  const out = run(['--dir', root])
  assert.equal(out.status, 1, out.stdout + out.stderr)
  assert.match(out.stderr, /标记段异常/)
  assert.equal(read(root, rel), doubled, '不得替换或多删')
})

test('--labels none → issue-tracker.md 不指向不存在的 triage-labels.md', () => {
  const root = freshProject()
  assert.equal(run(['--dir', root, '--labels', 'none']).status, 0)
  assert.doesNotMatch(read(root, 'docs/agents/issue-tracker.md'), /triage-labels\.md/)
})

test('已有指针段但无标记 → 跳过而非重复追加', () => {
  const root = freshProject()
  writeFileSync(join(root, 'AGENTS.md'), '# 项目约定\n\n## 项目文档\n\n手写指针。\n', 'utf8')
  const out = run(['--dir', root, '--agents-md'])
  assert.equal(out.status, 0, out.stdout + out.stderr)
  const text = read(root, 'AGENTS.md')
  assert.equal((text.match(/## 项目文档/g) ?? []).length, 1, '不应出现第二个指针段')
  assert.doesNotMatch(text, /stop-wishing:project-docs:begin/)
  assert.match(out.stdout, /skipped/)
})

test('--labels none 且已有标签文件 → 说明不会删除，JSON 也带 notes', () => {
  const root = freshProject()
  assert.equal(run(['--dir', root]).status, 0)
  const out = run(['--dir', root, '--labels', 'none'])
  assert.equal(out.status, 0, out.stdout + out.stderr)
  assert.match(out.stdout, /不会删除/, '必须说明旧文件保留')
  const json = JSON.parse(run(['--dir', root, '--labels', 'none', '--json']).stdout)
  assert.ok(Array.isArray(json.notes) && json.notes.some(note => note.includes('不会删除')))
})

test('新建文件首行是 H1，标签表两列', () => {
  const root = freshProject()
  assert.equal(run(['--dir', root]).status, 0)
  assert.match(read(root, 'docs/agents/issue-tracker.md').split('\n')[0], /^# Issue tracker$/)
  assert.match(read(root, 'docs/agents/domain.md').split('\n')[0], /^# Domain docs$/)
  const triage = read(root, 'docs/agents/triage-labels.md')
  assert.match(triage.split('\n')[0], /^# Triage labels$/)
  assert.match(triage, /\| 角色 \| 标签 \|/)
  assert.doesNotMatch(triage, /\| 角色 \| 标签 \| 含义 \|/)
})

test('init-docs --agents-md 之后跑 setup：只留一个指针段', () => {
  const root = freshProject()
  const docs = spawnSync(process.execPath, [join(ROOT, 'skills', 'stop-wishing', 'scripts', 'init-docs.js'), '--lang', 'zh', '--dir', root, '--agents-md'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 20000,
  })
  assert.equal(docs.status, 0, docs.stdout + docs.stderr)
  assert.ok(read(root, 'AGENTS.md').includes('stop-wishing:project-docs:begin'), 'init-docs 模板应带标记')

  const out = run(['--dir', root, '--agents-md'])
  assert.equal(out.status, 0, out.stdout + out.stderr)
  const text = read(root, 'AGENTS.md')
  assert.equal((text.match(/stop-wishing:project-docs:begin/g) ?? []).length, 1, '只能有一段指针')
  assert.match(text, /## 项目文档/, '应保留 init-docs 的原标题')
  for (const rel of ['docs/project.md', 'docs/progress.md', 'docs/todo.md', 'docs/discipline.md', 'docs/structure.md', 'docs/content.md', 'docs/LICENSES.md']) {
    assert.match(text, new RegExp(rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `不得丢掉 ${rel}`)
  }
  assert.match(text, /docs\/agents\/issue-tracker\.md/, 'setup 应追加 issue-tracker 指针')
  assert.match(text, /docs\/agents\/domain\.md/, 'setup 应追加 domain 指针')
  assert.equal((text.match(/## (Project docs|项目文档)/g) ?? []).length, 1, '不得出现第二个指针标题')
})

test('setup SKILL.md 不超过 60 行，四个参考文件都在', () => {
  const text = readFileSync(join(ROOT, 'skills', 'stop-wishing-setup', 'SKILL.md'), 'utf8').trimEnd()
  const lines = text.split(/\r?\n/).length
  assert.ok(lines <= 60, `setup SKILL.md 行数 ${lines} 超过 60`)
  for (const ref of ['SETUP.md', 'FILES.md', 'SAFETY.md', 'CONSUMERS.md']) {
    assert.equal(existsSync(join(ROOT, 'skills', 'stop-wishing-setup', ref)), true, `缺 ${ref}`)
  }
})


test('--agents-file CLAUDE：两个文件都在时只改 CLAUDE，AGENTS 不动', () => {
  const root = freshProject()
  writeFileSync(join(root, 'AGENTS.md'), '# AGENTS\n\nkeep\n', 'utf8')
  writeFileSync(join(root, 'CLAUDE.md'), '# CLAUDE\n\nkeep\n', 'utf8')
  const out = run(['--dir', root, '--agents-md', '--agents-file', 'CLAUDE'])
  assert.equal(out.status, 0, out.stdout + out.stderr)
  assert.match(read(root, 'CLAUDE.md'), /stop-wishing:project-docs:begin/)
  assert.doesNotMatch(read(root, 'AGENTS.md'), /stop-wishing:project-docs:begin/)
  assert.match(read(root, 'AGENTS.md'), /keep/)
})

test('两个 AGENTS/CLAUDE 都在且未选文件：exit 1，不写任何东西', () => {
  const root = freshProject()
  writeFileSync(join(root, 'AGENTS.md'), '# AGENTS\n', 'utf8')
  writeFileSync(join(root, 'CLAUDE.md'), '# CLAUDE\n', 'utf8')
  const out = run(['--dir', root, '--agents-md'])
  assert.equal(out.status, 1)
  assert.match(out.stderr, /--agents-file/)
  assert.equal(existsSync(join(root, 'docs')), false)
  assert.equal(read(root, 'AGENTS.md'), '# AGENTS\n')
  assert.equal(read(root, 'CLAUDE.md'), '# CLAUDE\n')
})

test('--agents-file 必须配合 --agents-md', () => {
  const root = freshProject()
  writeFileSync(join(root, 'CLAUDE.md'), '# CLAUDE\n', 'utf8')
  const out = run(['--dir', root, '--agents-file', 'CLAUDE'])
  assert.equal(out.status, 1)
  assert.match(out.stderr, /--agents-md/)
})

test('omittedPointers 会出现在 JSON 和 notes 中', () => {
  const root = freshProject()
  writeFileSync(join(root, 'AGENTS.md'), '# AGENTS\n', 'utf8')
  const out = run(['--dir', root, '--agents-md', '--json'])
  assert.equal(out.status, 0, out.stdout + out.stderr)
  const json = JSON.parse(out.stdout)
  assert.ok(json.agentsMd.omittedPointers.includes('docs/project.md'))
  assert.ok(json.agentsMd.omittedPointers.includes('docs/tickets/'))
  assert.ok(json.notes.some(note => note.includes('省略的指针')))
})

test('已有标签映射：重跑保留右列，不把 bug 改回 needs-triage', () => {
  const root = freshProject()
  assert.equal(run(['--dir', root]).status, 0)
  const rel = 'docs/agents/triage-labels.md'
  const before = read(root, rel).replace('| needs-triage | \`needs-triage\` |', '| needs-triage | \`bug\` |')
  writeFileSync(join(root, rel), before, 'utf8')
  const out = run(['--dir', root, '--json'])
  assert.equal(out.status, 0, out.stdout + out.stderr)
  const after = read(root, rel)
  assert.match(after, /needs-triage \| \`bug\`/)
  assert.doesNotMatch(after, /needs-triage \| \`needs-triage\`/)
})

test('domain：glossary 路径、multi layout 和 contexts 写入文件', () => {
  const root = freshProject()
  const out = run(['--dir', root, '--layout', 'multi', '--contexts', 'web -> api', '--glossary', 'docs/glossary.md', '--json'])
  assert.equal(out.status, 0, out.stdout + out.stderr)
  const text = read(root, 'docs/agents/domain.md')
  assert.match(text, /docs\/glossary\.md/)
  assert.match(text, /multi-context/)
  assert.match(text, /web -> api/)
})

test('issue-tracker other + detail：写入用户描述，不再提问', () => {
  const root = freshProject()
  const out = run(['--dir', root, '--issue-tracker', 'other', '--issue-tracker-detail', 'Linear TEAM-123', '--json'])
  assert.equal(out.status, 0, out.stdout + out.stderr)
  const json = JSON.parse(out.stdout)
  assert.equal(json.questions.length, 0)
  const text = read(root, 'docs/agents/issue-tracker.md')
  assert.match(text, /Linear TEAM-123/)
  assert.match(text, /按“Linear TEAM-123”的约定创建/)
})

test('FILES.md 的三个 docs/agents 模板都带 setup marker', () => {
  const text = readFileSync(join(ROOT, 'skills', 'stop-wishing-setup', 'FILES.md'), 'utf8')
  assert.ok((text.match(/stop-wishing-setup:begin/g) ?? []).length >= 3)
  assert.ok((text.match(/stop-wishing-setup:end/g) ?? []).length >= 3)
})
