import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SCRIPT = join(ROOT, 'skills', 'stop-wishing', 'scripts', 'check-tickets.js')

function run(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 20000,
  })
}

function buildProject(files) {
  const dir = mkdtempSync(join(tmpdir(), 'sw-tickets-'))
  for (const [file, content] of Object.entries(files)) {
    const full = join(dir, file)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content, 'utf8')
  }
  return dir
}

function projectHash(projectText) {
  const kept = projectText.replace(/\r\n/g, '\n').split('\n').filter(line => !/^>\s*最后更新：/.test(line))
  return createHash('sha256').update(kept.join('\n'), 'utf8').digest('hex')
}

const PROJECT_MD = '# 项目\n\n> 最后更新：2026-10-23T14:00+08:00\n\n目标：做登录。\n'

function specFile(hash, extra = '') {
  return `---\nid: 2026-10-23-login\ntitle: 登录\nstatus: draft\ncreated: 2026-10-23T14:00+08:00\nupdated: 2026-10-23T14:00+08:00\ncard_sha256: ${hash}\nsource: docs/project.md\ntickets: []\nlang: zh\n---\n\n# 登录\n${extra}`
}

function ticket({ id = '0001', title = '登录', status = 'todo', blockedBy = '[]', acceptance = ['能用邮箱登录'], verify = ['node --test'], estimate = 'S', spec = '2026-10-23-login' } = {}) {
  const list = items => (items.length === 0 ? '[]' : '\n' + items.map(item => `  - ${item}`).join('\n'))
  return `---\nid: "${id}"\ntitle: ${title}\nspec: ${spec}\nstatus: ${status}\nblocked_by: ${Array.isArray(blockedBy) ? `[${blockedBy.join(', ')}]` : blockedBy}\nacceptance: ${list(acceptance)}\nverify: ${list(verify)}\nestimate: ${estimate}\n---\n\n# ${id} ${title}\n`
}

function cleanFiles() {
  const hash = projectHash(PROJECT_MD)
  return {
    'docs/project.md': PROJECT_MD,
    'docs/specs/2026-10-23-login.md': specFile(hash),
    'docs/tickets/0001-login.md': ticket(),
    'docs/tickets/0002-login-ui.md': ticket({ id: '0002', title: '登录页', blockedBy: ['0001'] }),
  }
}

test('干净项目（2 张票 + 1 个 spec）→ exit 0', () => {
  const dir = buildProject(cleanFiles())
  const out = run(['--dir', dir])
  assert.equal(out.status, 0, out.stdout + out.stderr)
  assert.match(out.stdout, /共 2 张票 \/ 1 个 spec：错误 0 条/)
})

test('环（A→B→A）→ exit 1 且报 E10', () => {
  const files = cleanFiles()
  files['docs/tickets/0001-login.md'] = ticket({ blockedBy: ['0002'] })
  const out = run(['--dir', buildProject(files)])
  assert.equal(out.status, 1, out.stdout)
  assert.match(out.stdout, /E10/)
  assert.match(out.stdout, /依赖成环/)
})

test('缺必填字段 → E2', () => {
  const files = cleanFiles()
  files['docs/tickets/0001-login.md'] = `---\nid: "0001"\nspec: 2026-10-23-login\nstatus: todo\nacceptance:\n  - 能用邮箱登录\nverify:\n  - node --test\n---\n`
  const out = run(['--dir', buildProject(files)])
  assert.equal(out.status, 1)
  assert.match(out.stdout, /E2 .*缺少必填字段: title/)
})

test('verify 少于 acceptance → E12', () => {
  const files = cleanFiles()
  files['docs/tickets/0001-login.md'] = ticket({ acceptance: ['能登录', '能看到错误提示'], verify: ['node --test'] })
  const out = run(['--dir', buildProject(files)])
  assert.equal(out.status, 1)
  assert.match(out.stdout, /E12/)
  assert.match(out.stdout, /acceptance 2 条 > verify 1 条/)
})

test('done 票被引用 → E13', () => {
  const files = cleanFiles()
  files['docs/tickets/0001-login.md'] = ticket({ status: 'done' })
  const out = run(['--dir', buildProject(files)])
  assert.equal(out.status, 1)
  assert.match(out.stdout, /E13/)
})

test('card_sha256 不一致 → W4 但 exit 0', () => {
  const files = cleanFiles()
  files['docs/specs/2026-10-23-login.md'] = specFile('0'.repeat(64))
  const out = run(['--dir', buildProject(files)])
  assert.equal(out.status, 0, out.stdout)
  assert.match(out.stdout, /W4/)
  assert.match(out.stdout, /card_sha256/)
})

test('无 docs/tickets → exit 0 并提示', () => {
  const dir = buildProject({ 'docs/specs/x.md': specFile('0'.repeat(64)) })
  const out = run(['--dir', dir])
  assert.equal(out.status, 0, out.stdout + out.stderr)
  assert.match(out.stdout, /视为 0 张票/)
})

test('--json：结构化输出 errors/warnings/counts', () => {
  const files = cleanFiles()
  files['docs/tickets/0001-login.md'] = ticket({ blockedBy: ['0001'] })
  const out = run(['--dir', buildProject(files), '--json'])
  assert.equal(out.status, 1)
  const parsed = JSON.parse(out.stdout)
  assert.equal(typeof parsed.counts.tickets, 'number')
  assert.ok(Array.isArray(parsed.errors) && parsed.errors.some(item => item.code === 'E9'))
})

test('带引号的数组元素按无引号处理，不误报 E8 / W3', () => {
  const hash = projectHash(PROJECT_MD)
  const quoted = (id, title, blocked) => `---\nid: "${id}"\ntitle: ${title}\nspec: 2026-10-23-login\nstatus: todo\nblocked_by: ${blocked}\nacceptance:\n  - "能用邮箱登录"\nverify:\n  - "node --test"\nestimate: S\n---\n\n# ${id}\n`
  const dir = buildProject({
    'docs/project.md': PROJECT_MD,
    'docs/specs/2026-10-23-login.md': specFile(hash),
    'docs/tickets/0001-login.md': quoted('0001', '登录', '[]'),
    'docs/tickets/0002-login-ui.md': quoted('0002', '登录页', '["0001"]'),
  })
  const out = run(['--dir', dir])
  assert.equal(out.status, 0, out.stdout + out.stderr)
  assert.doesNotMatch(out.stdout, /E8/, '带引号的 blocked_by 不应被判为票不存在')
  assert.doesNotMatch(out.stdout, /W3/, '带引号的 verify 不应被误判为非命令')
})

test('自依赖只报 E9，不重复报 E10 假环', () => {
  const hash = projectHash(PROJECT_MD)
  const dir = buildProject({
    'docs/project.md': PROJECT_MD,
    'docs/specs/2026-10-23-login.md': specFile(hash),
    'docs/tickets/0001-login.md': ticket({ blockedBy: ['0001'] }),
  })
  const out = run(['--dir', dir])
  assert.equal(out.status, 1)
  assert.match(out.stdout, /E9/)
  assert.doesNotMatch(out.stdout, /E10/, '自依赖不应再报一条 0001 -> 0001 的假环')
})
