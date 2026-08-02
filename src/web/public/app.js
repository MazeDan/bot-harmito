/* Painel financeiro — vanilla JS, sem dependências externas. */

const TOKEN = new URLSearchParams(location.search).get('t') || ''
let S = null            // estado vindo do servidor
let TAB = 'resumo'

// ---------- utilidades ----------

const $ = (sel, el = document) => el.querySelector(sel)
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const money = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dataBR = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const mesBR = (ym) => { const [y, m] = String(ym).split('-'); return `${MESES[+m - 1] ?? m}/${String(y).slice(2)}` }
const mesLongo = (ym) => {
  const nomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  const [y, m] = String(ym).split('-'); return `${nomes[+m - 1] ?? m} de ${y}`
}

async function api(rota, opts = {}) {
  const url = `/api${rota}${rota.includes('?') ? '&' : '?'}t=${encodeURIComponent(TOKEN)}`
  const res = await fetch(url, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: opts.body ? { 'content-type': 'application/json' } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.erro || `Erro ${res.status}`)
  if (data.state) { S = data.state; }
  return data
}

function toast(msg, tipo = 'ok') {
  const t = el(`<div class="toast ${tipo}">${esc(msg)}</div>`)
  $('#toastHost').append(t)
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300) }, 3600)
}

function modal({ titulo, corpo, acoes = [] }) {
  const bg = el(`<div class="modal-bg"><div class="modal">
    <header><h2>${esc(titulo)}</h2><button class="x">&times;</button></header>
    <div class="body"></div>
    <footer></footer>
  </div></div>`)
  $('.body', bg).innerHTML = corpo
  const foot = $('footer', bg)
  const fechar = () => bg.remove()
  for (const a of acoes) {
    const b = el(`<button class="btn ${a.classe || ''}">${esc(a.label)}</button>`)
    b.onclick = () => a.onClick({ bg, fechar, btn: b })
    foot.append(b)
  }
  const cancelar = el('<button class="btn ghost">Fechar</button>')
  cancelar.onclick = fechar
  foot.append(cancelar)
  $('.x', bg).onclick = fechar
  bg.onclick = (e) => { if (e.target === bg) fechar() }
  $('#modalHost').append(bg)
  return { bg, fechar }
}

const confirmar = (texto) => new Promise((resolve) => {
  const { fechar } = modal({
    titulo: 'Confirmar',
    corpo: `<p style="font-size:14px;line-height:1.6">${esc(texto)}</p>`,
    acoes: [{ label: 'Sim, confirmar', classe: 'danger', onClick: ({ fechar }) => { fechar(); resolve(true) } }],
  })
  const bg = $('#modalHost .modal-bg:last-child')
  bg.addEventListener('click', (e) => { if (e.target === bg) resolve(false) })
  $('.x', bg).addEventListener('click', () => resolve(false))
  void fechar
})

// ---------- gráficos SVG ----------

function barChart(dados, { altura = 170 } = {}) {
  if (!dados.length) return '<div class="empty">Sem dados ainda.</div>'
  const max = Math.max(...dados.map((d) => d.valor), 1)
  const W = 100, gap = 1.4
  const largura = (W - gap * (dados.length - 1)) / dados.length

  const barras = dados.map((d, i) => {
    const h = (d.valor / max) * 74
    const x = i * (largura + gap)
    return `<g>
      <rect class="bar" x="${x}" y="${80 - h}" width="${largura}" height="${Math.max(h, .6)}" rx="0.8">
        <title>${esc(d.rotulo)}: ${money(d.valor)}</title>
      </rect>
      <text x="${x + largura / 2}" y="89" text-anchor="middle" style="font-size:3.2px">${esc(d.rotulo)}</text>
      ${d.valor > 0 ? `<text x="${x + largura / 2}" y="${Math.max(80 - h - 2, 5)}" text-anchor="middle" style="font-size:3px;fill:var(--txt-2)">${Math.round(d.valor)}</text>` : ''}
    </g>`
  }).join('')

  return `<svg viewBox="0 0 100 94" preserveAspectRatio="none" style="width:100%;height:${altura}px;display:block">
    <defs><linearGradient id="gr" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7c5cff"/><stop offset="100%" stop-color="#a78bfa" stop-opacity=".55"/>
    </linearGradient></defs>
    ${[0, 25, 50, 75].map((p) => `<line class="grid-line" x1="0" x2="100" y1="${80 - p * .74}" y2="${80 - p * .74}" vector-effect="non-scaling-stroke"/>`).join('')}
    ${barras}
  </svg>`
}

