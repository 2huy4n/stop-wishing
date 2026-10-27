#!/usr/bin/env node
// 2026-10-27T13:20+08:00 · 新建 preflight.js：把 check-env / check-hardcode / check-licenses 合成一次预检；
// 目的：主技能只需记住“跑 preflight + 读退出码”，不必背四个脚本的参数。
// 回滚点：实验分支 experiment/skill-60 上的新文件，删除即可完全撤销。
import { existsSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { checkEnv, stamp } from './check-env.js'
import { checkHardcode } from './check-hardcode.js'
import { checkLicenses } from './check-licenses.js'

const USES = ['self', 'free-closed', 'open-source', 'commercial']
const USE_LABELS = {
  self: '自用',
  'free-closed': '免费闭源分发',
  'open-source': '同许可开源',
  commercial: '商用闭源',
}
const DEFAULT_USE = 'commercial'
const HARDCODE_THRESHOLD = 1000

export function parseArgs(argv = []) {
  const options = {
    dir: process.cwd(),
    use: DEFAULT_USE,
    strict: false,
    prodOnly: false,
    json: false,
    skipHardcode: false,
    skipLicenses: false,
    help: false,
    unknown: [],
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--dir' || arg.startsWith('--dir=')) {
      options.dir = arg.includes('=') ? arg.slice('--dir='.length) : argv[i + 1] ?? options.dir
      if (!arg.includes('=')) i += 1
    } else if (arg === '--use' || arg.startsWith('--use=')) {
      options.use = arg.includes('=') ? arg.slice('--use='.length) : argv[i + 1] ?? options.use
      if (!arg.includes('=')) i += 1
    } else if (arg === '--strict') options.strict = true
    else if (arg === '--prod-only') options.prodOnly = true
    else if (arg === '--json') options.json = true
    else if (arg === '--skip-hardcode') options.skipHardcode = true
    else if (arg === '--skip-licenses') options.skipLicenses = true
    else if (arg === '--help' || arg === '-h') options.help = true
    else options.unknown.push(arg)
  }
  return options
}

function hasLicenseInput(dir) {
  return existsSync(join(dir, 'package-lock.json')) || existsSync(join(dir, 'node_modules'))
}

/**
 * 跑一次预检。返回 { ok, code, tool, at, dir, use, env, hardcode, license, message? }。
 * code: 0 通过 / 1 有阻断项 / 2 用法或 IO 错误。
 */
export function runPreflight(options = {}) {
  const dir = resolve(options.dir || process.cwd())
  const use = options.use || DEFAULT_USE
  const base = { tool: 'stop-wishing/preflight', at: stamp(), dir, use }

  if (!USES.includes(use)) {
    return { ...base, ok: false, code: 2, message: `未知用途: ${use}；可选 ${USES.join(' / ')}` }
  }

  let stat
  try {
    stat = statSync(dir)
  } catch (error) {
    return { ...base, ok: false, code: 2, message: `目录不存在: ${dir} (${String(error.message ?? error)})` }
  }
  if (!stat.isDirectory()) {
    return { ...base, ok: false, code: 2, message: `不是目录: ${dir}` }
  }

  const env = checkEnv(dir)
  const hardcode = options.skipHardcode
    ? { skipped: true, ok: true, findings: [], message: '按 --skip-hardcode 跳过' }
    : checkHardcode({ path: dir, threshold: HARDCODE_THRESHOLD })

  let license
  if (options.skipLicenses) {
    license = { skipped: true, ok: true, reason: '按 --skip-licenses 跳过' }
  } else if (!hasLicenseInput(dir)) {
    license = { skipped: true, ok: true, reason: '没有 package-lock.json / node_modules，未扫描' }
  } else {
    license = checkLicenses({
      dir,
      use,
      prodOnly: Boolean(options.prodOnly),
      strict: Boolean(options.strict),
    })
  }

  const hardcodeError = !hardcode.skipped && hardcode.code === 2 && (hardcode.findings?.length ?? 0) === 0
  const licenseError = !license.skipped && license.code === 2
  const envBlocking = env.ok === false
  const hardcodeBlocking = !hardcode.skipped && (hardcode.findings?.length ?? 0) > 0
  const licenseBlocking = !license.skipped && license.code === 1

  const code = hardcodeError || licenseError ? 2 : envBlocking || hardcodeBlocking || licenseBlocking ? 1 : 0
  const result = {
    ...base,
    ok: code === 0,
    code,
    env: {
      ok: env.ok,
      missing: env.missing ?? [],
      criticalMissing: env.criticalMissing ?? [],
      repo: env.repo,
      backup: env.backup,
    },
    hardcode: hardcode.skipped
      ? { skipped: true, ok: true, message: hardcode.message }
      : {
          skipped: false,
          ok: (hardcode.findings?.length ?? 0) === 0,
          files: hardcode.files ?? 0,
          findings: (hardcode.findings ?? []).map(item => ({
            file: item.file,
            line: item.line,
            type: item.type,
            snippet: item.snippet,
          })),
          error: hardcodeError ? hardcode.message ?? hardcode.error ?? '硬编码扫描失败' : null,
        },
    license: license.skipped
      ? { skipped: true, ok: true, reason: license.reason }
      : {
          skipped: false,
          ok: license.code !== 1 && license.code !== 2,
          source: license.source,
          counts: license.counts,
          forbidden: (license.packages ?? [])
            .filter(pkg => pkg.status === 'forbidden')
            .map(pkg => ({ name: pkg.name, version: pkg.version, license: pkg.license, reason: pkg.reason })),
          error: licenseError ? license.message ?? '许可证扫描失败' : null,
        },
  }
  if (hardcodeError) result.message = hardcode.message ?? hardcode.error ?? '硬编码扫描失败'
  if (licenseError) result.message = license.message ?? '许可证扫描失败'
  return result
}

