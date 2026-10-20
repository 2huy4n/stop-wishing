import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { resolveDestinations, usage } from '../install.js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

function cli(args) {
  return spawnSync(process.execPath, ['install.js', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30000,
  })
}

test('install --dry-run：只报告不写盘，退出码 0', () => {
  const base = mkdtempSync(join(tmpdir(), 'sw-install-dry-'))
  const out = cli(['--dry-run', '--target', base])
  assert.equal(out.status, 0, out.stderr)
  assert.match(out.stdout, /\[dry-run\] 不会写盘/)
  assert.match(out.stdout, /SKILL\.md/)
  assert.equal(existsSync(join(base, 'stop-wishing')), false, 'dry-run 绝不能创建目标目录')
})

test('install：真实复制到 --target，含 SKILL.md 与脚本，且不带 test/.git', () => {
  const base = mkdtempSync(join(tmpdir(), 'sw-install-real-'))
  const out = cli(['--target', base])
  assert.equal(out.status, 0, out.stderr)
  const dest = join(base, 'stop-wishing')
  assert.equal(existsSync(join(dest, 'SKILL.md')), true)
  assert.equal(existsSync(join(dest, 'scripts', 'check-env.js')), true)
  assert.equal(existsSync(join(dest, 'templates', 'zh', 'project.md')), true)
  assert.equal(existsSync(join(dest, 'test')), false, '测试目录不随安装走')
  assert.equal(existsSync(join(dest, '.git')), false, 'git 目录不随安装走')
  const names = readdirSync(dest)
  assert.ok(names.includes('SKILL.md'))
})

test('install：默认不覆盖（exit 1），--force 才覆盖', () => {
  const base = mkdtempSync(join(tmpdir(), 'sw-install-force-'))
  assert.equal(cli(['--target', base]).status, 0)
  const second = cli(['--target', base])
  assert.equal(second.status, 1)
  assert.match(second.stderr, /--force/)
  assert.equal(cli(['--target', base, '--force']).status, 0)
})

test('--dest：装到指定临时目录成功（exit 0），SKILL.md/脚本/模板都在', () => {
  const dir = join(mkdtempSync(join(tmpdir(), 'sw-install-dest-')), 'stop-wishing')
  const out = cli(['--dest', dir])
  assert.equal(out.status, 0, out.stderr)
  assert.equal(existsSync(join(dir, 'SKILL.md')), true)
  assert.equal(existsSync(join(dir, 'scripts', 'build-portable.js')), true)
  assert.equal(existsSync(join(dir, 'templates', 'en', 'LICENSES.md')), true)
})

test('--verify：安装后自检全 PASS，退出码 0', () => {
  const dir = join(mkdtempSync(join(tmpdir(), 'sw-install-verify-')), 'stop-wishing')
  const out = cli(['--dest', dir, '--verify'])
  assert.equal(out.status, 0, out.stdout + out.stderr)
  assert.match(out.stdout, /\[PASS\] SKILL\.md 存在且含 name: stop-wishing/)
  assert.match(out.stdout, /\[PASS\] scripts\/ 下四个脚本齐全/)
  assert.match(out.stdout, /\[PASS\] templates\/zh\/ 各 7 份/)
  assert.match(out.stdout, /\[PASS\] templates\/en\/ 各 7 份/)
  assert.match(out.stdout, /\[PASS\] LICENSE 存在/)
  assert.doesNotMatch(out.stdout, /\[FAIL\]/)
})

test('--verify：人为删掉一个脚本后自检失败，退出码 3', () => {
  const dir = join(mkdtempSync(join(tmpdir(), 'sw-install-broken-')), 'stop-wishing')
  assert.equal(cli(['--dest', dir]).status, 0)
  rmSync(join(dir, 'scripts', 'check-env.js'))
  const out = cli(['--dest', dir, '--verify'])
  assert.equal(out.status, 3, out.stdout + out.stderr)
  assert.match(out.stdout, /\[FAIL\] scripts\/ 下四个脚本齐全/)
  assert.match(out.stdout, /check-env/)
})

test('--tool 路径解析：dsh/codex/trae 用 ~/.agents/skills，claude 用 ~/.claude/skills', () => {
  const home = join(tmpdir(), 'sw-fake-home')
  for (const tool of ['dsh', 'codex', 'trae']) {
    const [dest] = resolveDestinations({ tool }, home)
    assert.equal(dest, join(home, '.agents', 'skills', 'stop-wishing'), `${tool} 的目标目录不对`)
  }
  const [claudeDest] = resolveDestinations({ tool: 'claude' }, home)
  assert.equal(claudeDest, join(home, '.claude', 'skills', 'stop-wishing'))
})