function donut(fatias, { tamanho = 168 } = {}) {
  const total = fatias.reduce((s, f) => s + f.valor, 0)
  if (!total) return '<div class="empty">Sem gastos ainda.</div>'
  const cores = ['#7c5cff', '#22c3a6', '#ffb020', '#ff5a95', '#4d9dff', '#a78bfa', '#ff8a3d', '#2fd08a']
  const R = 15.9155, C = 2 * Math.PI * R
  let acc = 0

  const arcos = fatias.map((f, i) => {
    const frac = f.valor / total
    const dash = `${(frac * C).toFixed(3)} ${(C - frac * C).toFixed(3)}`
    const off = (C * 0.25 - acc * C).toFixed(3)
    acc += frac
    return `<circle cx="21" cy="21" r="${R}" fill="none" stroke="${cores[i % cores.length]}" stroke-width="5.2"
      stroke-dasharray="${dash}" stroke-dashoffset="${off}" transform="rotate(-90 21 21)">
      <title>${esc(f.rotulo)}: ${money(f.valor)} (${Math.round(frac * 100)}%)</title></circle>`
  }).join('')

  const legenda = fatias.map((f, i) => `
    <div class="list-line">
      <span class="who"><span style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${cores[i % cores.length]};margin-right:8px"></span>${esc(f.rotulo)}</span>
      <b class="num">${money(f.valor)}</b>
    </div>`).join('')

  return `<div style="display:flex;gap:22px;align-items:center;flex-wrap:wrap">
    <svg viewBox="0 0 42 42" style="width:${tamanho}px;height:${tamanho}px;flex:0 0 auto">
      ${arcos}
      <text x="21" y="20.4" text-anchor="middle" style="font-size:2.6px;fill:var(--txt-3)">total</text>
      <text x="21" y="24.4" text-anchor="middle" style="font-size:4.1px;fill:var(--txt);font-weight:650">${money(total).replace('R$ ', '')}</text>
    </svg>
    <div style="flex:1 1 190px;min-width:180px">${legenda}</div>
  </div>`
}

// ---------- render ----------

function render() {
  if (!S) return
  $('#statusBot').innerHTML = `<span class="dot ${S.online ? 'on' : 'off'}"></span>${S.online ? 'WhatsApp conectado' : 'WhatsApp offline'}`
  $('#statusCobranca').textContent = S.cobranca.ativo
    ? `🔔 Cobrança ${S.cobranca.dryRun ? 'em simulação' : 'ativa'} · ${S.cobranca.horario}`
    : '🔕 Cobrança desligada'

  document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('on', b.dataset.tab === TAB))
  $('#main').innerHTML = ({ resumo, cartoes, pessoas, lancar, historico, extratos, config: cfgTab })[TAB]()
  ligarEventos()
  window.scrollTo(0, 0)
}

function head(titulo, sub, botoes = '') {
  return `<div class="page-head"><div><h1>${titulo}</h1><p>${sub}</p></div><div class="row shrink" style="gap:8px">${botoes}</div></div>`
}

// --- aba: resumo ---
function resumo() {
  const r = S.resumo
  const prox = r.proximoVencimento
  const dias = prox?.fatura?.diasParaVencer
  const classeProx = dias == null ? '' : dias < 0 ? 'danger' : dias <= 3 ? 'warn' : 'ok'

  const evo = S.evolucao.map((e) => ({ rotulo: mesBR(e.competencia), valor: e.total }))
  const porCartao = S.cards.map((c) => ({ rotulo: c.name, valor: c.fatura?.total || 0 })).filter((f) => f.valor > 0)
  const porPessoa = S.pessoas.filter((p) => p.saldo > 0.009).map((p) => ({ rotulo: p.name, valor: p.saldo }))

  const devedores = S.pessoas.filter((p) => Math.abs(p.saldo) > 0.009)

  return head('Resumo', `Fatura de ${mesLongo(r.competencia)}`, `<button class="btn" data-acao="novo-gasto">+ Lançar gasto</button>`) + `
    ${!S.cards.length ? `<div class="banner info">👋 Comece cadastrando um cartão na aba <b>Cartões</b> — sem o dia de fechamento eu não sei em que fatura jogar cada compra.</div>` : ''}
    ${S.cobranca.dryRun && S.cobranca.ativo ? `<div class="banner warn">🧪 Cobrança em <b>modo simulação</b>: nada é enviado de verdade. Veja como ligar na aba Configurações.</div>` : ''}

    <div class="grid g4">
      <div class="kpi"><div class="lbl">Faturas abertas</div><div class="val">${money(r.totalFaturas)}</div><div class="sub">${S.cards.length} cartão(ões)</div></div>
      <div class="kpi ok"><div class="lbl">A receber</div><div class="val">${money(r.aReceber)}</div><div class="sub">${devedores.length} pessoa(s) devendo</div></div>
      <div class="kpi warn"><div class="lbl">Em aberto nas faturas</div><div class="val">${money(r.emAberto)}</div><div class="sub">já descontando o que recebi</div></div>
      <div class="kpi ${classeProx}"><div class="lbl">Próximo vencimento</div><div class="val">${prox ? (dias > 0 ? dias + 'd' : dias === 0 ? 'hoje' : 'vencida') : '—'}</div><div class="sub">${prox ? esc(prox.name) + ' · ' + money(prox.fatura.aberto) : 'nenhum cartão com vencimento'}</div></div>
    </div>

    <div class="grid g2" style="margin-top:16px">
      <div class="card"><h3>Evolução <small>últimos 12 meses</small></h3>${barChart(evo)}</div>
      <div class="card"><h3>Fatura atual por cartão</h3>${donut(porCartao)}</div>
    </div>

    <div class="grid g2" style="margin-top:16px">
      <div class="card">
        <h3>Quem te deve</h3>
        ${devedores.length ? `<table><tbody>${devedores.map((p) => `
          <tr>
            <td><b>${esc(p.name)}</b><br><span class="muted mono">${p.phone ? esc(p.phone) : 'sem telefone'}</span></td>
            <td class="num" style="color:${p.saldo > 0 ? 'var(--warn)' : 'var(--ok)'}">${money(p.saldo)}</td>
            <td class="right shrink"><button class="btn ghost sm" data-acao="receber" data-p="${esc(p.key)}">Recebi</button></td>
          </tr>`).join('')}</tbody></table>` : '<div class="empty"><span class="big">🎉</span>Ninguém te deve nada.</div>'}
      </div>
      <div class="card">
        <h3>Divisão por pessoa <small>saldo em aberto</small></h3>
        ${donut(porPessoa)}
      </div>
    </div>

    ${S.futuro.length ? `<div class="card"><h3>Parcelas já comprometidas <small>meses à frente</small></h3>
      ${barChart(S.futuro.map((f) => ({ rotulo: mesBR(f.competencia), valor: f.total })), { altura: 140 })}</div>` : ''}
  `
}

