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
  const count = section.kind === 'text'
    ? 'TEXT'
    : section.kind === 'list' || section.kind === 'steps'
      ? `${(section.items ?? []).length} ITEMS`
      : `${(section.rows ?? []).length} ROWS`
  const head = `<div class="node-status"><span>NODE ${esc(section.id)}</span><span>${count}</span><span>RENDER OK</span></div><div class="node-head"><h2>${esc(section.title)}</h2></div>`
  const telemetry = `<div class="node-telemetry"><span>SOURCE report.json</span><span>${count}</span><span>RENDER OK</span><div class="telemetry-bars">${'<i></i>'.repeat(12)}</div></div>`
  const frame = body => `<section class="node">${head}${body}${telemetry}</section>`
  if (section.kind === 'text') return frame(`<p>${esc(section.body)}</p>`)
  if (section.kind === 'list') return frame(`<ul>${(section.items ?? []).map(item => `<li>${esc(item)}</li>`).join('')}</ul>`)
  if (section.kind === 'steps') return frame(`<ol>${(section.items ?? []).map(item => `<li>${esc(item)}</li>`).join('')}</ol>`)
  const rows = (section.rows ?? []).map(row => `<tr><td>${esc(row.label)}</td><td>${esc(row.value)}${row.note ? `<span class="proof"> // ${esc(row.note)}</span>` : ''}</td></tr>`).join('')
  return frame(`<table class="matrix"><tbody>${rows}</tbody></table>`)
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
  const evidenceTerminal = `<div class="terminal compact">
      <div class="terminal-head"><span>EVIDENCE STREAM</span><span>${String(data.evidence.length).padStart(2, '0')} RECORDS</span><span class="live">● LINKED</span></div>
      <pre>${data.evidence.map((row, index) => `<span class="prompt">[${String(index + 1).padStart(2, '0')}]</span> ${esc(row.claim)} <span class="ok">=&gt; ${esc(row.proof)}</span>`).join('\n')}</pre>
    </div>`
  const nodeIndex = `<div class="index">
      <div class="index-head"><span>NODE INDEX</span><span>${String(data.sections.length + 3).padStart(2, '0')} ENTRIES</span></div>
      <div class="index-grid">${data.sections.map(section => `<span><b>${esc(section.id)}</b>${esc(section.title)}</span>`).join('')}<span><b>E</b>证据矩阵</span><span><b>R</b>风险与限制</span><span><b>N</b>下一步</span></div>
    </div>`
  const riskTerminal = `<div class="terminal compact">
      <div class="terminal-head"><span>RISK LOG</span><span>${String(data.risks.length).padStart(2, '0')} ALERTS</span><span class="live">● MONITOR</span></div>
      <pre>${data.risks.map(risk => `<span class="alert-level ${esc(risk.level)}">[${esc(risk.level.toUpperCase())}]</span> ${esc(risk.text)}`).join('\n')}</pre>
    </div>`
  const signal = `<div class="signal"><span>SIGNAL</span><div class="signal-bars">${'<i></i>'.repeat(18)}</div><span>PAYLOAD READY</span></div>`
  const rail = `<div class="rail"><span>SECTIONS ${String(data.sections.length).padStart(2, '0')}</span><span>EVIDENCE ${String(data.evidence.length).padStart(2, '0')}</span><span>RISKS ${String(data.risks.length).padStart(2, '0')}</span><span>NEXT ${String(data.next.length).padStart(2, '0')}</span><span class="ok">RENDER OK</span></div>`
  const terminal = `<div class="terminal">
      <div class="terminal-head"><span>RENDER LOG</span><span>${esc(data.id)}</span><span class="live">● LIVE</span></div>
      <pre><span class="prompt">$</span> render --payload ${esc(data.id)}
<span class="prompt">$</span> type ${esc(data.type)}
<span class="prompt">$</span> sections ${String(data.sections.length).padStart(2, '0')} / evidence ${String(data.evidence.length).padStart(2, '0')} / risks ${String(data.risks.length).padStart(2, '0')}
<span class="prompt">$</span> theme hacker
<span class="ok">[ ok ]</span> payload bound to theme; no external assets
<span class="cursor">█</span></pre>
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
  ${signal}
  ${rail}

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

  ${terminal}
  <pre class="glyph">▚▚▚ ░░░ SECTION STREAM ░░░ ▚▚▚ ░░░ PAYLOAD NODES ░░░ ▚▚▚ ░░░ EVIDENCE MATRIX ░░░ ▚▚▚</pre>
  ${nodeIndex}

  <main>
    ${sections}
    ${evidenceTerminal}

    <section class="node" id="evidence">
      <div class="node-head"><span class="node-id">NODE E</span><h2>证据矩阵</h2></div>
      <table class="matrix">
        <thead><tr><th>CLAIM</th><th>PROOF</th><th>SOURCE</th></tr></thead>
        <tbody>${evidence}</tbody>
      </table>
    </section>

    <section class="node" id="risks">
      <div class="node-head"><span class="node-id">NODE R</span><h2>风险与限制</h2></div>
      ${riskTerminal}
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