test('--tool claude --dry-run：解析到 ~/.claude/skills 且不写盘', () => {
  const out = cli(['--tool', 'claude', '--dry-run'])
  assert.equal(out.status, 0, out.stderr)
  assert.match(out.stdout, /\.claude[/\\]skills[/\\]stop-wishing/)
  assert.match(out.stdout, /\[dry-run\] 不会写盘/)
})

test('--tool 未知值：退出码 1 并列出可选值', () => {
  const out = cli(['--tool', 'vscode', '--dry-run'])
  assert.equal(out.status, 1)
  assert.match(out.stderr, /未知 --tool/)
  assert.match(out.stderr, /dsh \| claude \| codex \| trae/)
})

test('--dest 与 --target 层级不同：dest 精确目录、target 生成 <base>/stop-wishing', () => {
  const root = mkdtempSync(join(tmpdir(), 'sw-levels-'))
  const destDir = join(root, 'dest')
  assert.equal(cli(['--dest', destDir]).status, 0)
  assert.equal(existsSync(join(destDir, 'SKILL.md')), true, '--dest 应直接装进该目录')
  assert.equal(existsSync(join(destDir, 'stop-wishing', 'SKILL.md')), false, '--dest 不应再多套一层')

  const base = join(root, 'base')
  assert.equal(cli(['--target', base]).status, 0)
  assert.equal(existsSync(join(base, 'stop-wishing', 'SKILL.md')), true, '--target 应生成 <base>/stop-wishing')
  assert.equal(existsSync(join(base, 'SKILL.md')), false, '--target 不应把文件散在 base 根下')
})

test('--verify：目标内容落后于源时逐文件 hash 报 WARN，退出码 4', () => {
  const dir = join(mkdtempSync(join(tmpdir(), 'sw-stale-')), 'stop-wishing')
  assert.equal(cli(['--dest', dir]).status, 0)
  appendFileSync(join(dir, 'SKILL.md'), '\n<!-- 目标里被改过一个字节，模拟旧版本/被手改 -->\n', 'utf8')
  const out = cli(['--dest', dir, '--verify'])
  assert.equal(out.status, 4, out.stdout + out.stderr)
  assert.match(out.stdout, /\[WARN\] SKILL\.md/)
  assert.match(out.stdout, /内容落后于源/)
  assert.match(out.stderr, /落后于源|WARN/)
})

test('三处参数说明一致：install.js --help / README / SKILL.md 的参数与退出码集合相同', () => {
  const help = usage()
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8')
  const skill = readFileSync(join(ROOT, 'SKILL.md'), 'utf8')
  const readmeLines = readme.split('\n')
  const readmeIndex = readmeLines.findIndex(line => line.includes('参数：`--tool`'))
  const readmeBlock = readmeLines.slice(readmeIndex, readmeIndex + 10).join('\n')
  const skillRow = skill.split('\n').find(line => line.startsWith('| `install.js`'))
  assert.ok(readmeIndex >= 0, 'README 里找不到「参数：`--tool` …」这一行')
  assert.ok(skillRow, 'SKILL.md 里找不到 install.js 表格行')

  const flags = ['--tool', '--dest', '--verify', '--dry-run', '--force', '--target']
  for (const [name, text] of [['--help', help], ['README', readmeBlock], ['SKILL.md', skillRow]]) {
    for (const flag of flags) assert.ok(text.includes(flag), `${name} 缺参数 ${flag}`)
    for (const code of ['0', '1', '2', '3', '4']) assert.ok(text.includes(code), `${name} 缺退出码 ${code}`)
  }
  assert.match(help, /--dest.*精确目标目录/)
  assert.match(help, /--target.*兼容旧用法/)
  assert.match(readmeBlock, /--dest.*精确目标目录/)
  assert.match(readmeBlock, /--target.*兼容旧用法/)
  assert.match(skillRow, /--dest.*精确目标/)
  assert.match(skillRow, /--target.*兼容旧用法/)
})

test('README 无人值守兜底：无法提问时按环境判断并写明假设', () => {
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8')
  assert.match(readme, /无法向用户提问/)
  assert.match(readme, /我假设你用的是/)
  assert.match(readme, /优先装到 `~\/\.agents\/skills`/)
})