// --- aba: cartões ---
function cartoes() {
  if (!S.cards.length) {
    return head('Cartões', 'Cadastre seus cartões e o bot calcula sozinho em qual fatura cai cada compra',
      `<button class="btn" data-acao="novo-cartao">+ Novo cartão</button>`) +
      `<div class="card"><div class="empty"><span class="big">💳</span>Nenhum cartão cadastrado ainda.</div></div>`
  }

  const tiles = S.cards.map((c) => {
    const f = c.fatura
    const d = f.diasParaVencer
    const tag = d == null ? '<span class="tag">sem vencimento</span>'
      : d < 0 ? `<span class="tag danger">venceu há ${-d}d</span>`
      : d === 0 ? '<span class="tag danger">vence hoje</span>'
      : d <= 3 ? `<span class="tag warn">vence em ${d}d</span>`
      : `<span class="tag ok">vence em ${d}d</span>`

    const uso = c.limite ? Math.min(100, Math.round((f.total / c.limite) * 100)) : null

    return `<div class="card-tile">
      <div class="top">
        <div>
          <div class="nome"><span class="chip-cor" style="background:${esc(c.cor || '#7c5cff')}"></span>${esc(c.name)}</div>
          <div class="muted" style="font-size:12px;margin-top:4px">
            fecha dia ${c.fechamento ?? '—'} · vence dia ${c.vencimento ?? '—'}
          </div>
        </div>
        ${tag}
      </div>
      <div class="body">
        <div style="display:flex;justify-content:space-between;align-items:flex-end">
          <div>
            <div class="muted" style="font-size:11.5px;text-transform:uppercase;letter-spacing:.5px">Fatura ${mesBR(f.competencia)}</div>
            <div style="font-size:25px;font-weight:660;letter-spacing:-.7px;margin-top:2px">${money(f.total)}</div>
          </div>
          ${f.pago > 0 ? `<div class="right"><div class="muted" style="font-size:11.5px">recebi</div><b style="color:var(--ok)">${money(f.pago)}</b></div>` : ''}
        </div>
        ${uso != null ? `<div class="bar-track"><div class="bar-fill ${uso > 90 ? 'danger' : uso > 70 ? 'warn' : ''}" style="width:${uso}%"></div></div>
          <div class="muted" style="font-size:11.5px;margin-top:5px">${uso}% do limite de ${money(c.limite)}</div>` : ''}

        <div style="margin-top:14px">
          ${f.pessoas.length ? f.pessoas.map((p) => `<div class="list-line">
            <span class="who">${esc(p.name)}${p.pago ? ` <span class="tag ok">pagou ${money(p.pago)}</span>` : ''}</span>
            <b class="num">${money(p.aberto)}</b></div>`).join('')
            : '<div class="muted" style="font-size:13px;padding:6px 0">Nenhum lançamento nesta fatura.</div>'}
        </div>
      </div>
      <div class="foot">
        <button class="btn sm" data-acao="cobrar" data-card="${esc(c.key)}">📤 Cobrar</button>
        <button class="btn ghost sm" data-acao="ver-fatura" data-card="${esc(c.key)}">🧾 Faturas</button>
        <button class="btn ghost sm" data-acao="editar-cartao" data-card="${esc(c.key)}">✏️ Editar</button>
        <button class="btn danger sm" data-acao="del-cartao" data-card="${esc(c.key)}">Excluir</button>
      </div>
    </div>`
  }).join('')

  return head('Cartões', 'Fatura atual, limite e vencimento de cada cartão',
    `<button class="btn" data-acao="novo-cartao">+ Novo cartão</button>`) +
    `<div class="grid g2">${tiles}</div>`
}

// --- aba: pessoas ---
function pessoas() {
  const linhas = S.pessoas.map((p) => `<tr>
    <td><b>${esc(p.name)}</b></td>
    <td class="mono muted">${p.phone ? esc(p.phone) : '<span class="tag warn">sem telefone</span>'}</td>
    <td class="num">${money(p.totalItems)}</td>
    <td class="num" style="color:var(--ok)">${money(p.totalPaid)}</td>
    <td class="num" style="color:${p.saldo > 0.009 ? 'var(--warn)' : 'var(--txt-3)'}"><b>${money(p.saldo)}</b></td>
    <td class="right" style="white-space:nowrap">
      <button class="btn ghost sm" data-acao="receber" data-p="${esc(p.key)}">Recebi</button>
      <button class="btn ghost sm" data-acao="editar-pessoa" data-p="${esc(p.key)}">✏️</button>
      <button class="btn danger sm" data-acao="del-pessoa" data-p="${esc(p.key)}">🗑</button>
    </td></tr>`).join('')

  return head('Pessoas', 'Quem comprou nos seus cartões e quanto deve',
    `<button class="btn" data-acao="nova-pessoa">+ Nova pessoa</button>`) + `
    <div class="card">
      ${S.pessoas.length ? `<table>
        <thead><tr><th>Nome</th><th>Telefone</th><th class="num">Lançado</th><th class="num">Pagou</th><th class="num">Saldo</th><th></th></tr></thead>
        <tbody>${linhas}</tbody></table>`
        : '<div class="empty"><span class="big">👥</span>Nenhuma pessoa ainda. Elas aparecem sozinhas quando você lança um gasto.</div>'}
    </div>
    <div class="banner info" style="margin-top:16px">📱 Só consigo cobrar automaticamente quem tem telefone vinculado (com DDD).</div>`
}

