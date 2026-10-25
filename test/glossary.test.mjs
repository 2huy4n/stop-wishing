import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const HTML = join(ROOT, 'glossary', 'vibe-coding-glossary.html')
const EN = join(ROOT, 'glossary', 'en.json')

function load() {
  const html = readFileSync(HTML, 'utf8')
  const cats = [...html.matchAll(/\{ id:'([^']+)',\s*name:'([^']+)'/g)].map(m => ({ id: m[1], name: m[2] }))
  const terms = [...html.matchAll(/\{ c:'([^']+)', zh:'([^']*)'([\s\S]*?) \}/g)].map(([, c, zh, rest]) => {
    const field = name => {
      const raw = rest.match(new RegExp(name + ":'((?:[^'\\\\]|\\\\.)*)'"))?.[1]
      return raw === undefined ? null : raw.replace(/\\(.)/g, '$1')
    }
    return { c, zh, d: field('d'), a: field('a'), de: field('de'), ae: field('ae') }
  })
  return { html, cats, terms }
}

test('术语表：147 词、9 分类、每条都有中文与英文两段', () => {
  const { cats, terms } = load()
  assert.equal(terms.length, 147, '词条总数变了：如果是有意新增，同步更新本断言与 en.json')
  assert.equal(cats.length, 9)
  for (const t of terms) {
    assert.ok(t.d && t.a, `${t.zh} 缺中文解释或中文比方`)
    assert.ok(t.de && t.ae, `${t.zh} 缺英文解释或英文比方`)
  }
})

test('术语表：无重复词条，分类计数与预期一致', () => {
  const { cats, terms } = load()
  const zh = terms.map(t => t.zh)
  assert.equal(new Set(zh).size, zh.length, '存在重复词条')
  const counts = Object.fromEntries(cats.map(c => [c.name, terms.filter(t => t.c === c.id).length]))
  assert.deepEqual(counts, {
    'AI 与模型': 12,
    '提示词与协作': 19,
    '代码与文件': 32,
    '网站是怎么跑起来的': 27,
    '账号与凭证': 7,
    '风险与合规': 4,
    'Git 与 GitHub': 16,
    '运行、调试与出错': 17,
    '项目黑话': 13,
  })
})

test('术语表：en.json 与 HTML 内联英文逐条一致', () => {
  const { terms } = load()
  const en = JSON.parse(readFileSync(EN, 'utf8'))
  assert.equal(en.length, terms.length)
  const byZh = new Map(en.map(item => [item.zh, item]))
  for (const t of terms) {
    const item = byZh.get(t.zh)
    assert.ok(item, `en.json 缺 ${t.zh}`)
    assert.equal(item.de, t.de, `${t.zh} 的 de 与 HTML 不一致`)
    assert.equal(item.ae, t.ae, `${t.zh} 的 ae 与 HTML 不一致`)
  }
})

test('README 的本地链接都指向存在的文件', () => {
  for (const name of ['README.md', 'README.en.md']) {
    const text = readFileSync(join(ROOT, name), 'utf8')
    const links = [...text.matchAll(/\]\(([^)#]+)\)/g)].map(m => m[1]).filter(link => !/^https?:/.test(link))
    for (const link of links) assert.ok(existsSync(resolve(ROOT, link)), `${name} 断链: ${link}`)
  }
})
