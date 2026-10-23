import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { resolveDestinations, usage, SKILL_NAMES } from '../install.js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

function cli(args) {
  return spawnSync(process.execPath, ['install.js', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30000,
  })
}

test('install --dry-run：报告七个技能但不写盘，退出码 0', () => {
  const base = mkdtempSync(join(tmpdir(), 'sw-install-dry-'))
  const out = cli(['--dry-run', '--target', base])
  assert.equal(out.status, 0, out.stderr)
  assert.match(out.stdout, /\[dry-run\] 不会写盘/)
  for (const skill of SKILL_NAMES) assert.ok(out.stdout.includes(skill), `dry-run 应列出 ${skill}`)
  assert.equal(existsSync(join(base, 'stop-wishing')), false, 'dry-run 绝不能创建目标目录')
})

test('install：真实复制七个技能到 --target，含主技能脚本/模板与卫星 SKILL.md', () => {
  const base = mkdtempSync(join(tmpdir(), 'sw-install-real-'))
  const out = cli(['--target', base])
  assert.equal(out.status, 0, out.stderr)
  for (const skill of SKILL_NAMES) {
    assert.equal(existsSync(join(base, skill, 'SKILL.md')), true, `${skill}/SKILL.md 应存在`)
  }
  const dest = join(base, 'stop-wishing')
  assert.equal(existsSync(join(dest, 'scripts', 'check-env.js')), true)
  assert.equal(existsSync(join(dest, 'templates', 'zh', 'project.md')), true)
  assert.equal(existsSync(join(dest, 'test')), false, '测试目录不随安装走')
  assert.equal(existsSync(join(dest, '.git')), false, 'git 目录不随安装走')
  assert.equal(existsSync(join(base, 'stop-wishing-review', 'scripts')), false, '卫星技能不带主技能脚本')
})

test('install：默认不覆盖（exit 1），--force 才覆盖', () => {
  const base = mkdtempSync(join(tmpdir(), 'sw-install-force-'))
  assert.equal(cli(['--target', base]).status, 0)
  const second = cli(['--target', base])
  assert.equal(second.status, 1)
  assert.match(second.stderr, /--force/)
  assert.equal(cli(['--target', base, '--force']).status, 0)
})

test('--dest：作为 skills 根目录，安装七个子目录', () => {
  const root = mkdtempSync(join(tmpdir(), 'sw-install-dest-'))
  const out = cli(['--dest', root])
  assert.equal(out.status, 0, out.stderr)
  for (const skill of SKILL_NAMES) {
    assert.equal(existsSync(join(root, skill, 'SKILL.md')), true, `${skill} 应装到 <dest>/${skill}`)
  }
  assert.equal(existsSync(join(root, 'SKILL.md')), false, '--dest 不应把文件散在根下')
})

test('--verify：七个技能逐个 PASS，退出码 0', () => {
  const root = mkdtempSync(join(tmpdir(), 'sw-install-verify-'))
  const out = cli(['--dest', root, '--verify'])
  assert.equal(out.status, 0, out.stdout + out.stderr)
  for (const skill of SKILL_NAMES) {
    assert.match(out.stdout, new RegExp(`\\[PASS\\] SKILL\\.md exists and name: ${skill}`))
  }
  assert.match(out.stdout, /\[PASS\] scripts\/ six scripts present/)
  assert.match(out.stdout, /\[PASS\] templates\/zh\/ seven files/)
  assert.match(out.stdout, /\[PASS\] templates\/en\/ seven files/)
  assert.match(out.stdout, /\[PASS\] license and third-party notices/)
  assert.doesNotMatch(out.stdout, /\[FAIL\]/)
})

test('--verify：删掉主技能一个脚本后自检失败，退出码 3', () => {
  const root = mkdtempSync(join(tmpdir(), 'sw-install-broken-'))
  assert.equal(cli(['--dest', root]).status, 0)
  rmSync(join(root, 'stop-wishing', 'scripts', 'check-env.js'))
  const out = cli(['--dest', root, '--verify'])
  assert.equal(out.status, 3, out.stdout + out.stderr)
  assert.match(out.stdout, /\[FAIL\] scripts\/ six scripts present/)
  assert.match(out.stdout, /check-env/)
})

test('--verify：删掉一个卫星技能后能定位到它，退出码 3', () => {
  const root = mkdtempSync(join(tmpdir(), 'sw-install-missing-satellite-'))
  assert.equal(cli(['--dest', root]).status, 0)
  rmSync(join(root, 'stop-wishing-review', 'SKILL.md'))
  const out = cli(['--dest', root, '--verify'])
  assert.equal(out.status, 3, out.stdout + out.stderr)
  assert.match(out.stdout, /\[FAIL\] SKILL\.md exists and name: stop-wishing-review/)
  assert.match(out.stderr, /自检失败/)
})