// --- aba: lançar ---
function lancar() {
  const opcoesCartao = S.cards.map((c) => `<option value="${esc(c.key)}">${esc(c.name)}</option>`).join('')
  return head('Lançar', 'Um por um, ou em lote colando várias linhas de uma vez') + `
    <div class="grid g2">
      <div class="card">
        <h3>Lançamento único</h3>
        <div class="row">
          <div class="field" style="flex:2 1 160px"><label>Pessoa</label><input id="uPessoa" placeholder="danilo" list="listaPessoas"></div>
          <div class="field"><label>Valor total</label><input id="uValor" placeholder="0,00" inputmode="decimal"></div>
        </div>
        <div class="row">
          <div class="field"><label>Cartão</label><select id="uCartao"><option value="">— sem cartão —</option>${opcoesCartao}</select></div>
          <div class="field" style="flex:0 1 100px"><label>Parcelas</label><input id="uParcelas" type="number" min="1" max="60" value="1"></div>
          <div class="field" style="flex:0 1 140px"><label>Data</label><input id="uData" type="date"></div>
        </div>
        <div class="field"><label>Observação</label><input id="uNota" placeholder="lanche, uber, mercado…"></div>
        <button class="btn" data-acao="salvar-unico">Lançar</button>
        <datalist id="listaPessoas">${S.pessoas.map((p) => `<option value="${esc(p.name)}">`).join('')}</datalist>
      </div>

      <div class="card">
        <h3>Em lote <small>uma linha por gasto</small></h3>
        <div class="field">
          <label>Cartão padrão do lote</label>
          <select id="lCartao"><option value="">— sem cartão —</option>${opcoesCartao}</select>
        </div>
        <div class="field">
          <label>Linhas</label>
          <textarea id="lTexto" rows="9" placeholder="22 danilo lanche
35,90 maria uber
300 joao 3x tenis
18 ana #inter 12/07"></textarea>
        </div>
        <div class="muted" style="font-size:12px;margin-bottom:12px">
          Ordem livre: <b>valor</b> · <b>pessoa</b> · <code>#cartao</code> · <code>3x</code> (parcelas) · <code>12/07</code> (data) · resto vira observação.
        </div>
        <button class="btn" data-acao="preview-lote">Conferir lote</button>
      </div>
    </div>`
}

// --- aba: histórico ---
function historico() {
  const gastos = S.expenses.slice(0, 300)
  const nomes = Object.fromEntries(S.pessoas.map((p) => [p.key, p.name]))
  const cartoes = Object.fromEntries(S.cards.map((c) => [c.key, c.name]))

  const linhasGasto = gastos.map((e) => `<tr>
    <td class="mono muted">${dataBR(e.at)}</td>
    <td><b>${esc(nomes[e.person] || e.person)}</b>${e.note ? `<br><span class="muted" style="font-size:12px">${esc(e.note)}</span>` : ''}</td>
    <td>${e.card ? `<span class="tag accent">${esc(cartoes[e.card] || e.card)}</span>` : '<span class="tag">sem cartão</span>'}</td>
    <td class="mono muted">${mesBR(e.competencia)}</td>
    <td>${e.parcela ? `<span class="tag">${e.parcela.n}/${e.parcela.total}</span>` : ''}</td>
    <td class="num">${money(e.value)}</td>
    <td class="right"><button class="btn danger sm" data-acao="del-gasto" data-id="${esc(e.id)}" ${e.parcela ? 'data-grupo="1"' : ''}>🗑</button></td>
  </tr>`).join('')

  const linhasPag = S.payments.slice(0, 100).map((p) => `<tr>
    <td class="mono muted">${dataBR(p.at)}</td>
    <td><b>${esc(nomes[p.person] || p.person)}</b></td>
    <td>${p.card ? `<span class="tag accent">${esc(cartoes[p.card] || p.card)}</span>` : ''}</td>
    <td class="num" style="color:var(--ok)">${money(p.value)}</td>
    <td class="right"><button class="btn danger sm" data-acao="del-pagamento" data-id="${esc(p.id)}">🗑</button></td>
  </tr>`).join('')

  return head('Histórico', 'Todos os lançamentos e pagamentos registrados') + `
    <div class="card">
      <h3>Gastos <small>${S.expenses.length} no total${S.expenses.length > 300 ? ' — mostrando os 300 mais recentes' : ''}</small></h3>
      ${gastos.length ? `<table><thead><tr><th>Data</th><th>Pessoa</th><th>Cartão</th><th>Fatura</th><th>Parcela</th><th class="num">Valor</th><th></th></tr></thead><tbody>${linhasGasto}</tbody></table>`
        : '<div class="empty"><span class="big">🧾</span>Nenhum gasto lançado ainda.</div>'}
    </div>
    <div class="card">
      <h3>Pagamentos recebidos</h3>
      ${S.payments.length ? `<table><thead><tr><th>Data</th><th>Pessoa</th><th>Cartão</th><th class="num">Valor</th><th></th></tr></thead><tbody>${linhasPag}</tbody></table>`
        : '<div class="empty">Nenhum pagamento registrado.</div>'}
    </div>`
}