function renderText(result) {
  if (result.message && !result.env) return `预检失败: ${result.message}\n`
  const lines = []
  lines.push('预检（stop-wishing）')
  lines.push('')
  lines.push(`目录: ${result.dir}`)
  lines.push(`用途: ${USE_LABELS[result.use]}（${result.use}）`)
  lines.push('')

  lines.push(`环境: ${result.env.ok ? '通过' : '失败'}`)
  if (!result.env.ok) {
    lines.push(`  缺少: ${(result.env.criticalMissing ?? []).join(', ') || '未知'}`)
  }
  lines.push(`  备份方式: ${result.env.backup?.method === 'git-tag' ? 'git tag' : '.bak-*'}`)

  if (result.hardcode.skipped) {
    lines.push(`硬编码: 跳过（${result.hardcode.message}）`)
  } else if (result.hardcode.error) {
    lines.push(`硬编码: 扫描失败 — ${result.hardcode.error}`)
  } else {
    lines.push(`硬编码: ${result.hardcode.ok ? '通过' : `${result.hardcode.findings.length} 处未抑制`}`)
    for (const finding of result.hardcode.findings.slice(0, 8)) {
      lines.push(`  - ${finding.file}:${finding.line} ${finding.type} — ${finding.snippet}`)
    }
    if (result.hardcode.findings.length > 8) lines.push(`  … 另有 ${result.hardcode.findings.length - 8} 处`)
  }

  if (result.license.skipped) {
    lines.push(`许可证: 跳过（${result.license.reason}）`)
  } else if (result.license.error) {
    lines.push(`许可证: 扫描失败 — ${result.license.error}`)
  } else {
    const counts = result.license.counts ?? {}
    lines.push(`许可证: ${result.license.ok ? '无禁止项' : `${counts.forbidden ?? 0} 个禁止项`}`)
    lines.push(`  允许 ${counts.allowed ?? 0} / 需确认 ${counts.warn ?? 0} / 未知 ${counts.unknown ?? 0}`)
    for (const pkg of result.license.forbidden.slice(0, 8)) {
      lines.push(`  - ${pkg.name}@${pkg.version ?? '?'} ${pkg.license ?? '未声明'} — ${pkg.reason}`)
    }
  }

  lines.push('')
  if (result.code === 0) lines.push('结论: 通过（退出码 0）。')
  else if (result.code === 1) lines.push('结论: 有阻断项，先处理再继续（退出码 1）。')
  else lines.push(`结论: 参数或 IO 错误（退出码 2）${result.message ? ` — ${result.message}` : ''}。`)
  return `${lines.join('\n')}\n`
}

function usage() {
  return [
    '用法: node preflight.js [--dir PATH] [--use self|free-closed|open-source|commercial]',
    '       [--strict] [--prod-only] [--json] [--skip-hardcode] [--skip-licenses] [--help]',
    '',
    '一次跑完：环境检查、硬编码扫描、依赖许可证扫描。',
    '退出码: 0 通过 / 1 有阻断项 / 2 用法或 IO 错误。',
    '没有 package-lock.json 或 node_modules 时，许可证扫描标记为“跳过”，不算失败。',
  ].join('\n')
}

if (process.argv[1]?.endsWith('preflight.js')) {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    process.stdout.write(`${usage()}\n`)
    process.exitCode = 0
  } else if (options.unknown.length > 0) {
    process.stderr.write(`未知参数: ${options.unknown.join(' ')}\n\n${usage()}\n`)
    process.exitCode = 2
  } else {
    const result = runPreflight(options)
    if (options.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    else process.stdout.write(renderText(result))
    process.exitCode = result.code
  }
}