test('--verify：front-matter name 与目录名不一致时 FAIL', () => {
  const root = mkdtempSync(join(tmpdir(), 'sw-install-name-'))
  assert.equal(cli(['--dest', root]).status, 0)
  const file = join(root, 'stop-wishing-debt', 'SKILL.md')
  const text = readFileSync(file, 'utf8').replace('name: stop-wishing-debt', 'name: wrong-name')
  writeFileSync(file, text, 'utf8')
  const out = cli(['--dest', root, '--verify'])
  assert.equal(out.status, 3, out.stdout + out.stderr)
  assert.match(out.stdout, /\[FAIL\] SKILL\.md exists and name: stop-wishing-debt/)
  assert.match(out.stdout, /front-matter name/)
})

test('--tool 路径解析：返回 skills 根目录，七个技能由安装器创建子目录', () => {
  const home = join(tmpdir(), 'sw-fake-home')
  for (const tool of ['dsh', 'codex', 'trae']) {
    const [dest] = resolveDestinations({ tool }, home)
    assert.equal(dest, join(home, '.agents', 'skills'), `${tool} 的 skills 根目录不对`)
  }
  const [claudeDest] = resolveDestinations({ tool: 'claude' }, home)
  assert.equal(claudeDest, join(home, '.claude', 'skills'))
})

test('--tool claude --dry-run：解析到 ~/.claude/skills 且列出七个技能', () => {
  const out = cli(['--tool', 'claude', '--dry-run'])
  assert.equal(out.status, 0, out.stderr)
  assert.match(out.stdout, /\.claude[/\\]skills[/\\]stop-wishing/)
  for (const skill of SKILL_NAMES) assert.ok(out.stdout.includes(skill), `应列出 ${skill}`)
  assert.match(out.stdout, /\[dry-run\] 不会写盘/)
})

test('--tool 未知值：退出码 1 并列出可选值', () => {
  const out = cli(['--tool', 'vscode', '--dry-run'])
  assert.equal(out.status, 1)
  assert.match(out.stderr, /未知 --tool/)
  assert.match(out.stderr, /dsh \| claude \| codex \| trae/)
})

test('--dest 与 --target 都是 skills 根目录：各自生成七个子目录', () => {
  const root = mkdtempSync(join(tmpdir(), 'sw-levels-'))
  const destRoot = join(root, 'dest')
  assert.equal(cli(['--dest', destRoot]).status, 0)
  assert.equal(existsSync(join(destRoot, 'stop-wishing', 'SKILL.md')), true)
  assert.equal(existsSync(join(destRoot, 'stop-wishing-review', 'SKILL.md')), true)

  const base = join(root, 'base')
  assert.equal(cli(['--target', base]).status, 0)
  assert.equal(existsSync(join(base, 'stop-wishing', 'SKILL.md')), true)
  assert.equal(existsSync(join(base, 'stop-wishing-audit', 'SKILL.md')), true)
  assert.equal(existsSync(join(base, 'SKILL.md')), false, '--target 不应把文件散在 base 根下')
})

test('--verify：主技能内容落后于源时 hash 报 WARN，退出码 4', () => {
  const root = mkdtempSync(join(tmpdir(), 'sw-stale-'))
  assert.equal(cli(['--dest', root]).status, 0)
  appendFileSync(join(root, 'stop-wishing', 'SKILL.md'), '\n<!-- changed byte, simulating a stale install -->\n', 'utf8')
  const out = cli(['--dest', root, '--verify'])
  assert.equal(out.status, 4, out.stdout + out.stderr)
  assert.match(out.stdout, /\[WARN\] SKILL\.md exists and name: stop-wishing/)
  assert.match(out.stdout, /内容落后于源/)
  assert.match(out.stderr, /落后于源|WARN/)
})

test('三处参数说明一致：install.js --help / README / SKILL.md 的参数与退出码集合相同', () => {
  const help = usage()
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8')
  const skill = readFileSync(join(ROOT, 'skills', 'stop-wishing', 'SKILL.md'), 'utf8')
  const readmeLines = readme.split('\n')
  const readmeIndex = readmeLines.findIndex(line => line.includes('参数：`--tool`'))
  const readmeBlock = readmeLines.slice(readmeIndex, readmeIndex + 10).join('\n')
  const skillRow = skill.split('\n').find(line => line.includes('`install.js`'))
  assert.ok(readmeIndex >= 0, 'README 里找不到「参数：`--tool` …」这一行')
  assert.ok(skillRow, 'SKILL.md 里找不到 install.js 说明')

  const flags = ['--tool', '--dest', '--verify', '--dry-run', '--force', '--target']
  for (const [name, text] of [['--help', help], ['README', readmeBlock], ['SKILL.md', skillRow]]) {
    for (const flag of flags) assert.ok(text.includes(flag), `${name} 缺参数 ${flag}`)
    for (const code of ['0', '1', '2', '3', '4']) assert.ok(text.includes(code), `${name} 缺退出码 ${code}`)
  }
  assert.match(help, /--dest.*skills 根目录/)
  assert.match(help, /--target.*兼容旧用法/)
  assert.match(readmeBlock, /--dest.*skills 根目录/)
  assert.match(readmeBlock, /--target.*兼容旧用法/)
})

test('README 无人值守兜底：无法提问时按环境判断并写明假设', () => {
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8')
  assert.match(readme, /无法向用户提问/)
  assert.match(readme, /我假设你用的是/)
  assert.match(readme, /优先装到 `~\/\.agents\/skills`/)
})