// --- aba: extratos ---
function extratos() {
  if (!S.accounts.length) {
    return head('Extratos bancários', 'Importados dos PDFs que você manda pro bot') +
      `<div class="card"><div class="empty"><span class="big">🏦</span>Nenhum extrato importado.<br><br>
      Mande o PDF do extrato pro bot no WhatsApp com o <b>nome da conta na legenda</b> (ex.: <code>Nubank</code>).</div></div>`
  }
  return head('Extratos bancários', 'Saídas por mês, lidas dos PDFs') +
    S.accounts.map((a) => `<div class="card">
      <h3>${esc(a.name)}
        <small>${a.months.length} mês(es)</small>
        <button class="btn danger sm" style="float:right" data-acao="del-conta" data-conta="${esc(a.name)}">Excluir conta</button>
      </h3>
      ${barChart(a.months.slice().reverse().map((m) => ({ rotulo: mesBR(m.month), valor: m.saidas })), { altura: 140 })}
      <table style="margin-top:14px"><thead><tr><th>Mês</th><th class="num">Saídas</th><th class="num">Entradas</th><th class="num">Lançamentos</th></tr></thead>
      <tbody>${a.months.map((m) => `<tr><td>${mesBR(m.month)}</td>
        <td class="num" style="color:var(--danger)">${money(m.saidas)}</td>
        <td class="num" style="color:var(--ok)">${money(m.entradas)}</td>
        <td class="num muted">${m.count}</td></tr>`).join('')}</tbody></table>
    </div>`).join('')
}

// --- aba: configurações ---
function cfgTab() {
  const s = S.settings
  return head('Configurações', 'Chave PIX das cobranças e disparo manual dos lembretes') + `
    <div class="card">
      <h3>Chave PIX <small>vai no rodapé de toda cobrança</small></h3>
      <div class="row">
        <div class="field" style="flex:2 1 240px"><label>Chave</label><input id="cfgPix" value="${esc(s.pix)}" placeholder="email, telefone ou aleatória"></div>
        <div class="field"><label>Nome do titular</label><input id="cfgPixNome" value="${esc(s.pixNome)}" placeholder="Daniel S."></div>
      </div>
      <button class="btn" data-acao="salvar-config">Salvar</button>
    </div>

    <div class="card">
      <h3>Cobrança automática</h3>
      <div class="list-line"><span class="who">Agendador</span><b>${S.cobranca.ativo ? '<span class="tag ok">ligado</span>' : '<span class="tag danger">desligado</span>'}</b></div>
      <div class="list-line"><span class="who">Horário da checagem diária</span><b class="mono">${esc(S.cobranca.horario)}</b></div>
      <div class="list-line"><span class="who">Modo</span><b>${S.cobranca.dryRun ? '<span class="tag warn">simulação</span>' : '<span class="tag danger">envio real</span>'}</b></div>
      <div class="list-line"><span class="who">Gatilhos</span><b class="mono">D-5 · D-2 · D-0 · D+1</b></div>

      <div class="banner warn" style="margin-top:16px">
        ⚠️ Enquanto estiver em <b>simulação</b> nada é enviado. Para ligar de verdade, suba o bot com
        <code>COBRANCA_REAL=1</code> — e confira antes as mensagens no botão abaixo.
      </div>
      <div class="row" style="margin-top:4px">
        <button class="btn ghost shrink" data-acao="simular-lembretes">🧪 Simular lembretes de hoje</button>
        <button class="btn ghost shrink" data-acao="rodar-lembretes">📤 Disparar lembretes de hoje</button>
      </div>
    </div>

    <div class="card">
      <h3>Comandos do WhatsApp <small>tudo aqui também funciona por lá</small></h3>
      <table><tbody>
        ${[
          ['/cartao add nubank fecha 3 vence 10 limite 5000', 'cadastra cartão'],
          ['/cartoes', 'lista cartões e faturas'],
          ['/gasto 22 danilo nubank lanche', 'lança gasto (aceita 3x e 12/07)'],
          ['/lote', 'várias linhas de uma vez (confirma com /confirmar)'],
          ['/pagou 50 danilo nubank', 'registra pagamento recebido'],
          ['/fatura nubank 2026-09', 'detalha uma fatura'],
          ['/pessoa danilo 11999998888', 'vincula telefone'],
          ['/cobrar nubank [real]', 'cobra quem deve no cartão'],
          ['/contas', 'resumo geral'],
          ['/painel', 'link deste painel'],
        ].map(([c, d]) => `<tr><td class="mono" style="color:var(--accent-2)">${esc(c)}</td><td class="muted">${esc(d)}</td></tr>`).join('')}
      </tbody></table>
    </div>`
}

// ---------- ações ----------

function ligarEventos() {
  document.querySelectorAll('[data-acao]').forEach((b) => { b.onclick = () => acoes[b.dataset.acao]?.(b.dataset) })
}

