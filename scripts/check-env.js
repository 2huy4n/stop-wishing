#!/usr/bin/env node
// 2026-10-20T18:16+08:00 · check-env：探测 git / bash / node / 是否 git 仓库，给出备份方式建议。
//
// 为什么不用第三方库：这个 skill 要求「零依赖」——用户自己的项目里不该因为跑一次体检多装一堆包。
// 为什么 bash 要按常见路径找：Windows 上 bash 常常不在 PATH 里（Git Bash 才是），
// 只查 PATH 会误报「没有 bash」，进而把备份方式错判成 bak。
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const isWindows = process.platform === 'win32'

// 探测用的常量：候选路径与超时都集中在这里，不散落在函数体里。
// 允许用环境变量覆盖（不同机器 Git/Bash 装法差异很大）：
//   SW_GIT_PATHS / SW_BASH_PATHS  -> 用系统路径分隔符（Windows 是 ;，其他是 :）分隔
//   SW_PROBE_TIMEOUT_MS           -> 单次探测的超时毫秒数
const DEFAULT_PROBE_TIMEOUT_MS = 10000
const GIT_CANDIDATES_WINDOWS = [
  'C:/Program Files/Git/cmd/git.exe',
  'C:/Program Files/Git/bin/git.exe',
  'C:/Program Files (x86)/Git/cmd/git.exe',
]
const GIT_CANDIDATES_UNIX = ['/usr/bin/git', '/usr/local/bin/git', '/opt/homebrew/bin/git']
const BASH_CANDIDATES_WINDOWS = [
  'C:/Program Files/Git/bin/bash.exe',
  'C:/Program Files/Git/usr/bin/bash.exe',
  'C:/Program Files (x86)/Git/bin/bash.exe',
  'C:/Program Files/Git/bin/sh.exe',
]
const BASH_CANDIDATES_UNIX = ['/bin/bash', '/usr/bin/bash', '/usr/local/bin/bash', '/bin/sh']

function positiveNumber(raw, fallback) {
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export function envPaths(name, fallback) {
  const raw = process.env[name]
  if (!raw || raw.trim() === '') return fallback
  return raw
    .split(isWindows ? ';' : ':')
    .map(item => item.trim())
    .filter(Boolean)
}

export const PROBE_TIMEOUT_MS = positiveNumber(process.env.SW_PROBE_TIMEOUT_MS, DEFAULT_PROBE_TIMEOUT_MS)
const bashCandidates = envPaths('SW_BASH_PATHS', isWindows ? BASH_CANDIDATES_WINDOWS : BASH_CANDIDATES_UNIX)
const gitCandidates = envPaths('SW_GIT_PATHS', isWindows ? GIT_CANDIDATES_WINDOWS : GIT_CANDIDATES_UNIX)

/** 统一的一行时间戳：ISO 8601，含**本机**时区偏移（不写死 +08:00）。 */
export function stamp(date = new Date()) {
  const pad = n => String(n).padStart(2, '0')
  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const abs = Math.abs(offset)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

function run(command, args, options = {}) {
  try {
    const out = spawnSync(command, args, { encoding: 'utf8', windowsHide: true, timeout: PROBE_TIMEOUT_MS, ...options })
    if (out.error) return { ok: false, error: String(out.error.message ?? out.error) }
    return { ok: out.status === 0, status: out.status, stdout: (out.stdout ?? '').trim(), stderr: (out.stderr ?? '').trim() }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function probe(command, args, candidates) {
  const direct = run(command, args)
  if (direct.ok) return { ok: true, version: direct.stdout, source: 'PATH' }
  // 沙箱里 spawn 可能被拦（EPERM）：此时「可执行文件存在」仍是有用的事实，
  // 只是拿不到版本号——照实标 blocked，不假装检测成功、也不假装没有。
  const blocked = /EPERM|EACCES|access is denied/i.test(String(direct.error ?? ''))
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue
    const viaPath = run(candidate, args)
    if (viaPath.ok) return { ok: true, version: viaPath.stdout, source: candidate }
    if (blocked) return { ok: true, version: null, source: candidate, blocked: true }
  }
  return { ok: false, error: direct.error ?? direct.stderr ?? 'not found' }
}

/** 不启动进程也能判断「是不是 git 仓库」：从 cwd 往上找 .git（目录或 worktree 的 git 文件）。 */
export function findGitRoot(cwd) {
  let dir = resolve(cwd)
  for (;;) {
    if (existsSync(join(dir, '.git'))) return dir
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

export function checkEnv(cwd = process.cwd()) {
  const nodeVersion = process.version
  const git = probe('git', ['--version'], gitCandidates)
  const bash = probe('bash', ['--version'], bashCandidates)
  const markerRoot = findGitRoot(cwd)
  const spawned = git.ok && !git.blocked && run('git', ['rev-parse', '--is-inside-work-tree'], { cwd }).ok
  const inRepo = markerRoot !== null || spawned

  const missing = []
  if (!git.ok) missing.push('git')
  if (!bash.ok) missing.push('bash')
  // 关键项：只要有一个能用来「备份 + 执行命令」就够了；两个都没有才算缺关键项。
  const criticalMissing = missing.length === 2 ? ['git', 'bash'] : []
  const backupMethod = inRepo ? 'git-tag' : 'bak'

  return {
    tool: 'stop-wishing/check-env',
    at: stamp(),
    platform: `${process.platform}-${process.arch}`,
    node: { ok: true, version: nodeVersion },
    git: {
      ok: git.ok,
      version: git.version === null || git.ok === false ? null : git.version.replace(/^git version\s*/i, ''),
      source: git.ok ? git.source : null,
      blocked: git.blocked === true,
      error: git.ok ? null : git.error,
    },
    bash: {
      ok: bash.ok,
      source: bash.ok ? bash.source : null,
      version: bash.ok && bash.version ? bash.version.split('\n')[0] : null,
      blocked: bash.blocked === true,
      error: bash.ok ? null : bash.error,
    },
    repo: { isGitRepo: inRepo, root: markerRoot, cwd },
    backup: {
      method: backupMethod,
      hint:
        backupMethod === 'git-tag'
          ? '这是 git 仓库：改动前打 tag（如 pre-<改动>-YYYYMMDD-HHmm），回滚用 git checkout <tag>'
          : '不是 git 仓库：改动前用 .bak-YYYYMMDD-HHmm 备份原文件（不要用 git 之外的覆盖式改法）',
    },
    ok: criticalMissing.length === 0,
    missing,
    criticalMissing,
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const result = checkEnv(process.cwd())
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  process.exitCode = result.ok ? 0 : 1
}
