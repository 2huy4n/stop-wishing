import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const TEXT = readFileSync(join(ROOT, 'SKILL.md'), 'utf8')

function frontMatter() {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(TEXT)
  assert.ok(match, 'SKILL.md 必须有 front-matter')
  const fields = {}
  for (const line of match[1].split('\n')) {
    const kv = /^([a-zA-Z-]+):\s*(.*)$/.exec(line)
    if (kv) fields[kv[1]] = kv[2]
  }
  return fields
}

test('SKILL.md：front-matter 合规（name kebab / user-invocable / 触发词齐全）', () => {
  const fields = frontMatter()
  assert.equal(fields.name, 'stop-wishing')
  assert.match(fields.name, /^[a-z0-9]+(-[a-z0-9]+)*$/, 'name 必须是 kebab-case')
  assert.equal(fields['user-invocable'], 'true')
  for (const word of ['stop-wishing', '许愿式编程', '先解释再写码', '改动前备份', '禁止硬编码', '初始化项目文档']) {
    assert.ok(fields.description.includes(word), `description 缺触发词: ${word}`)
  }
  assert.ok(fields.description.includes('适用场景'), 'description 要写明适用场景')
})

test('SKILL.md：13 个章节一个不少', () => {
  const headings = [...TEXT.matchAll(/^## (\d+)\)/gm)].map(match => Number(match[1]))
  assert.deepEqual(headings, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
  const required = [
    '触发条件', '定义', '用户画像', '模糊度分档', '需求卡', '默认值规则', '许可证', '工作循环',
    '硬约束', '证据格式', '冲突裁决', '失败处理', '逃生门',
  ]
  for (const word of required) assert.ok(TEXT.includes(word), `缺章节关键词: ${word}`)
})

test('SKILL.md：关键机制写全（档位先报 / 七字段 / 三列证据 / 3 次升级）', () => {
  assert.ok(TEXT.includes('必须先报'), '进 skill 要先报档位')
  for (const field of ['目标', '用户与场景', '输入输出', '范围边界', '验收方式', '约束', '交付形态']) {
    assert.ok(TEXT.includes(field), `需求卡缺字段: ${field}`)
  }
  assert.ok(TEXT.includes('断言') && TEXT.includes('证据') && TEXT.includes('来源'), '三列表头')
  assert.ok(TEXT.includes('最多试 3 次') || TEXT.includes('最多 3 次'), '失败处理要有 3 次上限')
})

test('F5：术语表补齐 4 条（传染性许可证/动态链接/衍生作品/回归测试）', () => {
  for (const term of ['传染性许可证', '动态链接', '衍生作品', '回归测试']) {
    assert.ok(TEXT.includes(term), `术语表缺: ${term}`)
  }
})

test('许可证矩阵：白名单全场景可用、传染性/弱传染在商用闭源拒绝、无 LICENSE 仅自用', () => {
  const rows = new Map()
  for (const line of TEXT.split(/\r?\n/)) {
    const match = /^\| ([^|]+?) \|/.exec(line)
    if (match) rows.set(match[1].trim(), line.split('|').map(cell => cell.trim()))
  }

  const header = rows.get('许可证')
  assert.ok(header, '找不到许可证矩阵的表头行')
  for (const scenario of ['自用', '免费闭源分发', '开源（同许可）', '商用闭源']) {
    assert.ok(header.includes(scenario), `表头缺场景：${scenario}`)
  }
  const whitelist = [...rows.keys()].find(key => key.includes('MIT') && key.includes('Apache-2.0'))
  assert.ok(whitelist, '找不到白名单行（MIT / Apache-2.0 / BSD / ISC / 0BSD / Unlicense / CC0）')
  const whitelistCells = rows.get(whitelist)
  assert.deepEqual(whitelistCells.slice(2, 6).map(cell => cell.startsWith('✅')), [true, true, true, true])

  const copyleft = rows.get([...rows.keys()].find(key => key === 'GPL / AGPL'))
  assert.ok(copyleft, '找不到 GPL / AGPL 行')
  assert.ok(copyleft[2].startsWith('✅'), 'GPL/AGPL 自用应可用')
  assert.ok(copyleft[3].startsWith('❌'), 'GPL/AGPL 免费闭源分发应拒绝')
  assert.ok(copyleft[4].startsWith('✅'), 'GPL/AGPL 开源同许可应可用')
  assert.ok(copyleft[5].startsWith('❌'), 'GPL/AGPL 商用闭源应拒绝')

  const lgpl = rows.get([...rows.keys()].find(key => key === 'LGPL'))
  assert.ok(lgpl, '找不到 LGPL 行')
  assert.ok(lgpl[5].startsWith('❌') && lgpl[5].includes('商用闭源'), 'LGPL 商用闭源必须拒绝')

  const none = rows.get([...rows.keys()].find(key => key.includes('无 LICENSE')))
  assert.ok(none, '找不到「无 LICENSE」行')
  assert.ok(none[2].startsWith('⚠️') || none[2].includes('仅自用'), '无 LICENSE 仅自用')
  for (const index of [3, 4, 5]) assert.ok(none[index].startsWith('❌'), `无 LICENSE 的场景 ${index} 应拒绝`)

  assert.match(TEXT, /自有代码例外/)
  assert.match(TEXT, /该来源跳过闸门|该来源\*\*才跳过闸门|跳过闸门/)
})

test('许可证口径：商用闭源下 LGPL 也拒绝，并写明从紧理由', () => {
  assert.match(TEXT, /\| LGPL \|.*商用闭源一律拒绝/)
  assert.ok(TEXT.includes('本 skill 从紧'), '要说明「法理有空间但我们从紧」')
  assert.ok(TEXT.includes('GPL / AGPL') && TEXT.includes('一律拒绝'))
})

test('F15：自有代码例外必须记录来源/原话/日期', () => {
  assert.ok(TEXT.includes('来源（仓库 / 文件路径）') || TEXT.includes('| 来源 |'), '要有来源一栏')
  assert.ok(TEXT.includes('作者声明'), '要有作者声明')
  assert.ok(TEXT.includes('原话'), '要求记录原话')
  assert.ok(TEXT.includes('不扩散'), '不扩散到第三方依赖')
})

test('F11：时间戳口径为 ISO 8601 + 本机时区偏移', () => {
  assert.ok(TEXT.includes('ISO 8601'), '要写明 ISO 8601')
  assert.ok(TEXT.includes('本机时区偏移'), '要写明含本机时区偏移')
  assert.doesNotMatch(TEXT, /`YYYY-MM-DDTHH:mm\+08:00`/, '不应再把 +08:00 写成固定格式')
})

test('F6：脚本表包含 install.js，并写明各脚本实际退出码', () => {
  assert.ok(TEXT.includes('`install.js`'), '脚本表要有 install.js')
  assert.ok(TEXT.includes('0 成功或 dry-run；1 参数或覆盖冲突；2 源文件缺失；3 自检失败（缺失或不一致）；4 自检告警（内容落后于源）'), 'install 的退出码（0/1/2/3/4）')
  assert.ok(TEXT.includes('2 模板缺失'), 'init-docs 的 exit 2')
  assert.ok(TEXT.includes('2 `SKILL.md` 缺失'), 'build-portable 的 exit 2')
  assert.ok(TEXT.includes('.hardcodeignore'), 'check-hardcode 要提 .hardcodeignore')
})

test('F4：定义「文件头改动块」并给出格式示例', () => {
  assert.ok(TEXT.includes('文件头改动块（定义与格式）'), '要有定义小节')
  assert.ok(TEXT.includes('改动：') && TEXT.includes('原因：') && TEXT.includes('回滚：'), '示例要含改动/原因/回滚')
})

test('F13：逃生门明确「仍要先解释、只是不等确认」', () => {
  assert.ok(TEXT.includes('仍要先解释'), '逃生门仍要求先解释')
  assert.ok(TEXT.includes('不等确认') || TEXT.includes('不再等确认'), '要写明只是不等确认')
})

test('F1：文档名统一为 docs/LICENSES.md，不再出现小写引用', () => {
  assert.ok(TEXT.includes('docs/LICENSES.md'), '交付物名必须是 LICENSES.md')
  assert.doesNotMatch(TEXT, /docs\/licenses\.md/, '不能残留小写 licenses.md')
})