const numeroBR = (v) => Number(String(v ?? '').replace(/\./g, '').replace(',', '.'))

const acoes = {
  'novo-cartao': () => formCartao(null),
  'editar-cartao': ({ card }) => formCartao(S.cards.find((c) => c.key === card)),

  'del-cartao': async ({ card }) => {
    if (!await confirmar(`Excluir o cartão "${S.cards.find((c) => c.key === card)?.name}"? Os gastos continuam salvos, mas ficam sem cartão.`)) return
    await api(`/cards/${encodeURIComponent(card)}`, { method: 'DELETE' })
    toast('Cartão excluído.'); render()
  },

  'nova-pessoa': () => formPessoa(null),
  'editar-pessoa': ({ p }) => formPessoa(S.pessoas.find((x) => x.key === p)),

  'del-pessoa': async ({ p }) => {
    const pe = S.pessoas.find((x) => x.key === p)
    if (!await confirmar(`Excluir "${pe?.name}" e TODO o histórico dela? Isso não tem volta.`)) return
    await api(`/people/${encodeURIComponent(p)}`, { method: 'DELETE' })
    toast('Pessoa excluída.'); render()
  },

  'receber': ({ p }) => formPagamento(S.pessoas.find((x) => x.key === p)),

  'novo-gasto': () => { TAB = 'lancar'; render() },

  'salvar-unico': async () => {
    const pessoa = $('#uPessoa').value.trim()
    const valor = numeroBR($('#uValor').value)
    if (!pessoa || !valor) return toast('Informe pessoa e valor.', 'err')
    await api('/expenses', {
      body: {
        person: pessoa, value: valor, card: $('#uCartao').value || null,
        parcelas: Number($('#uParcelas').value) || 1, note: $('#uNota').value.trim(),
        at: $('#uData').value ? new Date($('#uData').value + 'T12:00:00').toISOString() : null,
      },
    })
    toast(`Lançado ${money(valor)} para ${pessoa}.`)
    TAB = 'resumo'; render()
  },

  'preview-lote': async () => {
    const texto = $('#lTexto').value
    const card = $('#lCartao').value || null
    if (!texto.trim()) return toast('Cole as linhas do lote.', 'err')
    const r = await api('/expenses/preview', { body: { texto, card } })
    if (!r.ok.length) return toast('Não consegui ler nenhuma linha.', 'err')

    const total = r.ok.reduce((s, i) => s + i.value, 0)
    const corpo = `
      <table><thead><tr><th>#</th><th>Pessoa</th><th>Cartão</th><th>Data</th><th class="num">Valor</th></tr></thead><tbody>
      ${r.ok.map((i, n) => `<tr>
        <td class="muted">${n + 1}</td>
        <td><b>${esc(i.pessoa)}</b>${i.note ? `<br><span class="muted" style="font-size:12px">${esc(i.note)}</span>` : ''}</td>
        <td>${i.cardName ? `<span class="tag ${i.cardExiste ? 'accent' : 'warn'}">${esc(i.cardName)}${i.cardExiste ? '' : ' (não existe)'}</span>` : '<span class="tag">—</span>'}</td>
        <td class="mono muted">${dataBR(i.at)}</td>
        <td class="num">${money(i.value)}${i.parcelas > 1 ? `<br><span class="tag">${i.parcelas}x</span>` : ''}</td></tr>`).join('')}
      </tbody></table>
      <div class="list-line" style="margin-top:14px;font-size:15px"><b>Total</b><b>${money(total)}</b></div>
      ${r.erros.length ? `<div class="banner warn" style="margin-top:14px">⚠️ Não entendi ${r.erros.length} linha(s):<br>${r.erros.map((e) => `<code>${esc(e.linha)}</code> — ${esc(e.erro)}`).join('<br>')}</div>` : ''}`

    modal({
      titulo: `Confira o lote — ${r.ok.length} lançamento(s)`,
      corpo,
      acoes: [{
        label: 'Gravar tudo', onClick: async ({ fechar, btn }) => {
          btn.disabled = true
          const res = await api('/expenses/lote', { body: { texto, card } })
          fechar(); toast(`${res.lancados} lançamento(s) gravados (${res.parcelas} parcelas).`)
          TAB = 'resumo'; render()
        },
      }],
    })
  },

  'del-gasto': async ({ id, grupo }) => {
    if (!await confirmar(grupo ? 'Excluir esse lançamento e TODAS as parcelas dele?' : 'Excluir esse lançamento?')) return
    await api(`/expenses/${encodeURIComponent(id)}${grupo ? '?grupo=1' : ''}`, { method: 'DELETE' })
    toast('Lançamento excluído.'); render()
  },

  'del-pagamento': async ({ id }) => {
    if (!await confirmar('Excluir esse pagamento?')) return
    await api(`/payments/${encodeURIComponent(id)}`, { method: 'DELETE' })
    toast('Pagamento excluído.'); render()
  },

  'del-conta': async ({ conta }) => {
    if (!await confirmar(`Excluir os extratos da conta "${conta}"?`)) return
    await api(`/accounts/${encodeURIComponent(conta)}`, { method: 'DELETE' })
    toast('Extratos excluídos.'); render()
  },

  'salvar-config': async () => {
    await api('/settings', { body: { pix: $('#cfgPix').value.trim(), pixNome: $('#cfgPixNome').value.trim() } })
    toast('Configurações salvas.'); render()
  },

  'cobrar': ({ card }) => formCobranca(card),
  'ver-fatura': ({ card }) => verFaturas(card),

  'simular-lembretes': async () => {
    const r = await api('/lembretes', { body: { real: false } })
    mostrarResultadoCobranca(r.resultados, true)
  },

  'rodar-lembretes': async () => {
    if (!await confirmar('Disparar AGORA os lembretes de hoje de verdade no WhatsApp?')) return
    const r = await api('/lembretes', { body: { real: true } })
    mostrarResultadoCobranca(r.resultados, false); render()
  },
}

