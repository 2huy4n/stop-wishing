import { readFileSync } from 'node:fs'

const CSS = readFileSync(new URL('./style.css', import.meta.url), 'utf8')
const esc = value => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const TYPE_LABEL = {
  prototype: 'PROTOTYPE CONFIRMATION',
  delivery: 'DELIVERY TRANSMISSION',
}

const ASCII = `╔══════════════════════════════════════════════════════════╗
║  STOP-WISHING // REPORT RENDERER                         ║
║  HACKER THEME // SINGLE PAYLOAD // NO EXTERNAL ASSETS   ║
╚══════════════════════════════════════════════════════════╝`

function sectionHtml(section) {
  const head = `<div class="node-head"><span class="node-id">NODE ${esc(section.id)}</span><h2>${esc(section.title)}</h2></div>`
  if (section.kind === 'text') return `<section class="node">${head}<p>${esc(section.body)}</p></section>`
  if (section.kind === 'list') return `<section class="node">${head}<ul>${(section.items ?? []).map(item => `<li>${esc(item)}</li>`).join('')}</ul></section>`
  if (section.kind === 'steps') return `<section class="node">${head}<ol>${(section.items ?? []).map(item => `<li>${esc(item)}</li>`).join('')}</ol></section>`
  const rows = (section.rows ?? []).map(row => `<tr><td>${esc(row.label)}</td><td>${esc(row.value)}${row.note ? `<span class="proof"> // ${esc(row.note)}</span>` : ''}</td></tr>`).join('')
  return `<section class="node">${head}<table class="matrix"><tbody>${rows}</tbody></table></section>`
}

export function render(data) {
  const stats = (data.stats ?? []).map(stat => `<div class="stat"><span class="stat-value">${esc(stat.value)}</span><span class="stat-label">${esc(stat.label)}</span>${stat.note ? `<span class="stat-note">${esc(stat.note)}</span>` : ''}</div>`).join('')
  const sections = data.sections.map(sectionHtml).join('')
  const evidence = data.evidence.map(row => `<tr><td>${esc(row.claim)}</td><td class="proof">${esc(row.proof)}</td><td>${esc(row.source ?? '')}</td></tr>`).join('')
  const risks = data.risks.map(risk => `<div class="alert"><span class="alert-level ${esc(risk.level)}">${esc(risk.level)}</span><div class="alert-text">${esc(risk.text)}${risk.mitigation ? `<span class="alert-fix">FIX // ${esc(risk.mitigation)}</span>` : ''}</div></div>`).join('')
  const next = data.next.map(item => `<div class="op"><span class="op-id">${esc(item.id)}</span><div><div class="op-title">${esc(item.title)}</div>${item.why ? `<div class="op-why">${esc(item.why)}</div>` : ''}</div></div>`).join('')
  const limits = data.limits.map(item => `<li>${esc(item)}</li>`).join('')
  const manifest = `<div class="manifest">
      <div class="manifest-cell"><span>SECTIONS</span><b>${String(data.sections.length).padStart(2, '0')}</b></div>
      <div class="manifest-cell"><span>EVIDENCE</span><b>${String(data.evidence.length).padStart(2, '0')}</b></div>
      <div class="manifest-cell"><span>RISKS</span><b>${String(data.risks.length).padStart(2, '0')}</b></div>
      <div class="manifest-cell"><span>NEXT</span><b>${String(data.next.length).padStart(2, '0')}</b></div>
    </div>`
  const meta = [
    data.project ? `PROJECT ${esc(data.project)}` : null,
    data.meta?.commit ? `COMMIT ${esc(data.meta.commit)}` : null,
    data.meta?.tag ? `TAG ${esc(data.meta.tag)}` : null,
    data.meta?.tests ? `TESTS ${esc(data.meta.tests)}` : null,
    data.meta?.ci ? `CI ${esc(data.meta.ci)}` : null,
  ].filter(Boolean).join(' / ')

  const html = `<!doctype html>
<html lang="zh-CN" data-theme="hacker">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(data.title)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <div class="topline">
    <span><b>stop-wishing</b> // report</span>
    <span>payload ${esc(data.id)}</span>
    <span>${esc(data.created_at)}</span>
    <span>theme <b>hacker</b></span>
  </div>

  <header class="hero">
    <pre class="ascii">${esc(ASCII)}</pre>
    <div class="kicker">${esc(TYPE_LABEL[data.type])}</div>
    <h1>${esc(data.title)}</h1>
    ${data.subtitle ? `<p class="subtitle">${esc(data.subtitle)}</p>` : ''}
    ${meta ? `<p class="subtitle">${meta}</p>` : ''}
    ${stats ? `<div class="status">${stats}</div>` : ''}
    <div class="verdict">
      <div class="verdict-label">EXECUTIVE READOUT</div>
      <p>${esc(data.summary)}</p>
    </div>
    ${manifest}
  </header>

  <main>
    ${sections}

    <section class="node" id="evidence">
      <div class="node-head"><span class="node-id">NODE E</span><h2>证据矩阵</h2></div>
      <table class="matrix">
        <thead><tr><th>CLAIM</th><th>PROOF</th><th>SOURCE</th></tr></thead>
        <tbody>${evidence}</tbody>
      </table>
    </section>

    <section class="node" id="risks">
      <div class="node-head"><span class="node-id">NODE R</span><h2>风险与限制</h2></div>
      ${risks}
      ${limits ? `<div class="limits"><ul>${limits}</ul></div>` : ''}
    </section>

    ${next ? `<section class="node" id="next"><div class="node-head"><span class="node-id">NODE N</span><h2>下一步</h2></div><div class="ops">${next}</div></section>` : ''}
  </main>

  <footer>
    <span><b>stop-wishing-report</b> // hacker</span>
    <span>generated ${esc(new Date().toISOString())}</span>
    <span>end of payload</span>
  </footer>
</div>
</body>
</html>
`
  return { html }
}
