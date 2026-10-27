import { readFileSync } from 'node:fs'

const CSS = readFileSync(new URL('./style.css', import.meta.url), 'utf8')

const esc = value => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const mdCell = value => String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')

const TYPE_LABEL = {
  prototype: 'PROTOTYPE / 原型确认',
  delivery: 'DELIVERY / 交付报告',
}

function fold(id, title, meta, body, open = false) {
  return `<details class="fold" id="sec-${esc(id)}"${open ? ' open' : ''}>
<summary><span class="fold-title"><span class="num">${esc(id)}</span>${esc(title)}</span><span class="fold-meta">${esc(meta)}</span></summary>
<div class="fold-body">${body}</div>
</details>`
}

function sectionHtml(section, index) {
  if (section.kind === 'text') return fold(section.id, section.title, '文本', `<p>${esc(section.body)}</p>`, index === 0)
  if (section.kind === 'list') {
    return fold(section.id, section.title, `${(section.items ?? []).length} 项`, `<ul>${(section.items ?? []).map(item => `<li>${esc(item)}</li>`).join('')}</ul>`, index === 0)
  }
  if (section.kind === 'steps') {
    return fold(section.id, section.title, `${(section.items ?? []).length} 步`, `<ol>${(section.items ?? []).map(item => `<li>${esc(item)}</li>`).join('')}</ol>`, index === 0)
  }
  const rows = (section.rows ?? []).map(row => `<tr><td>${esc(row.label)}</td><td>${esc(row.value)}${row.note ? `<span class="proof"> — ${esc(row.note)}</span>` : ''}</td></tr>`).join('')
  return fold(section.id, section.title, `${(section.rows ?? []).length} 行`, `<table class="table"><tbody>${rows}</tbody></table>`, index === 0)
}

function sectionMarkdown(section) {
  const head = `## ${section.title}`
  if (section.kind === 'text') return `${head}\n\n${section.body ?? ''}`
  if (section.kind === 'list') return `${head}\n\n${(section.items ?? []).map(item => `- ${item}`).join('\n')}`
  if (section.kind === 'steps') return `${head}\n\n${(section.items ?? []).map((item, index) => `${index + 1}. ${item}`).join('\n')}`
  const rows = (section.rows ?? []).map(row => `| ${mdCell(row.label)} | ${mdCell(row.value)}${row.note ? ` — ${mdCell(row.note)}` : ''} |`).join('\n')
  return `${head}\n\n| 项 | 内容 |\n|---|---|\n${rows}`
}

export function render(data) {
  const stats = (data.stats ?? []).map(stat => `<div class="stat"><span class="stat-value">${esc(stat.value)}</span><span class="stat-label">${esc(stat.label)}${stat.note ? `<br>${esc(stat.note)}` : ''}</span></div>`).join('')
  const meta = [
    ['created', data.created_at],
    data.project ? ['project', data.project] : null,
    data.meta?.commit ? ['commit', data.meta.commit] : null,
    data.meta?.tag ? ['tag', data.meta.tag] : null,
    data.meta?.tests ? ['tests', data.meta.tests] : null,
    data.meta?.ci ? ['ci', data.meta.ci] : null,
  ].filter(Boolean).map(([key, value]) => `<span class="chip">${esc(key)}: ${esc(value)}</span>`).join('')

  const sections = data.sections.map(sectionHtml).join('')
  const evidence = data.evidence.map(row => `<tr><td>${esc(row.claim)}</td><td class="proof">${esc(row.proof)}</td><td>${esc(row.source ?? '')}</td></tr>`).join('')
  const risks = data.risks.map(risk => `<div class="risk"><span class="level ${esc(risk.level)}">${esc(risk.level)}</span><div>${esc(risk.text)}${risk.mitigation ? `<span class="mitigation">处置：${esc(risk.mitigation)}</span>` : ''}</div></div>`).join('')
  const next = data.next.map(item => `<div class="next-item"><span class="next-id">${esc(item.id)}</span><div><div class="next-title">${esc(item.title)}</div>${item.why ? `<div class="next-why">${esc(item.why)}</div>` : ''}</div></div>`).join('')
  const limits = data.limits.map(item => `<li>${esc(item)}</li>`).join('')

  const html = `<!doctype html>
<html lang="zh-CN" data-theme="simple">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(data.title)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="sheet-rule"></div>
<header>
  <div class="eyebrow">${esc(TYPE_LABEL[data.type])} / ${esc(data.id)}</div>
  <h1>${esc(data.title)}</h1>
  ${data.subtitle ? `<p class="subtitle">${esc(data.subtitle)}</p>` : ''}
  <div class="meta">${meta}</div>
</header>

<div class="verdict">
  <div><div class="verdict-label">结论 / Verdict</div><p>${esc(data.summary)}</p></div>
  ${stats ? `<div class="stats">${stats}</div>` : ''}
</div>

${sections}

${fold('E', '证据', `${data.evidence.length} 条`, `<table class="table"><thead><tr><th>主张</th><th>证据</th><th>来源</th></tr></thead><tbody>${evidence}</tbody></table>`)}

${fold('R', '风险与限制', `${data.risks.length + data.limits.length} 项`, `${risks}${limits ? `<div class="limits"><ul>${limits}</ul></div>` : ''}`)}

${data.next.length > 0 ? fold('N', '下一步', `${data.next.length} 项`, `<div class="next">${next}</div>`, true) : ''}

<footer>
  <span>stop-wishing-report · simple theme</span>
  <span>generated ${esc(new Date().toISOString())}</span>
</footer>
<script>
(() => {
  const all = [...document.querySelectorAll('details.fold')];
  const openAll = () => all.forEach(d => { d.dataset.wasOpen = d.open; d.open = true; });
  const restore = () => all.forEach(d => { d.open = d.dataset.wasOpen === 'true'; });
  addEventListener('beforeprint', openAll);
  addEventListener('afterprint', restore);
})();
</script>
</body>
</html>
`

  const markdown = [
    `# ${data.title}`,
    data.subtitle ? `> ${data.subtitle}` : '',
    '',
    `${TYPE_LABEL[data.type]} · ${data.id} · ${data.created_at}`,
    '',
    '## 结论',
    '',
    data.summary,
    ...(data.stats && data.stats.length > 0 ? ['', '## 关键数字', '', '| 指标 | 数值 | 说明 |', '|---|---|---|', ...data.stats.map(stat => `| ${mdCell(stat.label)} | ${mdCell(stat.value)} | ${mdCell(stat.note ?? '')} |`)] : []),
    '',
    ...data.sections.map(section => `${sectionMarkdown(section)}\n`),
    '## 证据',
    '',
    '| 主张 | 证据 | 来源 |',
    '|---|---|---|',
    ...data.evidence.map(row => `| ${mdCell(row.claim)} | ${mdCell(row.proof)} | ${mdCell(row.source ?? '')} |`),
    '',
    '## 风险与限制',
    '',
    ...data.risks.map(risk => `- **${risk.level}** ${risk.text}${risk.mitigation ? `（处置：${risk.mitigation}）` : ''}`),
    ...data.limits.map(item => `- ${item}`),
    '',
    ...(data.next.length > 0 ? ['## 下一步', '', ...data.next.map(item => `${item.id}. ${item.title}${item.why ? ` — ${item.why}` : ''}`), ''] : []),
    `---`,
    `generated ${new Date().toISOString()} · stop-wishing-report`,
  ].filter(line => line !== undefined).join('\n')

  return { html, markdown }
}