// ---------- formulários ----------

function formCartao(c) {
  modal({
    titulo: c ? `Editar ${c.name}` : 'Novo cartão',
    corpo: `
      <div class="field"><label>Nome</label><input id="fNome" value="${esc(c?.name || '')}" placeholder="Nubank" ${c ? 'readonly' : ''}></div>
      <div class="row">
        <div class="field"><label>Fecha no dia</label><input id="fFecha" type="number" min="1" max="31" value="${c?.fechamento ?? ''}" placeholder="3"></div>
        <div class="field"><label>Vence no dia</label><input id="fVence" type="number" min="1" max="31" value="${c?.vencimento ?? ''}" placeholder="10"></div>
      </div>
      <div class="row">
        <div class="field"><label>Limite (opcional)</label><input id="fLimite" value="${c?.limite || ''}" placeholder="5000" inputmode="decimal"></div>
        <div class="field" style="flex:0 1 110px"><label>Cor</label><input id="fCor" type="color" value="${esc(c?.cor || '#7c5cff')}" style="padding:4px;height:38px"></div>
      </div>
      <div class="muted" style="font-size:12.5px">Compras feitas <b>depois</b> do dia de fechamento entram na fatura do mês seguinte — é assim que eu acerto a fatura sozinho.</div>`,
    acoes: [{
      label: 'Salvar', onClick: async ({ fechar, btn }) => {
        const name = $('#fNome').value.trim()
        if (!name) return toast('Informe o nome.', 'err')
        btn.disabled = true
        await api('/cards', {
          body: {
            name,
            fechamento: $('#fFecha').value ? Number($('#fFecha').value) : null,
            vencimento: $('#fVence').value ? Number($('#fVence').value) : null,
            limite: numeroBR($('#fLimite').value), cor: $('#fCor').value,
          },
        })
        fechar(); toast('Cartão salvo.'); render()
      },
    }],
  })
}

function formPessoa(p) {
  modal({
    titulo: p ? `Editar ${p.name}` : 'Nova pessoa',
    corpo: `
      <div class="field"><label>Nome</label><input id="pNome" value="${esc(p?.name || '')}" placeholder="danilo" ${p ? 'readonly' : ''}></div>
      <div class="field"><label>Telefone com DDD</label><input id="pFone" value="${esc(p?.phone || '')}" placeholder="11999998888" inputmode="tel"></div>
      <div class="muted" style="font-size:12.5px">Sem telefone eu não consigo mandar a cobrança automática pra essa pessoa.</div>`,
    acoes: [{
      label: 'Salvar', onClick: async ({ fechar, btn }) => {
        const name = $('#pNome').value.trim()
        if (!name) return toast('Informe o nome.', 'err')
        btn.disabled = true
        await api('/people', { body: { name, phone: $('#pFone').value.trim() } })
        fechar(); toast('Pessoa salva.'); render()
      },
    }],
  })
}

function formPagamento(p) {
  if (!p) return
  const opts = S.cards.map((c) => `<option value="${esc(c.key)}">${esc(c.name)}</option>`).join('')
  modal({
    titulo: `Recebi de ${p.name}`,
    corpo: `
      <div class="banner info">Saldo atual: <b>&nbsp;${money(p.saldo)}</b></div>
      <div class="row">
        <div class="field"><label>Valor recebido</label><input id="gValor" value="${p.saldo > 0 ? String(p.saldo).replace('.', ',') : ''}" inputmode="decimal"></div>
        <div class="field"><label>Abater do cartão</label><select id="gCartao"><option value="">— geral —</option>${opts}</select></div>
      </div>
      <div class="field"><label>Observação</label><input id="gNota" placeholder="pix, dinheiro…"></div>`,
    acoes: [{
      label: 'Registrar', onClick: async ({ fechar, btn }) => {
        const v = numeroBR($('#gValor').value)
        if (!v) return toast('Informe o valor.', 'err')
        btn.disabled = true
        const r = await api('/payments', { body: { person: p.key, value: v, card: $('#gCartao').value || null, note: $('#gNota').value.trim() } })
        fechar(); toast(`Registrado. Saldo agora: ${money(r.saldo)}`); render()
      },
    }],
  })
}

