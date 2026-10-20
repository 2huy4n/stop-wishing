import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { checkEnv, envPaths, PROBE_TIMEOUT_MS } from '../scripts/check-env.js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

function cli(args) {
  return spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 20000 })
}

test('check-env：模块输出的字段结构完整', () => {
  const env = checkEnv(ROOT)
  assert.equal(env.tool, 'stop-wishing/check-env')
  assert.match(env.at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}[+-]\d{2}:\d{2}$/)
  assert.equal(env.node.ok, true)
  assert.match(env.node.version, /^v\d+\./)
  assert.equal(typeof env.git.ok, 'boolean')
  assert.equal(typeof env.bash.ok, 'boolean')
  assert.equal(typeof env.repo.isGitRepo, 'boolean')
  assert.ok(['git-tag', 'bak'].includes(env.backup.method))
  assert.ok(Array.isArray(env.missing))
  assert.equal(env.ok, env.criticalMissing.length === 0)
})

test('check-env：CLI 输出可解析 JSON，退出码与 ok 一致', () => {
  const out = cli(['scripts/check-env.js'])
  assert.equal(out.status, 0)
  const parsed = JSON.parse(out.stdout)
  assert.equal(parsed.ok, true)
  assert.equal(parsed.backup.method, 'git-tag', '本仓库是 git 仓库，建议 git-tag')
})

test('check-env：探测常量集中定义，且允许环境变量覆盖', () => {
  assert.equal(typeof PROBE_TIMEOUT_MS, 'number')
  assert.ok(PROBE_TIMEOUT_MS > 0)
  const saved = process.env.SW_TEST_PATHS
  try {
    process.env.SW_TEST_PATHS = ['a', 'b', 'c'].join(process.platform === 'win32' ? ';' : ':')
    assert.deepEqual(envPaths('SW_TEST_PATHS', ['fallback']), ['a', 'b', 'c'])
    delete process.env.SW_TEST_PATHS
    assert.deepEqual(envPaths('SW_TEST_PATHS', ['fallback']), ['fallback'])
  } finally {
    if (saved === undefined) delete process.env.SW_TEST_PATHS
    else process.env.SW_TEST_PATHS = saved
  }
})