function formCobranca(cardKey) {
  const c = S.cards.find((x) => x.key === cardKey)
  const opts = c.competencias.map((k) => `<option value="${esc(k)}" ${k === c.fatura.competencia ? 'selected' : ''}>${mesLongo(k)}</option>`).join('')
  modal({
    titulo: `Cobrar — ${c.name}`,
    corpo: `
      <div class="field"><label>Fatura</label><select id="cbComp">${opts}</select></div>
      <div class="banner info">Primeiro eu <b>&nbsp;simulo&nbsp;</b> e te mostro exatamente o que seria enviado pra cada pessoa.</div>`,
    acoes: [
      {
        label: '🧪 Simular', onClick: async ({ fechar, btn }) => {
          btn.disabled = true
          const r = await api('/cobrar', { body: { card: cardKey, competencia: $('#cbComp').value, real: false } })
          fechar(); mostrarResultadoCobranca(r.resultados, true, { card: cardKey, competencia: r.fatura.competencia })
        },
      },
      {
        label: '📤 Enviar de verdade', classe: 'danger', onClick: async ({ fechar, btn }) => {
          const comp = $('#cbComp').value
          if (!await confirmar('Enviar as cobranças agora no WhatsApp?')) return
          btn.disabled = true
          const r = await api('/cobrar', { body: { card: cardKey, competencia: comp, real: true } })
          fechar(); mostrarResultadoCobranca(r.resultados, false); render()
        },
      },
    ],
  })
}

const ROTULO = {
  enviado: '<span class="tag ok">enviado</span>',
  simulado: '<span class="tag accent">simulado</span>',
  quitado: '<span class="tag ok">já quitado</span>',
  'sem-telefone': '<span class="tag warn">sem telefone</span>',
  offline: '<span class="tag danger">bot offline</span>',
  'limite-diario': '<span class="tag warn">limite da rodada</span>',
  erro: '<span class="tag danger">erro</span>',
}

function mostrarResultadoCobranca(resultados, simulado, reenviar = null) {
  if (!resultados?.length) return toast('Nenhuma cobrança para enviar hoje.')
  const corpo = `
    <table><thead><tr><th>Pessoa</th><th class="num">Valor</th><th>Status</th></tr></thead><tbody>
    ${resultados.map((r) => `<tr><td><b>${esc(r.name)}</b></td><td class="num">${money(r.valor)}</td><td>${ROTULO[r.status] || esc(r.status)}</td></tr>`).join('')}
    </tbody></table>
    ${resultados.filter((r) => r.texto).map((r) => `
      <h3 style="margin:18px 0 8px;font-size:13px">📄 Mensagem para ${esc(r.name)}</h3>
      <div class="msg-preview">${esc(r.texto)}</div>`).join('')}`

  const acoes = simulado && reenviar ? [{
    label: '📤 Enviar de verdade', classe: 'danger', onClick: async ({ fechar, btn }) => {
      if (!await confirmar('Enviar essas mensagens agora no WhatsApp?')) return
      btn.disabled = true
      const r = await api('/cobrar', { body: { ...reenviar, real: true } })
      fechar(); mostrarResultadoCobranca(r.resultados, false); render()
    },
  }] : []

  modal({ titulo: simulado ? '🧪 Simulação — nada foi enviado' : '📤 Resultado do envio', corpo, acoes })
}

async function verFaturas(cardKey) {
  const c = S.cards.find((x) => x.key === cardKey)
  const opts = c.competencias.map((k) => `<option value="${esc(k)}">${mesLongo(k)}</option>`).join('')
  const { bg } = modal({
    titulo: `Faturas — ${c.name}`,
    corpo: `<div class="field"><label>Competência</label><select id="fvComp">${opts}</select></div><div id="fvBody"></div>`,
  })

  const carregar = async () => {
    const comp = $('#fvComp', bg).value
    const f = await api(`/fatura?card=${encodeURIComponent(cardKey)}&comp=${encodeURIComponent(comp)}`)
    const nomes = Object.fromEntries(S.pessoas.map((p) => [p.key, p.name]))
    $('#fvBody', bg).innerHTML = `
      <div class="grid g4" style="margin-bottom:14px">
        <div class="kpi"><div class="lbl">Total</div><div class="val" style="font-size:20px">${money(f.total)}</div></div>
        <div class="kpi ok"><div class="lbl">Recebido</div><div class="val" style="font-size:20px">${money(f.pago)}</div></div>
        <div class="kpi warn"><div class="lbl">Em aberto</div><div class="val" style="font-size:20px">${money(f.aberto)}</div></div>
      </div>
      ${f.lancamentos.length ? `<table><thead><tr><th>Data</th><th>Pessoa</th><th>Obs</th><th class="num">Valor</th></tr></thead><tbody>
        ${f.lancamentos.map((i) => `<tr><td class="mono muted">${dataBR(i.at)}</td>
          <td><b>${esc(nomes[i.person] || i.person)}</b></td>
          <td class="muted">${esc(i.note)}${i.parcela ? ` <span class="tag">${i.parcela.n}/${i.parcela.total}</span>` : ''}</td>
          <td class="num">${money(i.value)}</td></tr>`).join('')}
      </tbody></table>` : '<div class="empty">Nenhum lançamento nesta fatura.</div>'}`
  }

  $('#fvComp', bg).onchange = carregar
  carregar()
}

// ---------- boot ----------

document.querySelectorAll('.nav-item').forEach((b) => {
  b.onclick = () => { TAB = b.dataset.tab; render() }
})

window.addEventListener('unhandledrejection', (e) => toast(e.reason?.message || 'Erro inesperado', 'err'))

api('/state')
  .then((s) => { S = s; render() })
  .catch((e) => { $('#main').innerHTML = `<div class="card"><div class="empty"><span class="big">🔒</span>${esc(e.message)}</div></div>` })

// atualiza sozinho a cada 30s se não tiver modal aberto
setInterval(async () => {
  if ($('.modal-bg')) return
  try { S = await api('/state'); render() } catch {}
}, 30_000)
