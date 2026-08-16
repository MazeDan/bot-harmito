/* Painel financeiro — vanilla JS, sem dependências.
   Desenhado para o celular: navegação embaixo, bottom sheets, listas em vez
   de tabelas e entrada rápida por toque. */

let S = null            // estado vindo do servidor
let TAB = 'resumo'

/* A senha fica só no sessionStorage — nunca na URL, para não vazar em
   histórico de navegador nem em log de proxy. */
const CHAVE = 'painel_token'
let TOKEN = sessionStorage.getItem(CHAVE) || ''

const naQuery = new URLSearchParams(location.search).get('t')
if (naQuery) {
  TOKEN = naQuery
  sessionStorage.setItem(CHAVE, TOKEN)
  history.replaceState(null, '', location.pathname)
}

// ---------- utilidades ----------

const $ = (sel, base = document) => base.querySelector(sel)
const $$ = (sel, base = document) => [...base.querySelectorAll(sel)]
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const money = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const curto = (v) => { const n = Math.abs(Number(v) || 0); return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',') + 'k' : String(Math.round(n)) }
const dataBR = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
const iniciais = (nome) => String(nome || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
const vibrar = (ms = 8) => navigator.vibrate?.(ms)

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const mesBR = (ym) => { const [y, m] = String(ym).split('-'); return `${MESES[+m - 1] ?? m}/${String(y).slice(2)}` }
const mesLongo = (ym) => {
  const nomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  const [y, m] = String(ym).split('-'); return `${nomes[+m - 1] ?? m} de ${y}`
}
const numeroBR = (v) => Number(String(v ?? '').replace(/\./g, '').replace(',', '.')) || 0
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

async function api(rota, opts = {}) {
  const headers = { 'x-token': TOKEN }
  if (opts.body) headers['content-type'] = 'application/json'
  const res = await fetch(`/api${rota}`, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401) { sessionStorage.removeItem(CHAVE); TOKEN = ''; telaLogin(data.erro); throw new Error(data.erro || 'Senha inválida.') }
  if (!res.ok) throw new Error(data.erro || `Erro ${res.status}`)
  if (data.state) { S = data.state }
  return data
}

/** Copia para a área de transferência, com plano B para navegador antigo. */
async function copiar(texto, rotulo = 'Texto copiado!') {
  try {
    await navigator.clipboard.writeText(texto)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = texto
    ta.style.cssText = 'position:fixed;opacity:0'
    document.body.append(ta)
    ta.select()
    const ok = document.execCommand?.('copy')
    ta.remove()
    if (!ok) return toast('Seu navegador bloqueou a cópia. Segure no texto para copiar à mão.', 'err')
  }
  toast('📋 ' + rotulo)
}

/** Botão de copiar que vira ✅ por um instante */
function ligarCopia(base = document) {
  $$('[data-copiar]', base).forEach((b) => {
    b.onclick = async (ev) => {
      ev.stopPropagation()
      vibrar()
      const rota = b.dataset.copiar
      const original = b.innerHTML
      b.disabled = true
      try {
        const { texto } = rota.startsWith('#') ? { texto: $(rota, base).textContent } : await api(rota)
        await copiar(texto, b.dataset.rotulo || 'Copiado!')
        b.innerHTML = '✅ Copiado'
        setTimeout(() => { b.innerHTML = original; b.disabled = false }, 1600)
      } catch (e) { b.disabled = false; toast(e.message, 'err') }
    }
  })
}

function toast(msg, tipo = 'ok') {
  $$('.toast').forEach((t) => t.remove())
  const t = el(`<div class="toast ${tipo}">${esc(msg)}</div>`)
  $('#toastHost').append(t)
  vibrar(tipo === 'err' ? 30 : 8)
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300) }, 3200)
}

// ---------- bottom sheet ----------

function sheet({ titulo, corpo, acoes = [], aoAbrir }) {
  const bg = el(`<div class="sheet-bg"><div class="sheet">
    <div class="grabber"></div>
    <header><h2>${esc(titulo)}</h2><button class="x" aria-label="Fechar">&times;</button></header>
    <div class="body"></div>
  </div></div>`)
  const caixa = $('.sheet', bg)
  $('.body', bg).innerHTML = corpo

  const fechar = () => { bg.style.opacity = '0'; bg.style.transition = 'opacity .18s'; setTimeout(() => bg.remove(), 180) }

  if (acoes.length) {
    const foot = el('<footer></footer>')
    for (const a of acoes) {
      const b = el(`<button class="btn ${a.classe || ''}">${esc(a.label)}</button>`)
      b.onclick = () => a.onClick({ bg, fechar, btn: b })
      foot.append(b)
    }
    caixa.append(foot)
  }

  $('.x', bg).onclick = fechar
  bg.onclick = (e) => { if (e.target === bg) fechar() }

  // arrastar o grabber para baixo fecha
  let y0 = null
  const cab = $('header', bg)
  const inicio = (e) => { y0 = e.touches[0].clientY }
  const move = (e) => {
    if (y0 == null) return
    const dy = e.touches[0].clientY - y0
    if (dy > 0) caixa.style.transform = `translateY(${dy}px)`
  }
  const fim = () => {
    const dy = parseFloat((caixa.style.transform.match(/([\d.]+)px/) || [0, 0])[1])
    caixa.style.transform = ''
    if (dy > 110) fechar()
    y0 = null
  }
  for (const alvo of [$('.grabber', bg), cab]) {
    alvo.addEventListener('touchstart', inicio, { passive: true })
    alvo.addEventListener('touchmove', move, { passive: true })
    alvo.addEventListener('touchend', fim)
  }

  $('#sheetHost').append(bg)
  aoAbrir?.({ bg, fechar })
  return { bg, fechar }
}

const confirmar = (texto, rotulo = 'Confirmar') => new Promise((resolve) => {
  let decidido = false
  const { bg, fechar } = sheet({
    titulo: 'Tem certeza?',
    corpo: `<p style="font-size:15px;line-height:1.6;padding:6px 0 10px">${esc(texto)}</p>`,
    acoes: [{ label: rotulo, classe: 'danger', onClick: ({ fechar }) => { decidido = true; fechar(); resolve(true) } }],
  })
  const obs = new MutationObserver(() => { if (!bg.isConnected) { obs.disconnect(); if (!decidido) resolve(false) } })
  obs.observe($('#sheetHost'), { childList: true })
  void fechar
})

// ---------- gráficos ----------

function barChart(dados, { altura = 150, larguraBarra = 42 } = {}) {
  if (!dados.length) return '<div class="empty">Sem dados ainda.</div>'
  const max = Math.max(...dados.map((d) => d.valor), 1)
  const W = Math.max(dados.length * larguraBarra, 260)
  const H = 100, base = 76, gap = 7
  const bw = (W - gap * dados.length) / dados.length

  const barras = dados.map((d, i) => {
    const h = (d.valor / max) * 62
    const x = i * (bw + gap) + gap / 2
    return `<g>
      <rect x="${x}" y="${base - h}" width="${bw}" height="${Math.max(h, 2)}" rx="4" fill="url(#gr)"/>
      <text x="${x + bw / 2}" y="${base + 11}" text-anchor="middle" font-size="9.5">${esc(d.rotulo)}</text>
      ${d.valor > 0 ? `<text x="${x + bw / 2}" y="${Math.max(base - h - 4, 8)}" text-anchor="middle" font-size="9" fill="var(--txt-2)" font-weight="600">${curto(d.valor)}</text>` : ''}
    </g>`
  }).join('')

  return `<div class="chart-scroll"><svg viewBox="0 0 ${W} ${H}" style="width:${W < 320 ? '100%' : W + 'px'};min-width:100%;height:${altura}px;display:block">
    <defs><linearGradient id="gr" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7c5cff"/><stop offset="100%" stop-color="#a78bfa" stop-opacity=".5"/>
    </linearGradient></defs>
    ${[0, 20, 40, 60].map((p) => `<line class="grid-line" x1="0" x2="${W}" y1="${base - p}" y2="${base - p}" vector-effect="non-scaling-stroke"/>`).join('')}
    ${barras}
  </svg></div>`
}

const CORES = ['#7c5cff', '#22c3a6', '#ffb020', '#ff5a95', '#4d9dff', '#a78bfa', '#ff8a3d', '#2fd08a']

function donut(fatias) {
  const total = fatias.reduce((s, f) => s + f.valor, 0)
  if (!total) return '<div class="empty">Sem gastos ainda.</div>'
  const R = 15.9155, C = 2 * Math.PI * R
  let acc = 0

  const arcos = fatias.map((f, i) => {
    const frac = f.valor / total
    const dash = `${(frac * C).toFixed(3)} ${(C - frac * C).toFixed(3)}`
    const off = (C * 0.25 - acc * C).toFixed(3)
    acc += frac
    return `<circle cx="21" cy="21" r="${R}" fill="none" stroke="${CORES[i % CORES.length]}" stroke-width="5.4"
      stroke-dasharray="${dash}" stroke-dashoffset="${off}" transform="rotate(-90 21 21)"/>`
  }).join('')

  const legenda = fatias.map((f, i) => `
    <div class="row-item" style="cursor:default;min-height:44px">
      <span style="width:11px;height:11px;border-radius:4px;background:${CORES[i % CORES.length]};flex:0 0 auto"></span>
      <span class="grow t1" style="font-weight:500;font-size:14px">${esc(f.rotulo)}</span>
      <b class="v">${money(f.valor)}</b>
    </div>`).join('')

  return `<div style="display:flex;flex-direction:column;align-items:center;gap:6px">
    <svg viewBox="0 0 42 42" style="width:150px;height:150px">
      ${arcos}
      <text x="21" y="20.2" text-anchor="middle" font-size="2.7">total</text>
      <text x="21" y="24.6" text-anchor="middle" font-size="4.3" fill="var(--txt)" font-weight="700">${money(total).replace('R$ ', '')}</text>
    </svg>
    <div class="rows" style="width:100%">${legenda}</div>
  </div>`
}

// ---------- render ----------

const TITULOS = {
  resumo: ['Resumo', () => `Fatura de ${mesLongo(S.resumo.competencia)}`],
  agenda: ['Agenda', () => {
    const n = S.agenda.numeros
    if (n.atrasados) return `${n.pendentesHoje} hoje · ${n.atrasados} atrasado(s)`
    return n.pendentesHoje ? `${n.pendentesHoje} pendente(s) hoje` : 'tudo em dia'
  }],
  liturgia: ['Liturgia', () => {
    const d = LIT_CACHE.get(LIT_DATA ?? S.agenda.hoje)
    if (d?.celebracao) return d.celebracao
    return S.liturgia.anotacaoHoje ? 'anotado hoje ✅' : 'leituras do dia'
  }],
  cartoes: ['Cartões', () => `${S.cards.length} cadastrado(s)`],
  pessoas: ['Pessoas', () => `${S.pessoas.filter((p) => !p.eu && p.saldo > 0.009).length} devendo`],
  historico: ['Histórico', () => {
    const partes = []
    if (HIST.cartao) partes.push(HIST.cartao === '__sem' ? 'sem cartão' : S.cards.find((c) => c.key === HIST.cartao)?.name ?? '')
    if (HIST.pessoa) partes.push(S.pessoas.find((p) => p.key === HIST.pessoa)?.name ?? '')
    return partes.length ? partes.join(' · ') : `${S.expenses.length} lançamentos`
  }],
  mais: ['Mais', () => 'extratos, lote e configurações'],
}

function render({ manterScroll = false } = {}) {
  if (!S) return
  const y = window.scrollY
  const [titulo, sub] = TITULOS[TAB]
  $('#tbTitulo').innerHTML = `${titulo}<span class="sub">${esc(sub())}</span>`
  $('#tbStatus').innerHTML = S.online ? '🟢 online' : '🔴 offline'
  $$('#tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === TAB))

  // bolinha com as pendências de hoje + atrasados
  const pend = S.agenda.numeros.pendentesHoje + S.agenda.numeros.atrasados
  const badge = $('#badgeAgenda')
  badge.hidden = !pend
  badge.textContent = pend > 9 ? '9+' : String(pend)

  // o botão flutuante muda de função conforme a aba
  $('#fab').textContent = TAB === 'agenda' ? '📝' : TAB === 'liturgia' ? '✍️' : '+'
  $('#fab').style.display = TAB === 'liturgia' && !LIT_CACHE.get(LIT_DATA ?? S.agenda.hoje) ? 'none' : ''

  $('#main').innerHTML = ({ resumo, agenda, liturgia, cartoes, pessoas, historico, mais })[TAB]()
  ligarEventos()
  ligarCopia()
  window.scrollTo(0, manterScroll ? y : 0)
}

const linha = ({ av, t1, t2, v, sub, acao = '', dados = '', cor = '' }) => `
  <button class="row-item" ${acao ? `data-acao="${acao}"` : ''} ${dados}>
    ${av ? `<span class="avatar">${esc(av)}</span>` : ''}
    <span class="grow"><span class="t1">${t1}</span>${t2 ? `<span class="t2">${t2}</span>` : ''}</span>
    ${v ? `<span class="v" ${cor ? `style="color:${cor}"` : ''}>${v}${sub ? `<small>${sub}</small>` : ''}</span>` : ''}
    <span class="chev">›</span>
  </button>`

// --- Resumo ---
function resumo() {
  const r = S.resumo
  const prox = r.proximoVencimento
  const dias = prox?.fatura?.diasParaVencer
  const classe = dias == null ? '' : dias < 0 ? 'danger' : dias <= 3 ? 'warn' : 'ok'
  const devedores = S.pessoas.filter((p) => !p.eu && Math.abs(p.saldo) > 0.009)

  return `
    ${!S.cards.length ? '<div class="banner info">👋 Comece cadastrando um cartão na aba <b>Cartões</b> — com o dia de fechamento eu jogo cada compra na fatura certa sozinho.</div>' : ''}
    ${!S.eu && S.pessoas.length ? '<div class="banner info" id="avisoEu">👤 Marque <b>quem é você</b> na aba Pessoas para eu separar quanto da fatura é seu e nunca te cobrar.</div>' : ''}
    ${S.cobranca.dryRun && S.cobranca.ativo ? '<div class="banner warn">🧪 Cobrança em <b>modo simulação</b> — nada é enviado de verdade.</div>' : ''}

    <div class="grid g2">
      <div class="kpi"><div class="lbl">Faturas</div><div class="val">${money(r.totalFaturas)}</div><div class="sub">${S.cards.length} cartão(ões)</div></div>
      <div class="kpi ok"><div class="lbl">A receber</div><div class="val">${money(r.aReceber)}</div><div class="sub">${devedores.length} pessoa(s)</div></div>
      <div class="kpi warn"><div class="lbl">Em aberto</div><div class="val">${money(r.emAberto)}</div><div class="sub">já tirando o que recebi</div></div>
      <div class="kpi ${classe}"><div class="lbl">Vence em</div><div class="val">${prox ? (dias > 0 ? dias + 'd' : dias === 0 ? 'hoje' : 'venceu') : '—'}</div><div class="sub">${prox ? esc(prox.name) : 'sem vencimento'}</div></div>
    </div>

    ${cardHoje()}

    ${cardMinhaParte()}

    ${devedores.length ? `<div class="card">
      <h3>Quem te deve
        <button class="btn ghost sm push" data-acao="copiar-todos">📋 Copiar tudo</button>
      </h3>
      <div class="rows">${devedores.map((p) => linha({
        av: iniciais(p.name), t1: esc(p.name),
        t2: p.phone ? '📱 ' + esc(p.phone) : '<span style="color:var(--warn)">sem telefone</span>',
        v: money(p.saldo), sub: 'toque p/ ver',
        cor: p.saldo > 0 ? 'var(--warn)' : 'var(--ok)',
        acao: 'ver-pessoa', dados: `data-p="${esc(p.key)}"`,
      })).join('')}</div>
    </div>` : '<div class="card"><div class="empty"><span class="big">🎉</span>Ninguém te deve nada agora.</div></div>'}

    <div class="card"><h3>Evolução <small>12 meses</small></h3>
      ${barChart(S.evolucao.map((e) => ({ rotulo: mesBR(e.competencia), valor: e.total })))}</div>

    <div class="card"><h3>Fatura por cartão</h3>
      ${donut(S.cards.map((c) => ({ rotulo: c.name, valor: c.fatura?.total || 0 })).filter((f) => f.valor > 0))}</div>

    ${S.futuro.length ? `<div class="card"><h3>Parcelas a vencer <small>meses à frente</small></h3>
      ${barChart(S.futuro.map((f) => ({ rotulo: mesBR(f.competencia), valor: f.total })), { altura: 130 })}</div>` : ''}
  `
}

// ---------- liturgia ----------

/** Cores litúrgicas → cor da interface do dia */
const COR_LITURGICA = {
  verde: '#2fd08a', vermelho: '#ff5a6a', roxo: '#a78bfa', violeta: '#a78bfa',
  branco: '#d8dcea', dourado: '#e8b64c', rosa: '#ff7ac6', preto: '#8a92a6',
}
const corDoDia = (nome) =>
  COR_LITURGICA[String(nome || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')] ?? '#7c5cff'

/** Dia sendo visto na aba, e o cache do que já foi buscado */
let LIT_DATA = null
const LIT_CACHE = new Map()
const LIT_ABERTOS = new Set(['evangelho']) // o evangelho já abre expandido
let LIT_CARREGANDO = false

const dataLonga = (iso) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

async function carregarLiturgia(data) {
  if (LIT_CACHE.has(data) || LIT_CARREGANDO) return
  LIT_CARREGANDO = true
  try {
    LIT_CACHE.set(data, await api(`/liturgia/leituras?data=${encodeURIComponent(data)}`))
  } catch (e) {
    LIT_CACHE.set(data, { erro: e.message })
  } finally {
    LIT_CARREGANDO = false
    if (TAB === 'liturgia') render({ manterScroll: true })
  }
}

function liturgia() {
  const hoje = S.agenda.hoje
  LIT_DATA ??= hoje
  const d = LIT_CACHE.get(LIT_DATA)

  if (!d) {
    carregarLiturgia(LIT_DATA)
    return `<div class="card"><div class="empty"><span class="big">📖</span>Buscando as leituras…</div></div>`
  }
  if (d.erro) {
    return `<div class="card"><div class="empty"><span class="big">😕</span>${esc(d.erro)}</div>
      <button class="btn full" data-acao="lit-recarregar">Tentar de novo</button></div>`
  }

  const cor = corDoDia(d.cor)
  const ehHoje = LIT_DATA === hoje

  // ---- linha do tempo das leituras ----
  const timeline = d.passos.map((p) => {
    const aberto = LIT_ABERTOS.has(p.tipo)
    return `<div class="tl-item ${aberto ? 'aberto' : ''}">
      <span class="tl-dot">${p.icone}</span>
      <button class="tl-cabeca" data-acao="lit-abrir" data-passo="${esc(p.tipo)}">
        <span>
          <span class="rotulo">${esc(p.rotulo)}</span>
          ${p.referencia ? `<span class="ref">${esc(p.referencia)}</span>` : ''}
        </span>
        <span class="seta">▼</span>
      </button>
      <div class="tl-corpo">
        ${p.subtitulo ? `<div class="subtitulo">${esc(p.subtitulo)}</div>` : ''}
        ${p.refrao ? `<div class="refrao"><b>R.</b> ${esc(p.refrao)}</div>` : ''}
        <div class="texto">${esc(p.texto)}</div>
      </div>
    </div>`
  }).join('')

  // ---- anotação do dia ----
  const a = d.anotacao
  const nota = a
    ? `<div class="lit-nota">${esc(a.texto)}</div>
       <div class="muted" style="font-size:12px;margin-top:8px">
         Anotado às ${new Date(a.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${a.atualizadoEm ? ' · complementado depois' : ''}
       </div>`
    : `<div class="lit-vazio">✍️ Nada anotado ${ehHoje ? 'hoje' : 'neste dia'} ainda.<br>
       <span style="font-size:12.5px">${ehHoje ? `O bot cobra às ${S.liturgia.lembretes.map(esc).join(', ')}.` : ''}</span></div>`

  return `<div class="liturgia" style="--lit:${cor}">
    <div class="lit-capa">
      <div class="dia">${esc(dataLonga(LIT_DATA))}</div>
      <div class="celebracao">${esc(d.celebracao || 'Liturgia do dia')}</div>
      ${d.cor ? `<span class="cor"><i></i> Cor litúrgica: ${esc(d.cor)}</span>` : ''}
    </div>

    <div class="lit-dias">
      <button class="btn ghost sm" data-acao="lit-dia" data-passo="-1">‹ Ontem</button>
      <span class="atual">${ehHoje ? '📍 Hoje' : esc(rotuloDia(LIT_DATA))}</span>
      <button class="btn ghost sm" data-acao="lit-dia" data-passo="1">Amanhã ›</button>
    </div>
    ${!ehHoje ? '<button class="btn ghost full" data-acao="lit-hoje" style="margin-bottom:14px">Voltar para hoje</button>' : ''}

    <div class="card">
      <h3>📖 Leituras <small>toque para abrir</small>
        <button class="btn ghost sm push" data-acao="lit-tudo">${d.passos.every((p) => LIT_ABERTOS.has(p.tipo)) ? 'Fechar tudo' : 'Abrir tudo'}</button>
      </h3>
      <div class="timeline">${timeline}</div>
    </div>

    <div class="card">
      <h3>🙏 Minha anotação
        ${S.liturgia.sequencia > 1 ? `<span class="push lit-streak">🔥 ${S.liturgia.sequencia} dias</span>` : '<span class="push"></span>'}
      </h3>
      ${nota}
      <div class="field" style="margin-top:14px">
        <textarea id="litTexto" rows="3" style="min-height:86px" placeholder="O que você entendeu da leitura…"></textarea>
      </div>
      <div class="btn-row">
        <button class="btn" data-acao="lit-anotar" data-passo="${esc(LIT_DATA)}">${a ? '＋ Somar' : '✍️ Anotar'}</button>
        ${a ? `<button class="btn ghost" data-acao="lit-trocar" data-passo="${esc(LIT_DATA)}">Substituir</button>` : ''}
      </div>
    </div>

    <div class="card">
      <h3>📤 Enviar e copiar</h3>
      <div class="btn-row">
        <button class="btn ghost" data-copiar="#litTextoCompleto" data-rotulo="Leituras copiadas!">📋 Copiar</button>
        <button class="btn ghost" data-acao="liturgia-ler-enviar">📤 Nos grupos</button>
      </div>
      <div class="muted" style="font-size:12px;margin-top:10px">
        Todo dia às ${esc(S.liturgia.horario)} em ${S.liturgia.grupos.length} grupo(s).
        <button class="btn ghost sm" data-acao="liturgia-grupos" style="margin-left:6px">Escolher</button>
      </div>
      <div id="litTextoCompleto" style="display:none">${esc(d.partes.join('\n\n━━━━━━━━━━\n\n'))}</div>
    </div>

    ${S.liturgia.anotacoes.length > 1 ? `<div class="card">
      <h3>Anotações anteriores <small>${S.liturgia.anotacoes.length}</small></h3>
      <div class="rows">${S.liturgia.anotacoes.filter((x) => x.data !== LIT_DATA).slice(0, 10).map((x) => `
        <button class="row-item" data-acao="lit-ir" data-passo="${esc(x.data)}">
          <span class="avatar">🙏</span>
          <span class="grow"><span class="t1">${esc(rotuloDia(x.data))}</span>
          <span class="t2">${esc(x.texto.replace(/\n+/g, ' ').slice(0, 60))}</span></span>
          <span class="chev">›</span>
        </button>`).join('')}</div>
    </div>` : ''}
  </div>`
}

function cardLiturgia() {
  const L = S.liturgia
  const nomeGrupo = (jid) => S.grupos.lista.find((g) => g.jid === jid)?.nome ?? jid
  const a = L.anotacaoHoje

  return `<div class="card">
    <h3>🙏 Liturgia diária <small>leituras às ${esc(L.horario)}</small></h3>

    <div class="rows">
      <div class="row-item" style="cursor:default">
        <span class="grow t1" style="font-weight:500">Grupos que recebem</span>
        <b>${L.grupos.length}</b>
      </div>
      ${L.grupos.map((j) => `<div class="row-item" style="cursor:default">
        <span class="avatar">📖</span><span class="grow t1" style="font-weight:500;font-size:14px">${esc(nomeGrupo(j))}</span></div>`).join('')}
      <div class="row-item" style="cursor:default">
        <span class="grow t1" style="font-weight:500">Cobrança do /ld</span>
        <span class="tag">${L.lembretes.map(esc).join(' · ')}</span>
      </div>
      ${L.sequencia > 1 ? `<div class="row-item" style="cursor:default">
        <span class="grow t1" style="font-weight:500">Sequência</span><b style="color:var(--ok)">🔥 ${L.sequencia} dias</b></div>` : ''}
      <div class="row-item" style="cursor:default">
        <span class="grow t1" style="font-weight:500">Anotação de hoje</span>
        ${a ? '<span class="tag ok">feita</span>' : '<span class="tag warn">pendente</span>'}
      </div>
    </div>

    <div class="btn-row" style="margin-top:14px">
      <button class="btn" data-acao="ir-liturgia">🙏 Abrir a aba</button>
      <button class="btn ghost" data-acao="liturgia-grupos">Grupos</button>
    </div>
  </div>`
}

// ---------- grupos ----------

const CATEGORIAS = {
  diversao: '🎲 Diversão',
  jogos: '🕹️ Jogos',
  fe: '🙏 Fé',
  grupo: '👥 Grupo',
  midia: '🖼️ Mídia',
  utilidades: '🔧 Utilidades',
}

/** Estado de um comando num grupo: 'liberado' | 'bloqueado' | 'desligado' */
function estadoComando(cmd, cfg) {
  if (cfg.bloqueados?.includes(cmd.nome)) return 'bloqueado'
  if (cfg.comandos?.includes(cmd.nome)) return 'liberado'
  return cfg.categorias?.includes(cmd.categoria) ? 'liberado' : 'desligado'
}

function cardGrupos() {
  const { lista, padrao } = S.grupos
  const nomesCat = padrao.categorias.map((c) => CATEGORIAS[c] ?? c).join(', ') || 'nenhuma'

  return `<div class="card">
    <h3>Grupos <small>o que o bot responde em cada um</small></h3>
    ${lista.length ? `<div class="rows">${lista.map((g) => {
      const liberados = S.grupos.comandos.filter((c) => estadoComando(c, g) === 'liberado').length
      return linha({
        av: g.silenciado ? '🔇' : '👥',
        t1: esc(g.nome),
        t2: g.silenciado ? 'silenciado' : `${liberados} comando(s) · ${(g.categorias ?? []).map((c) => (CATEGORIAS[c] ?? c).replace(/^\S+\s/, '')).join(', ') || 'nada'}`,
        acao: 'config-grupo', dados: `data-jid="${esc(g.jid)}"`,
      })
    }).join('')}</div>`
      : `<div class="empty"><span class="big">👥</span>Nenhum grupo ainda.<br>
         Eles aparecem sozinhos assim que alguém usar um comando lá.</div>`}

    <div class="btn-row" style="margin-top:14px">
      <button class="btn ghost" data-acao="config-padrao">⚙️ Padrão dos novos</button>
    </div>
    <div class="muted" style="font-size:12px;margin-top:10px">Grupo novo já entra com: ${esc(nomesCat)}.</div>
    <div class="muted" style="font-size:12px;margin-top:6px">Comandos de <b>financeiro</b> e <b>agenda</b> nunca funcionam em grupo — são só seus, no privado.</div>
  </div>`
}

/** Editor de um grupo (ou do padrão, quando jid = null) */
function configGrupo(jid) {
  const padraoMode = !jid
  const cfg = padraoMode
    ? { ...S.grupos.padrao, nome: 'Padrão dos grupos novos', silenciado: false, regras: '', boasVindas: false }
    : S.grupos.lista.find((g) => g.jid === jid)
  if (!cfg) return

  // cópia local: só grava quando você toca em Salvar
  const estado = {
    categorias: [...(cfg.categorias ?? [])],
    comandos: [...(cfg.comandos ?? [])],
    bloqueados: [...(cfg.bloqueados ?? [])],
    silenciado: Boolean(cfg.silenciado),
    boasVindas: Boolean(cfg.boasVindas),
    regras: cfg.regras ?? '',
  }

  const corpoComandos = () => Object.entries(CATEGORIAS).map(([id, rotulo]) => {
    const doGrupo = S.grupos.comandos.filter((c) => c.categoria === id)
    if (!doGrupo.length) return ''
    const catOn = estado.categorias.includes(id)
    return `<div class="field">
      <button class="chip ${catOn ? 'on' : ''}" data-cat="${id}" style="margin-bottom:9px">${rotulo} — ${catOn ? 'ligada' : 'desligada'}</button>
      <div class="chips">
        ${doGrupo.map((c) => {
          const est = estadoComando(c, estado)
          const cor = est === 'liberado' ? 'on' : est === 'bloqueado' ? 'bloq' : ''
          return `<button class="chip dim ${cor}" data-cmd="${esc(c.nome)}" title="${esc(c.descricao)}">${est === 'bloqueado' ? '🚫 ' : ''}/${esc(c.nome)}</button>`
        }).join('')}
      </div>
    </div>`
  }).join('')

  const corpo = `
    ${padraoMode ? '<div class="banner info">Isso vale para grupos que o bot ainda não conhece. Grupos já existentes não mudam.</div>' : ''}
    ${!padraoMode ? `<div class="field">
      <button class="chip ${estado.silenciado ? 'on' : ''}" data-toggle="silenciado" style="width:100%;justify-content:center">
        ${estado.silenciado ? '🔇 Silenciado — não responde nada' : '🔊 Ativo neste grupo'}
      </button>
    </div>` : ''}

    <div id="cgComandos">${corpoComandos()}</div>
    <div class="muted" style="font-size:12px;margin:-4px 0 16px">
      Toque na <b>categoria</b> para ligar/desligar tudo dela. Toque num <b>comando</b> para abrir uma exceção — roxo é liberado, 🚫 é bloqueado.
    </div>

    ${!padraoMode ? `
      <div class="field">
        <button class="chip ${estado.boasVindas ? 'on' : ''}" data-toggle="boasVindas" style="width:100%;justify-content:center">
          ${estado.boasVindas ? '👋 Saúda quem entra' : '👋 Boas-vindas desligadas'}
        </button>
      </div>
      <div class="field"><label>Regras do grupo</label>
        <textarea id="cgRegras" rows="4" style="min-height:90px" placeholder="1. Sem spam&#10;2. Respeito sempre">${esc(estado.regras)}</textarea>
      </div>` : ''}`

  const { bg, fechar } = sheet({
    titulo: cfg.nome,
    corpo,
    acoes: [{
      label: 'Salvar', onClick: async ({ btn }) => {
        btn.disabled = true
        try {
          const dados = { ...estado }
          if (!padraoMode) dados.regras = $('#cgRegras', bg)?.value ?? ''
          if (padraoMode) await api('/grupos/padrao', { body: dados })
          else await api(`/grupos/${encodeURIComponent(jid)}`, { method: 'PATCH', body: dados })
          fechar(); toast('Salvo.'); render({ manterScroll: true })
        } catch (e) { btn.disabled = false; toast(e.message, 'err') }
      },
    }],
  })

  const redesenhar = () => {
    $('#cgComandos', bg).innerHTML = corpoComandos()
    ligarChips()
  }

  function ligarChips() {
    $$('[data-cat]', bg).forEach((b) => {
      b.onclick = () => {
        vibrar()
        const id = b.dataset.cat
        if (estado.categorias.includes(id)) estado.categorias = estado.categorias.filter((c) => c !== id)
        else estado.categorias.push(id)
        redesenhar()
      }
    })
    $$('[data-cmd]', bg).forEach((b) => {
      b.onclick = () => {
        vibrar()
        const nome = b.dataset.cmd
        const cmd = S.grupos.comandos.find((c) => c.nome === nome)
        const est = estadoComando(cmd, estado)
        // liberado → bloqueado → volta a seguir a categoria
        if (est === 'liberado') {
          estado.comandos = estado.comandos.filter((c) => c !== nome)
          estado.bloqueados.push(nome)
        } else if (est === 'bloqueado') {
          estado.bloqueados = estado.bloqueados.filter((c) => c !== nome)
        } else {
          estado.comandos.push(nome)
        }
        redesenhar()
      }
    })
    $$('[data-toggle]', bg).forEach((b) => {
      b.onclick = () => {
        vibrar()
        const campo = b.dataset.toggle
        estado[campo] = !estado[campo]
        b.classList.toggle('on', estado[campo])
        b.textContent = campo === 'silenciado'
          ? (estado.silenciado ? '🔇 Silenciado — não responde nada' : '🔊 Ativo neste grupo')
          : (estado.boasVindas ? '👋 Saúda quem entra' : '👋 Boas-vindas desligadas')
      }
    })
  }
  ligarChips()
}

// ---------- agenda ----------

const RECORRENCIA = {
  diaria: 'todo dia', uteis: 'seg a sex',
  semanal: (d) => `toda ${['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][d]}`,
  mensal: (d) => `todo dia ${d}`,
}
const descreverRec = (r) => {
  if (!r) return ''
  const v = RECORRENCIA[r.tipo]
  return typeof v === 'function' ? v(Number(r.dia)) : v || ''
}

const rotuloDia = (dataISO) => {
  const hoje = S.agenda.hoje
  if (dataISO === hoje) return 'Hoje'
  const d = new Date(dataISO + 'T12:00:00')
  const amanha = new Date(hoje + 'T12:00:00'); amanha.setDate(amanha.getDate() + 1)
  if (dataISO === `${amanha.getFullYear()}-${String(amanha.getMonth() + 1).padStart(2, '0')}-${String(amanha.getDate()).padStart(2, '0')}`) return 'Amanhã'
  const semana = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][d.getDay()]
  return `${semana}, ${String(d.getDate()).padStart(2, '0')}/${MESES[d.getMonth()]}`
}

/** Uma linha de agenda com o círculo de concluir */
function linhaAgenda(i, dataISO) {
  return `<div class="row-item ${i.feito ? 'item-feito' : ''}" style="cursor:default">
    <button class="check ${i.feito ? 'on' : ''}" data-acao="toggle-feito" data-num="${i.num}" data-data="${esc(dataISO)}" data-feito="${i.feito ? 1 : 0}" aria-label="Concluir">✓</button>
    <span class="hora-chip ${i.hora ? '' : 'vazia'}">${i.hora || '—'}</span>
    <button class="grow" data-acao="editar-agenda" data-num="${i.num}" style="background:none;border:none;text-align:left;color:inherit;font:inherit;padding:0;min-width:0">
      <span class="t1">${esc(i.texto)}</span>
      ${i.recorrencia ? `<span class="t2">🔁 ${esc(descreverRec(i.recorrencia))}</span>` : ''}
    </button>
    <span class="muted" style="font-size:11px">#${i.num}</span>
  </div>`
}

function agenda() {
  const { dias, atrasados, numeros } = S.agenda
  const comAlgo = dias.filter((d) => d.itens.length)

  if (!comAlgo.length && !atrasados.length) {
    return `<div class="card"><div class="empty"><span class="big">📅</span>
      Nada anotado ainda.<br>Toque no <b>📝</b> para adicionar.</div>
      <button class="btn full" data-acao="novo-lembrete">📝 Anotar algo</button></div>`
  }

  const blocos = comAlgo.map((d) => {
    const pend = d.itens.filter((i) => !i.feito).length
    return `<div class="card">
      <h3>${esc(rotuloDia(d.data))}
        <span class="push muted" style="font-weight:600;font-size:12px">${pend ? `${pend} pendente(s)` : '✅ tudo feito'}</span>
      </h3>
      <div class="rows">${d.itens.map((i) => linhaAgenda(i, d.data)).join('')}</div>
    </div>`
  }).join('')

  return `
    ${atrasados.length ? `<div class="card" style="border-color:rgba(255,90,106,.4)">
      <h3>⚠️ Ficou pra trás <span class="push muted" style="font-weight:600;font-size:12px">${atrasados.length}</span></h3>
      <div class="rows">${atrasados.map((i) => linhaAgenda(i, i.data)).join('')}</div>
    </div>` : ''}

    <div class="grid g2">
      <div class="kpi ${numeros.pendentesHoje ? '' : 'ok'}"><div class="lbl">Hoje</div><div class="val">${numeros.pendentesHoje}</div><div class="sub">de ${numeros.hoje} item(ns)</div></div>
      <div class="kpi ${numeros.atrasados ? 'danger' : 'ok'}"><div class="lbl">Atrasados</div><div class="val">${numeros.atrasados}</div><div class="sub">${numeros.total} no total</div></div>
    </div>

    ${blocos}

    <div class="btn-row" style="margin-top:14px">
      <button class="btn ghost" data-acao="copiar-agenda">📋 Copiar o dia</button>
      <button class="btn ghost" data-acao="copiar-semana">📋 Copiar a semana</button>
    </div>`
}

/** Bloco "Hoje" no topo do Resumo */
function cardHoje() {
  const hoje = S.agenda.dias.find((d) => d.data === S.agenda.hoje)
  const atrasados = S.agenda.atrasados
  const pend = (hoje?.itens ?? []).filter((i) => !i.feito)
  if (!pend.length && !atrasados.length) return ''

  return `<div class="card" style="border-color:rgba(124,92,255,.4)">
    <h3>📅 Hoje
      <button class="btn ghost sm push" data-acao="ir-agenda">Ver agenda ›</button>
    </h3>
    <div class="rows">
      ${pend.slice(0, 5).map((i) => linhaAgenda(i, S.agenda.hoje)).join('')}
      ${atrasados.slice(0, 3).map((i) => linhaAgenda(i, i.data)).join('')}
    </div>
    ${pend.length > 5 || atrasados.length > 3 ? '<div class="muted" style="font-size:12px;margin-top:8px">…e mais. Veja tudo na aba Agenda.</div>' : ''}
  </div>`
}

/** "Quanto EU tenho que pagar" — a sua fatia de cada fatura */
function cardMinhaParte() {
  if (!S.eu) return ''
  const mp = S.minhaParte
  const nomeEu = S.pessoas.find((p) => p.eu)?.name || 'Você'
  if (!mp || (!mp.total && !mp.semCartao.total)) {
    return `<div class="card"><h3>🫵 Minha parte <small>${esc(nomeEu)}</small></h3>
      <div class="empty">Você não tem nenhum gasto nas faturas deste mês. 🎉</div></div>`
  }

  const blocos = mp.porCartao.map((c) => {
    const venc = c.vencimento ? new Date(c.vencimento + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : null
    const quitado = c.falta <= 0.009
    return `<button class="row-item" data-acao="ver-minha-parte" data-card="${esc(c.cardKey)}">
      <span class="avatar">💳</span>
      <span class="grow">
        <span class="t1">${esc(c.card)}</span>
        <span class="t2">${c.itens.length} lançamento(s) · fatura ${mesBR(c.competencia)}${venc ? ` · vence ${venc}` : ''}</span>
      </span>
      <span class="v" ${quitado ? 'style="color:var(--ok)"' : ''}>
        ${quitado ? 'pago ✓' : money(c.falta)}
        <small>${quitado ? `de ${money(c.total)}` : c.pago ? `pagou ${money(c.pago)} de ${money(c.total)}` : `${money(c.total)} lançados`}</small>
      </span>
      <span class="chev">›</span>
    </button>`
  }).join('')

  const soltos = mp.semCartao.total > 0
    ? `<div class="row-item" style="cursor:default"><span class="avatar">💸</span>
       <span class="grow"><span class="t1">Sem cartão</span><span class="t2">${mp.semCartao.itens.length} lançamento(s)</span></span>
       <span class="v">${money(mp.semCartao.total)}</span></div>`
    : ''

  return `<div class="card" style="border-color:rgba(124,92,255,.4)">
    <h3>🫵 Minha parte
      <button class="btn ghost sm push" data-acao="copiar-minha-parte">📋 Copiar</button>
    </h3>
    <div style="text-align:center;padding:2px 0 12px">
      <div class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;font-weight:700">
        ${mp.aPagar > 0.009 ? 'Eu ainda tenho que pagar' : 'Minha parte está quitada'}
      </div>
      <div style="font-size:32px;font-weight:700;letter-spacing:-1.2px;margin-top:3px${mp.aPagar <= 0.009 ? ';color:var(--ok)' : ''}">
        ${money(Math.max(mp.aPagar, 0))}
      </div>
      <div class="muted" style="font-size:12.5px;margin-top:3px">
        ${esc(nomeEu)} · ${money(mp.total)} lançados nas faturas deste mês${mp.pago ? ` · ${money(mp.pago)} já pagos` : ''}
      </div>
    </div>
    <div class="rows">${blocos}${soltos}</div>
  </div>`
}

// --- Cartões ---
function cartoes() {
  if (!S.cards.length) {
    return `<div class="card"><div class="empty"><span class="big">💳</span>Nenhum cartão ainda.</div>
      <button class="btn full" data-acao="novo-cartao">+ Cadastrar cartão</button></div>`
  }

  return S.cards.map((c) => {
    const f = c.fatura
    const d = f.diasParaVencer
    const tag = d == null ? '<span class="tag">sem vencimento</span>'
      : d < 0 ? `<span class="tag danger">venceu há ${-d}d</span>`
      : d === 0 ? '<span class="tag danger">vence hoje</span>'
      : d <= 3 ? `<span class="tag warn">vence em ${d}d</span>`
      : `<span class="tag ok">vence em ${d}d</span>`
    const uso = c.limite ? Math.min(100, Math.round((f.total / c.limite) * 100)) : null

    return `<div class="card">
      <h3>
        <span style="width:10px;height:10px;border-radius:3px;background:${esc(c.cor || '#7c5cff')}"></span>
        ${esc(c.name)}
        <span class="push">${tag}</span>
      </h3>

      <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:10px">
        <div>
          <div class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;font-weight:700">Fatura ${mesBR(f.competencia)}</div>
          <div style="font-size:27px;font-weight:690;letter-spacing:-1px;margin-top:2px">${money(f.total)}</div>
          <div class="muted" style="font-size:12px;margin-top:3px">fecha dia ${c.fechamento ?? '—'} · vence dia ${c.vencimento ?? '—'}</div>
        </div>
        ${f.pago > 0 ? `<div class="right"><div class="muted" style="font-size:11px">recebi</div><b style="color:var(--ok)">${money(f.pago)}</b></div>` : ''}
      </div>

      ${uso != null ? `<div class="bar-track"><div class="bar-fill ${uso > 90 ? 'danger' : uso > 70 ? 'warn' : ''}" style="width:${uso}%"></div></div>
        <div class="muted" style="font-size:11.5px;margin-top:5px">${uso}% de ${money(c.limite)}</div>` : ''}

      <div class="rows" style="margin-top:10px">
        ${f.pessoas.length ? f.pessoas.map((p) => linha({
          av: p.person === S.eu ? '🫵' : iniciais(p.name),
          t1: esc(p.name) + (p.person === S.eu ? ' <span class="tag accent">você</span>' : ''),
          t2: p.pago ? `pagou ${money(p.pago)}` : `${p.items.length} lançamento(s)`,
          v: money(p.aberto), cor: p.person === S.eu ? 'var(--accent-2)' : '',
          acao: 'ver-pessoa', dados: `data-p="${esc(p.person)}"`,
        })).join('') : '<div class="muted" style="font-size:13.5px;padding:8px 0">Nenhum lançamento nesta fatura.</div>'}
      </div>

      <div class="btn-row" style="margin-top:14px">
        <button class="btn" data-acao="cobrar" data-card="${esc(c.key)}">📤 Cobrar</button>
        <button class="btn ghost" data-copiar="/texto/fatura?card=${encodeURIComponent(c.key)}&comp=${encodeURIComponent(f.competencia)}" data-rotulo="Resumo da fatura copiado!">📋 Copiar</button>
      </div>
      <div class="btn-row" style="margin-top:8px">
        <button class="btn ghost" data-acao="ver-fatura" data-card="${esc(c.key)}">🧾 Faturas</button>
        <button class="btn ghost" data-acao="hist-cartao" data-card="${esc(c.key)}">📜 Histórico</button>
        <button class="btn ghost" data-acao="editar-cartao" data-card="${esc(c.key)}" style="flex:0 0 52px">✏️</button>
      </div>
    </div>`
  }).join('') + `<button class="btn ghost full" style="margin-top:14px" data-acao="novo-cartao">+ Novo cartão</button>`
}

// --- Pessoas ---
function pessoas() {
  if (!S.pessoas.length) {
    return `<div class="card"><div class="empty"><span class="big">👥</span>Ninguém cadastrado ainda.<br>As pessoas aparecem sozinhas quando você lança um gasto.</div>
      <button class="btn full" data-acao="nova-pessoa">+ Adicionar pessoa</button></div>`
  }
  const semFone = S.pessoas.filter((p) => !p.eu && !p.phone).length
  const eu = S.pessoas.find((p) => p.eu)
  const outros = S.pessoas.filter((p) => !p.eu)

  const item = (p) => linha({
    av: p.eu ? '🫵' : iniciais(p.name),
    t1: esc(p.name) + (p.eu ? ' <span class="tag accent">você</span>' : ''),
    t2: p.eu ? 'não entra em "a receber" nem é cobrado'
      : p.phone ? '📱 ' + esc(p.phone) : '<span style="color:var(--warn)">sem telefone</span>',
    v: money(p.saldo),
    sub: p.eu ? 'saldo de tudo' : p.totalPaid ? `pagou ${money(p.totalPaid)}` : '',
    cor: p.eu ? 'var(--accent-2)' : p.saldo > 0.009 ? 'var(--warn)' : 'var(--txt-3)',
    acao: 'ver-pessoa', dados: `data-p="${esc(p.key)}"`,
  })

  return `
    ${!S.eu ? '<div class="banner info">👤 Toque numa pessoa e marque <b>"sou eu"</b> — assim eu separo quanto da fatura é seu e nunca te incluo na cobrança.</div>' : ''}
    ${semFone ? `<div class="banner warn">📱 ${semFone} pessoa(s) sem telefone — não dá para cobrar automaticamente.</div>` : ''}

    ${eu ? `<div class="card" style="border-color:rgba(124,92,255,.4)">
      <h3>Você</h3><div class="rows">${item(eu)}</div></div>` : ''}

    <div class="card">
      ${eu ? '<h3>Outras pessoas</h3>' : ''}
      <div class="rows">${outros.map(item).join('')}</div>
    </div>
    <button class="btn ghost full" style="margin-top:14px" data-acao="nova-pessoa">+ Nova pessoa</button>`
}

// --- Histórico ---

/** Filtros do histórico — sobrevivem ao re-render */
const HIST = { agrupar: 'dia', cartao: null, pessoa: null }

function historico() {
  const nomes = Object.fromEntries(S.pessoas.map((p) => [p.key, p.name]))
  const cartoes_ = Object.fromEntries(S.cards.map((c) => [c.key, c.name]))
  const nomeP = (k) => nomes[k] || k
  const nomeC = (k) => (k ? cartoes_[k] || k : 'Sem cartão')

  const passa = (x) =>
    (!HIST.cartao || (HIST.cartao === '__sem' ? !x.card : x.card === HIST.cartao)) &&
    (!HIST.pessoa || x.person === HIST.pessoa)

  const gastos = S.expenses.filter(passa)
  const pagamentos = S.payments.filter(passa)
  const total = gastos.reduce((s, e) => s + e.value, 0)
  const totalPago = pagamentos.reduce((s, p) => s + p.value, 0)

  // ---- barra de filtros ----
  const chip = (rotulo, tipo, valor, ligado) =>
    `<button class="chip dim ${ligado ? 'on' : ''}" data-filtro="${tipo}" data-v="${esc(valor ?? '')}">${rotulo}</button>`

  const filtros = `
    <div class="filtros">
      <div class="rotulo">Agrupar por</div>
      <div class="chips" style="margin-bottom:12px">
        ${chip('📅 Dia', 'agrupar', 'dia', HIST.agrupar === 'dia')}
        ${chip('💳 Cartão', 'agrupar', 'cartao', HIST.agrupar === 'cartao')}
        ${chip('👥 Pessoa', 'agrupar', 'pessoa', HIST.agrupar === 'pessoa')}
      </div>

      <div class="rotulo">Filtrar</div>
      <div class="chips scroll">
        ${chip('Tudo', 'limpar', '', !HIST.cartao && !HIST.pessoa)}
        ${S.cards.map((c) => chip('💳 ' + esc(c.name), 'cartao', c.key, HIST.cartao === c.key)).join('')}
        ${S.expenses.some((e) => !e.card) ? chip('💸 Sem cartão', 'cartao', '__sem', HIST.cartao === '__sem') : ''}
        ${S.pessoas.map((p) => chip((p.eu ? '🫵 ' : '👤 ') + esc(p.name), 'pessoa', p.key, HIST.pessoa === p.key)).join('')}
      </div>

      <div class="resumo-filtro">
        <b>${gastos.length}</b> lançamento(s) · <b>${money(total)}</b>${totalPago ? ` · recebido <b>${money(totalPago)}</b>` : ''}
        ${HIST.cartao || HIST.pessoa ? ` · <span class="tag accent">${[HIST.cartao ? nomeC(HIST.cartao === '__sem' ? null : HIST.cartao) : null, HIST.pessoa ? nomeP(HIST.pessoa) : null].filter(Boolean).map(esc).join(' + ')}</span>` : ''}
      </div>
    </div>`

  if (!gastos.length) {
    return filtros + `<div class="card"><div class="empty"><span class="big">🧾</span>
      ${S.expenses.length ? 'Nenhum lançamento com esse filtro.' : 'Nenhum gasto lançado ainda.'}</div></div>`
  }

  // ---- agrupamento ----
  const chaves = {
    dia: (e) => e.at.slice(0, 10),
    cartao: (e) => e.card || '__sem',
    pessoa: (e) => e.person,
  }
  const rotulos = {
    dia: (k) => (k === hojeISO() ? 'Hoje' : new Date(k + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })),
    cartao: (k) => (k === '__sem' ? '💸 Sem cartão' : '💳 ' + nomeC(k)),
    pessoa: (k) => nomeP(k) + (k === S.eu ? ' (você)' : ''),
  }

  const grupos = new Map()
  for (const e of gastos.slice(0, 400)) {
    const k = chaves[HIST.agrupar](e)
    if (!grupos.has(k)) grupos.set(k, [])
    grupos.get(k).push(e)
  }
  // dia vem do mais recente; cartão/pessoa do maior total
  const ordenadas = [...grupos.entries()]
  if (HIST.agrupar === 'dia') ordenadas.sort((a, b) => b[0].localeCompare(a[0]))
  else ordenadas.sort((a, b) => b[1].reduce((s, i) => s + i.value, 0) - a[1].reduce((s, i) => s + i.value, 0))

  const blocos = ordenadas.map(([k, itens]) => {
    const soma = itens.reduce((s, i) => s + i.value, 0)
    // dentro do grupo, o subtítulo não repete a dimensão do agrupamento
    const detalhe = (e) => [
      e.note,
      HIST.agrupar !== 'cartao' && e.card ? cartoes_[e.card] : null,
      e.parcela ? `${e.parcela.n}/${e.parcela.total}` : null,
      HIST.agrupar === 'dia' ? `fatura ${mesBR(e.competencia)}` : dataBR(e.at),
    ].filter(Boolean).map(esc).join(' · ')

    return `<div class="card">
      <h3>${esc(rotulos[HIST.agrupar](k))}
        <span class="push muted nowrap" style="font-weight:650;font-size:13.5px">${money(soma)}</span>
      </h3>
      <div class="rows">${itens.map((e) => linha({
        av: HIST.agrupar === 'pessoa' ? '🧾' : e.person === S.eu ? '🫵' : iniciais(nomeP(e.person)),
        t1: HIST.agrupar === 'pessoa' ? esc(e.note || 'sem descrição') : esc(nomeP(e.person)),
        t2: HIST.agrupar === 'pessoa'
          ? [e.card ? cartoes_[e.card] : null, e.parcela ? `${e.parcela.n}/${e.parcela.total}` : null, dataBR(e.at)].filter(Boolean).map(esc).join(' · ')
          : detalhe(e),
        v: money(e.value), acao: 'ver-gasto', dados: `data-id="${esc(e.id)}"`,
      })).join('')}</div>
    </div>`
  }).join('')

  const pags = pagamentos.slice(0, 60)
  return filtros + blocos +
    (pags.length ? `<div class="card"><h3>Pagamentos recebidos
      <span class="push muted nowrap" style="font-weight:650;font-size:13.5px">${money(totalPago)}</span></h3><div class="rows">
      ${pags.map((p) => linha({
        av: '💵', t1: esc(nomeP(p.person)),
        t2: `${dataBR(p.at)}${p.card ? ' · ' + esc(nomeC(p.card)) : ''}${p.note ? ' · ' + esc(p.note) : ''}`,
        v: money(p.value), cor: 'var(--ok)', acao: 'ver-pagamento', dados: `data-id="${esc(p.id)}"`,
      })).join('')}
    </div></div>` : '')
}

// --- Mais ---
function mais() {
  const s = S.settings
  const d = S.dono
  return `
    <div class="card"><h3>Dono do bot <small>quem usa financeiro e agenda</small></h3>
      <div class="rows">
        <div class="row-item" style="cursor:default"><span class="grow t1" style="font-weight:500">Número atual</span>
          ${d.atual ? `<b class="mono">${esc(d.atual.split('@')[0])}</b>` : '<span class="tag warn">nenhum ainda</span>'}</div>
      </div>
      ${d.token ? `
        <div class="banner warn" style="margin-top:12px">
          🔑 Token para trocar o dono: <code style="user-select:all">${esc(d.token)}</code><br>
          <span style="font-size:12px">Use no WhatsApp: <code>/dono trocar ${esc(d.token)}</code> — a partir do número novo, no privado. Gerado a cada reinício; defina <code>DONO_TOKEN</code> no servidor para fixar.</span>
        </div>` : `
        <div class="muted" style="font-size:12px;margin-top:10px">Token fixo definido em <code>DONO_TOKEN</code> — veja no servidor.</div>`}
    </div>

    <div class="card"><h3>Atalhos</h3><div class="rows">
      ${linha({ av: '📋', t1: 'Lançar em lote', t2: 'várias linhas de uma vez', acao: 'abrir-lote' })}
      ${linha({ av: '💳', t1: 'Novo cartão', t2: 'fechamento, vencimento, limite', acao: 'novo-cartao' })}
      ${linha({ av: '👤', t1: 'Nova pessoa', t2: 'nome e telefone', acao: 'nova-pessoa' })}
    </div></div>

    <div class="card"><h3>Quem sou eu <small>separa a sua parte da fatura</small></h3>
      <div class="chips" id="chipsEu">
        <button class="chip ${!S.eu ? 'on' : ''}" data-v="">ninguém</button>
        ${S.pessoas.map((p) => `<button class="chip ${p.eu ? 'on' : ''}" data-v="${esc(p.key)}">${p.eu ? '🫵 ' : ''}${esc(p.name)}</button>`).join('')}
      </div>
      <div class="muted" style="font-size:12.5px;margin-top:10px">Os gastos dessa pessoa não entram em "a receber" e ela nunca é cobrada — mas continuam contando no total da fatura.</div>
    </div>

    <div class="card"><h3>Chave PIX <small>vai em toda cobrança</small></h3>
      <div class="field"><label>Chave</label><input id="cfgPix" value="${esc(s.pix)}" placeholder="email, telefone ou aleatória"></div>
      <div class="field"><label>Nome do titular</label><input id="cfgPixNome" value="${esc(s.pixNome)}" placeholder="Daniel S."></div>
      <button class="btn full" data-acao="salvar-config">Salvar</button>
    </div>

    <div class="card"><h3>Cobrança automática</h3>
      <div class="rows">
        <div class="row-item" style="cursor:default"><span class="grow t1" style="font-weight:500">Agendador</span>${S.cobranca.ativo ? '<span class="tag ok">ligado</span>' : '<span class="tag danger">desligado</span>'}</div>
        <div class="row-item" style="cursor:default"><span class="grow t1" style="font-weight:500">Horário</span><span class="tag">${esc(S.cobranca.horario)}</span></div>
        <div class="row-item" style="cursor:default"><span class="grow t1" style="font-weight:500">Modo</span>${S.cobranca.dryRun ? '<span class="tag warn">simulação</span>' : '<span class="tag danger">envio real</span>'}</div>
        <div class="row-item" style="cursor:default"><span class="grow t1" style="font-weight:500">Gatilhos</span><span class="tag">D-5 · D-2 · D-0 · D+1</span></div>
      </div>
      <div class="btn-row" style="margin-top:14px">
        <button class="btn ghost" data-acao="simular-lembretes">🧪 Simular</button>
        <button class="btn ghost" data-acao="rodar-lembretes">📤 Disparar</button>
      </div>
    </div>

    ${cardLiturgia()}

    ${cardGrupos()}

    <div class="card"><h3>Avisos automáticos e backup</h3>
      <div class="rows">
        <div class="row-item" style="cursor:default"><span class="grow t1" style="font-weight:500">Chat de avisos</span>
          ${S.backup.temDestino ? '<span class="tag ok">marcado</span>' : '<span class="tag warn">nenhum</span>'}</div>
        <div class="row-item" style="cursor:default"><span class="grow t1" style="font-weight:500">Fechamento da fatura</span>
          <span class="tag">no dia de cada cartão</span></div>
        <div class="row-item" style="cursor:default"><span class="grow t1" style="font-weight:500">Backup por WhatsApp</span>
          <span class="tag">a cada ${S.backup.intervaloDias} dias</span></div>
        <div class="row-item" style="cursor:default"><span class="grow t1" style="font-weight:500">Próximo backup</span>
          <b>${S.backup.diasAte <= 0 ? 'na próxima rotina' : `em ${S.backup.diasAte} dia(s)`}</b></div>
        ${S.backup.ultimo ? `<div class="row-item" style="cursor:default"><span class="grow t1" style="font-weight:500">Último enviado</span>
          <b>${new Date(S.backup.ultimo).toLocaleDateString('pt-BR')}</b></div>` : ''}
      </div>
      ${!S.backup.temDestino ? '<div class="banner warn" style="margin-top:14px">📲 Mande <code>/relatorios</code> pro bot, no chat onde você quer receber a fatura fechada e o backup.</div>' : ''}
      <div class="btn-row" style="margin-top:14px">
        <button class="btn ghost" data-acao="baixar-csv">📄 Baixar CSV</button>
        <button class="btn ghost" data-acao="enviar-backup" ${S.backup.temDestino ? '' : 'disabled'}>💾 Enviar agora</button>
      </div>
      <div class="muted" style="font-size:12px;margin-top:10px">Além disso, uma cópia local é guardada todo dia em <code>data/backups/</code>.</div>
    </div>

    <div class="card"><h3>Extratos bancários <small>dos PDFs</small></h3>
      ${S.accounts.length ? S.accounts.map((a) => `
        <div style="margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <b style="font-size:14px">${esc(a.name)}</b>
            <button class="btn danger sm" style="margin-left:auto" data-acao="del-conta" data-conta="${esc(a.name)}">Excluir</button>
          </div>
          ${barChart(a.months.slice().reverse().map((m) => ({ rotulo: mesBR(m.month), valor: m.saidas })), { altura: 120 })}
        </div>`).join('')
        : '<div class="empty">Nenhum extrato.<br>Mande o PDF pro bot com o nome da conta na legenda.</div>'}
    </div>

    <div class="card"><h3>Comandos do WhatsApp</h3><div class="rows">
      ${[
        ['/gasto 22 danilo nubank lanche', 'lança um gasto'],
        ['/lote', 'vários de uma vez'],
        ['/pagou 50 danilo', 'registra pagamento'],
        ['/cartoes', 'faturas e vencimentos'],
        ['/cobrar nubank', 'cobra quem deve'],
        ['/painel', 'link deste painel'],
      ].map(([c, d]) => `<div class="row-item" style="cursor:default"><span class="grow"><span class="t1 mono" style="font-size:13px;color:var(--accent-2)">${esc(c)}</span><span class="t2">${esc(d)}</span></span></div>`).join('')}
    </div></div>

    <button class="btn ghost full" data-acao="sair" style="margin-top:14px">Sair do painel</button>`
}

// ---------- ações ----------

function ligarEventos() {
  $$('[data-acao]').forEach((b) => { b.onclick = () => { vibrar(); acoes[b.dataset.acao]?.(b.dataset) } })

  $$('[data-filtro]').forEach((b) => {
    b.onclick = () => {
      vibrar()
      const { filtro, v } = b.dataset
      if (filtro === 'limpar') { HIST.cartao = null; HIST.pessoa = null }
      else if (filtro === 'agrupar') HIST.agrupar = v
      // clicar de novo no filtro ativo desliga ele
      else HIST[filtro] = HIST[filtro] === v ? null : v
      render({ manterScroll: true })
    }
  })

  const grupoEu = $('#chipsEu')
  if (grupoEu) $$('.chip', grupoEu).forEach((c) => {
    c.onclick = async () => {
      vibrar()
      await api('/settings', { body: { eu: c.dataset.v } })
      toast(c.dataset.v ? `Beleza, ${c.textContent.replace('🫵 ', '')} é você.` : 'Desmarcado.')
      render()
    }
  })
}

const acoes = {
  'novo-cartao': () => formCartao(null),
  'editar-cartao': ({ card }) => formCartao(S.cards.find((c) => c.key === card)),
  'nova-pessoa': () => formPessoa(null),
  'ver-pessoa': ({ p }) => fichaPessoa(p),
  'ver-gasto': ({ id }) => fichaGasto(id),
  'ver-pagamento': ({ id }) => fichaPagamento(id),
  'cobrar': ({ card }) => formCobranca(card),
  'ver-fatura': ({ card }) => verFaturas(card),
  'abrir-lote': () => formLote(),
  'ver-minha-parte': ({ card }) => detalheMinhaParte(card),

  // pula pro histórico já filtrado
  'hist-cartao': ({ card }) => { HIST.cartao = card; HIST.pessoa = null; HIST.agrupar = 'dia'; TAB = 'historico'; render() },
  'hist-pessoa': ({ p }) => { HIST.pessoa = p; HIST.cartao = null; HIST.agrupar = 'cartao'; TAB = 'historico'; render() },

  'copiar-minha-parte': () => {
    const mp = S.minhaParte
    let t = `👤 *Minha parte das faturas*\n\n`
    for (const c of mp.porCartao) {
      t += `*${c.card}* (${mesLongo(c.competencia)})${c.vencimento ? ` — vence ${new Date(c.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}` : ''}\n`
      t += c.itens.map((i) => `  ▸ ${dataBR(i.at)} ${money(i.value)}${i.note ? ` — ${i.note}` : ''}${i.parcela ? ` [${i.parcela.n}/${i.parcela.total}]` : ''}`).join('\n')
      t += `\n  _subtotal: ${money(c.total)}${c.pago ? ` · já paguei ${money(c.pago)} · falta ${money(Math.max(c.falta, 0))}` : ''}_\n\n`
    }
    if (mp.semCartao.total > 0) t += `*Sem cartão*: ${money(mp.semCartao.total)}\n\n`
    t += `━━━━━━━━━━\nTotal lançado: ${money(mp.total)}\n`
    if (mp.pago) t += `Já paguei: ${money(mp.pago)}\n`
    t += `💰 *Ainda tenho que pagar: ${money(Math.max(mp.aPagar, 0))}*`
    copiar(t, 'Sua parte copiada!')
  },

  'copiar-todos': () => {
    const devedores = S.pessoas.filter((p) => !p.eu && p.saldo > 0.009)
    const total = devedores.reduce((s, p) => s + p.saldo, 0)
    let t = '💰 *Quem está devendo*\n\n'
    t += devedores.map((p) => `▸ ${p.name}: *${money(p.saldo)}*`).join('\n')
    t += `\n\n━━━━━━━━━━\n💸 *Total a receber: ${money(total)}*`
    if (S.settings.pix) t += `\n\n🔑 *PIX:* ${S.settings.pix}${S.settings.pixNome ? `\n_(${S.settings.pixNome})_` : ''}`
    copiar(t, 'Resumo copiado!')
  },

  'del-conta': async ({ conta }) => {
    if (!await confirmar(`Excluir os extratos da conta "${conta}"?`, 'Excluir')) return
    await api(`/accounts/${encodeURIComponent(conta)}`, { method: 'DELETE' })
    toast('Extratos excluídos.'); render()
  },

  'salvar-config': async () => {
    await api('/settings', { body: { pix: $('#cfgPix').value.trim(), pixNome: $('#cfgPixNome').value.trim() } })
    toast('Salvo.')
  },

  'simular-lembretes': async () => {
    const r = await api('/lembretes', { body: { real: false } })
    resultadoCobranca(r.resultados, true)
  },

  'rodar-lembretes': async () => {
    if (!await confirmar('Disparar agora os lembretes de hoje de verdade no WhatsApp?', 'Disparar')) return
    const r = await api('/lembretes', { body: { real: true } })
    resultadoCobranca(r.resultados, false); render()
  },

  // --- liturgia: aba ---
  'ir-liturgia': () => { TAB = 'liturgia'; render() },

  'lit-abrir': ({ passo }) => {
    if (LIT_ABERTOS.has(passo)) LIT_ABERTOS.delete(passo)
    else LIT_ABERTOS.add(passo)
    render({ manterScroll: true })
  },

  'lit-tudo': () => {
    const d = LIT_CACHE.get(LIT_DATA)
    const todosAbertos = d.passos.every((p) => LIT_ABERTOS.has(p.tipo))
    LIT_ABERTOS.clear()
    if (!todosAbertos) d.passos.forEach((p) => LIT_ABERTOS.add(p.tipo))
    render({ manterScroll: true })
  },

  'lit-dia': ({ passo }) => {
    const d = new Date(LIT_DATA + 'T12:00:00')
    d.setDate(d.getDate() + Number(passo))
    LIT_DATA = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    render()
  },

  'lit-hoje': () => { LIT_DATA = S.agenda.hoje; render() },
  'lit-ir': ({ passo }) => { LIT_DATA = passo; TAB = 'liturgia'; render() },
  'lit-recarregar': () => { LIT_CACHE.delete(LIT_DATA); render() },

  'lit-anotar': async ({ passo }) => {
    const texto = $('#litTexto').value.trim()
    if (!texto) return toast('Escreva alguma coisa.', 'err')
    await api('/liturgia/anotacao', { body: { texto, data: passo } })
    LIT_CACHE.delete(passo)
    toast('🙏 Anotado.'); render({ manterScroll: true })
  },

  'lit-trocar': async ({ passo }) => {
    const texto = $('#litTexto').value.trim()
    if (!texto) return toast('Escreva o novo texto.', 'err')
    if (!await confirmar('Substituir a anotação deste dia pelo novo texto?', 'Substituir')) return
    await api('/liturgia/anotacao', { body: { texto, data: passo, substituir: true } })
    LIT_CACHE.delete(passo)
    toast('🙏 Substituída.'); render({ manterScroll: true })
  },

  'liturgia-ler-enviar': async () => {
    if (!S.liturgia.grupos.length) return toast('Escolha os grupos primeiro.', 'err')
    if (!await confirmar(`Enviar as leituras agora em ${S.liturgia.grupos.length} grupo(s)?`, 'Enviar')) return
    const res = await api('/liturgia/enviar', { body: {} })
    toast(`📖 ${res.resultados.filter((x) => x.status === 'enviado').length} enviado(s).`)
  },

  // --- liturgia: card antigo, na aba Mais ---
  'liturgia-anotar': async () => {
    const texto = $('#litTexto').value.trim()
    if (!texto) return toast('Escreva alguma coisa.', 'err')
    await api('/liturgia/anotacao', { body: { texto } })
    LIT_CACHE.delete(S.agenda.hoje)
    toast('🙏 Anotado.'); render({ manterScroll: true })
  },

  'liturgia-ver': ({ data }) => {
    const a = S.liturgia.anotacoes.find((x) => x.data === data)
    if (!a) return
    sheet({
      titulo: `🙏 ${data.split('-').reverse().join('/')}`,
      corpo: `<div class="msg-preview">${esc(a.texto)}</div>`,
      acoes: [{
        label: 'Excluir', classe: 'danger',
        onClick: async ({ fechar }) => {
          if (!await confirmar('Excluir essa anotação?', 'Excluir')) return
          await api(`/liturgia/anotacao/${encodeURIComponent(data)}`, { method: 'DELETE' })
          fechar(); toast('Excluída.'); render({ manterScroll: true })
        },
      }],
    })
  },

  'liturgia-ler': async () => {
    const r = await api('/liturgia/leituras')
    sheet({
      titulo: r.liturgia || 'Liturgia de hoje',
      corpo: r.partes.map((p) => `<div class="msg-preview" style="margin-bottom:12px;max-height:none">${esc(p)}</div>`).join(''),
      acoes: [{
        label: '📤 Enviar nos grupos', onClick: async ({ fechar, btn }) => {
          if (!S.liturgia.grupos.length) return toast('Escolha os grupos primeiro.', 'err')
          if (!await confirmar(`Enviar as leituras agora em ${S.liturgia.grupos.length} grupo(s)?`, 'Enviar')) return
          btn.disabled = true
          const res = await api('/liturgia/enviar', { body: {} })
          fechar()
          toast(`📖 ${res.resultados.filter((x) => x.status === 'enviado').length} enviado(s).`)
        },
      }],
    })
  },

  'liturgia-grupos': () => {
    const sel = new Set(S.liturgia.grupos)
    const { bg, fechar } = sheet({
      titulo: 'Quem recebe as leituras',
      corpo: S.grupos.lista.length
        ? `<div class="banner info">Todo dia às ${esc(S.liturgia.horario)}, nos grupos marcados.</div>
           <div class="chips" style="flex-wrap:wrap">${S.grupos.lista.map((g) => `<button class="chip ${sel.has(g.jid) ? 'on' : ''}" data-g="${esc(g.jid)}">${esc(g.nome)}</button>`).join('')}</div>`
        : '<div class="empty">Nenhum grupo conhecido ainda.<br>Use um comando num grupo para ele aparecer aqui.</div>',
      acoes: S.grupos.lista.length ? [{
        label: 'Salvar', onClick: async ({ btn }) => {
          btn.disabled = true
          await api('/liturgia/grupos', { body: { grupos: [...sel] } })
          fechar(); toast('Salvo.'); render({ manterScroll: true })
        },
      }] : [],
    })
    $$('[data-g]', bg).forEach((b) => {
      b.onclick = () => {
        vibrar()
        const j = b.dataset.g
        if (sel.has(j)) sel.delete(j); else sel.add(j)
        b.classList.toggle('on', sel.has(j))
      }
    })
  },

  // --- grupos ---
  'config-grupo': ({ jid }) => configGrupo(jid),
  'config-padrao': () => configGrupo(null),

  // --- agenda ---
  'ir-agenda': () => { TAB = 'agenda'; render() },
  'novo-lembrete': () => formLembrete(),
  'editar-agenda': ({ num }) => formLembrete(Number(num)),

  'toggle-feito': async ({ num, data, feito }) => {
    await api(`/agenda/${num}`, { method: 'PATCH', body: { feito: feito !== '1', data } })
    render({ manterScroll: true })
  },

  'copiar-agenda': async () => {
    const r = await api('/agenda/resumos')
    copiar(r.dia, 'Agenda do dia copiada!')
  },

  'copiar-semana': async () => {
    const r = await api('/agenda/resumos')
    copiar(r.semana, 'Semana copiada!')
  },

  'enviar-backup': async () => {
    const r = await api('/backup', { body: {} })
    if (r.ok) { toast('💾 Backup enviado no WhatsApp.'); render() }
  },

  'baixar-csv': async () => {
    // baixa via fetch para a senha não precisar ir na URL
    const res = await fetch('/api/export.csv', { headers: { 'x-token': TOKEN } })
    if (!res.ok) return toast('Não consegui gerar o CSV.', 'err')
    const url = URL.createObjectURL(await res.blob())
    const a = document.createElement('a')
    a.href = url
    a.download = `financeiro-${hojeISO()}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    toast('📄 CSV baixado.')
  },

  'sair': () => { sessionStorage.removeItem(CHAVE); location.reload() },
}

// ---------- entrada rápida (FAB) ----------

function formGasto() {
  const recentes = S.pessoas.slice(0, 8)
  const corpo = `
    <div class="field">
      <label>Valor total</label>
      <input id="gValor" class="valor-big" inputmode="decimal" placeholder="0,00" autocomplete="off">
    </div>

    <div class="field">
      <label>Quem comprou</label>
      <div class="chips" id="chipsPessoa">
        ${recentes.map((p) => `<button class="chip" data-v="${esc(p.name)}">${esc(p.name)}</button>`).join('')}
        <button class="chip" data-novo="1">+ outro</button>
      </div>
      <input id="gPessoa" placeholder="nome" style="margin-top:10px;display:${recentes.length ? 'none' : 'block'}">
    </div>

    ${S.cards.length ? `<div class="field">
      <label>Cartão</label>
      <div class="chips" id="chipsCartao">
        ${S.cards.map((c, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-v="${esc(c.key)}">${esc(c.name)}</button>`).join('')}
        <button class="chip" data-v="">sem cartão</button>
      </div>
    </div>` : ''}

    <div class="field">
      <label>Parcelas</label>
      <div class="chips" id="chipsParcela">
        ${[1, 2, 3, 4, 6, 10, 12].map((n) => `<button class="chip dim ${n === 1 ? 'on' : ''}" data-v="${n}">${n}x</button>`).join('')}
      </div>
      <div class="muted" id="gPorParcela" style="font-size:12.5px;margin-top:8px"></div>
    </div>

    <div class="field">
      <label>Quando</label>
      <div class="chips" id="chipsData">
        <button class="chip dim on" data-v="0">Hoje</button>
        <button class="chip dim" data-v="1">Ontem</button>
        <button class="chip dim" data-outra="1">Outra data</button>
      </div>
      <input id="gData" type="date" value="${hojeISO()}" style="margin-top:10px;display:none">
    </div>

    <div class="field"><label>Observação</label><input id="gNota" placeholder="lanche, uber, mercado…"></div>`

  const { bg, fechar } = sheet({
    titulo: 'Novo gasto',
    corpo,
    acoes: [{
      label: 'Lançar', onClick: async ({ btn }) => {
        const valor = numeroBR($('#gValor', bg).value)
        const pessoa = ($('#gPessoa', bg).value.trim()) || selecionado('#chipsPessoa')
        if (!valor) return toast('Informe o valor.', 'err')
        if (!pessoa) return toast('Informe quem comprou.', 'err')
        btn.disabled = true
        try {
          await api('/expenses', {
            body: {
              person: pessoa, value: valor,
              card: S.cards.length ? selecionado('#chipsCartao') : null,
              parcelas: Number(selecionado('#chipsParcela')) || 1,
              note: $('#gNota', bg).value.trim(),
              at: new Date($('#gData', bg).value + 'T12:00:00').toISOString(),
            },
          })
          fechar(); toast(`${money(valor)} lançado para ${pessoa}.`); render()
        } catch (e) { btn.disabled = false; toast(e.message, 'err') }
      },
    }],
    aoAbrir: () => setTimeout(() => $('#gValor', bg).focus(), 340),
  })

  const selecionado = (sel) => $(`${sel} .chip.on`, bg)?.dataset.v ?? ''

  // grupos de chips com seleção única
  for (const sel of ['#chipsPessoa', '#chipsCartao', '#chipsParcela', '#chipsData']) {
    const grupo = $(sel, bg)
    if (!grupo) continue
    $$('.chip', grupo).forEach((c) => {
      c.onclick = () => {
        vibrar()
        if (c.dataset.novo) { const i = $('#gPessoa', bg); i.style.display = 'block'; i.focus(); $$('.chip', grupo).forEach((x) => x.classList.remove('on')); return }
        if (c.dataset.outra) { const i = $('#gData', bg); i.style.display = 'block'; i.showPicker?.(); $$('.chip', grupo).forEach((x) => x.classList.remove('on')); return }
        $$('.chip', grupo).forEach((x) => x.classList.remove('on'))
        c.classList.add('on')
        if (sel === '#chipsPessoa') $('#gPessoa', bg).value = ''
        if (sel === '#chipsData') {
          const d = new Date(); d.setDate(d.getDate() - Number(c.dataset.v))
          $('#gData', bg).value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        }
        if (sel === '#chipsParcela') mostrarParcela()
      }
    })
  }

  const mostrarParcela = () => {
    const n = Number(selecionado('#chipsParcela')) || 1
    const v = numeroBR($('#gValor', bg).value)
    $('#gPorParcela', bg).textContent = n > 1 && v ? `${n}x de ${money(v / n)} — uma por fatura` : ''
  }
  $('#gValor', bg).oninput = mostrarParcela
}

/**
 * Novo lembrete (frase solta, igual ao WhatsApp) ou edição de um existente.
 * A prévia mostra como o bot entendeu antes de salvar.
 */
function formLembrete(num = null) {
  const item = num ? [...S.agenda.dias.flatMap((d) => d.itens), ...S.agenda.atrasados].find((i) => i.num === num) : null

  const corpo = item
    ? `
      <div class="field"><label>O quê</label><input id="lbTexto" value="${esc(item.texto)}"></div>
      <div class="field-row">
        <div class="field"><label>Data</label><input id="lbData" type="date" value="${esc(item.data || '')}" ${item.recorrencia ? 'disabled' : ''}></div>
        <div class="field"><label>Hora</label><input id="lbHora" type="time" value="${esc(item.hora || '')}"></div>
      </div>
      ${item.recorrencia ? `<div class="banner info">🔁 Se repete: <b>${esc(descreverRec(item.recorrencia))}</b></div>` : ''}
      <div class="muted" style="font-size:12.5px;margin-bottom:14px">Sem hora, o item vira tarefa e só aparece no resumo da manhã.</div>
      <button class="btn danger full" data-f="excluir">Excluir</button>`
    : `
      <div class="field">
        <label>Escreva como você falaria</label>
        <input id="lbFrase" placeholder="amanhã 9h pagar faculdade" autocomplete="off">
      </div>
      <div class="banner info" id="lbPreview">Comece a escrever que eu mostro como entendi.</div>
      <label style="margin-bottom:8px">Atalhos</label>
      <div class="chips scroll" id="lbAtalhos" style="margin-bottom:6px">
        ${['hoje 18:00', 'amanhã 09:00', 'sexta 14h', 'em 30min', 'todo dia 7h', 'toda segunda 19h', 'dias úteis 6h30', 'todo mês dia 10'].map((a) => `<button class="chip dim" data-atalho="${esc(a)}">${esc(a)}</button>`).join('')}
      </div>
      <div class="muted" style="font-size:12.5px">O atalho entra no começo da frase — depois é só completar com o que é.</div>`

  const { bg, fechar } = sheet({
    titulo: item ? `Item #${item.num}` : 'Novo lembrete',
    corpo,
    acoes: [{
      label: 'Salvar', onClick: async ({ btn }) => {
        btn.disabled = true
        try {
          if (item) {
            await api(`/agenda/${item.num}`, {
              method: 'PATCH',
              body: {
                texto: $('#lbTexto', bg).value.trim(),
                data: item.recorrencia ? null : $('#lbData', bg).value,
                hora: $('#lbHora', bg).value || null,
              },
            })
            fechar(); toast('Atualizado.')
          } else {
            const frase = $('#lbFrase', bg).value.trim()
            if (!frase) { btn.disabled = false; return toast('Escreva o lembrete.', 'err') }
            const r = await api('/agenda', { body: { frase } })
            fechar(); toast(`📝 ${r.item.texto}`)
          }
          render({ manterScroll: true })
        } catch (e) { btn.disabled = false; toast(e.message, 'err') }
      },
    }],
    aoAbrir: () => setTimeout(() => $(item ? '#lbTexto' : '#lbFrase', bg)?.focus(), 340),
  })

  if (item) {
    $('[data-f="excluir"]', bg).onclick = async () => {
      if (!await confirmar(`Excluir "${item.texto}"?`, 'Excluir')) return
      await api(`/agenda/${item.num}`, { method: 'DELETE' })
      fechar(); toast('Excluído.'); render({ manterScroll: true })
    }
    return
  }

  // prévia ao vivo: mostra como o bot interpretou a frase
  const campo = $('#lbFrase', bg)
  let debounce = null
  let seq = 0
  const atualizar = async () => {
    const frase = campo.value.trim()
    const alvo = $('#lbPreview', bg)
    const meu = ++seq
    if (!frase) { alvo.className = 'banner info'; alvo.textContent = 'Comece a escrever que eu mostro como entendi.'; return }
    try {
      const r = await api('/agenda/preview', { body: { frase } })
      if (meu !== seq) return // chegou fora de ordem: já tem prévia mais nova
      if (r.erro) {
        alvo.className = 'banner warn'
        alvo.textContent = r.erro === 'sem descrição' ? '⚠️ Faltou dizer o quê.' : '⚠️ Não entendi.'
        return
      }
      const quando = r.recorrencia ? `🔁 ${descreverRec(r.recorrencia)}` : `📅 ${rotuloDia(r.data)}`
      alvo.className = 'banner ok'
      alvo.innerHTML = `<b>${esc(r.texto)}</b><br>${quando}${r.hora ? ` às <b>${esc(r.hora)}</b>` : ' <span class="muted">(sem hora — vira tarefa)</span>'}`
    } catch { /* silencioso: é só a prévia */ }
  }
  campo.oninput = () => { clearTimeout(debounce); debounce = setTimeout(atualizar, 150) }
  campo.onkeydown = (e) => { if (e.key === 'Enter') $('footer .btn', bg).click() }

  // Trocar de atalho substitui o anterior em vez de empilhar em cima
  let ultimoAtalho = ''
  $$('[data-atalho]', bg).forEach((b) => {
    b.onclick = () => {
      vibrar()
      const novo = b.dataset.atalho
      let resto = campo.value
      if (ultimoAtalho && resto.startsWith(ultimoAtalho)) resto = resto.slice(ultimoAtalho.length)
      resto = resto.trim()
      ultimoAtalho = novo
      campo.value = `${novo} ${resto}`.trim() + (resto ? '' : ' ')
      $$('[data-atalho]', bg).forEach((x) => x.classList.toggle('on', x === b))
      campo.focus()
      atualizar()
    }
  })
}

// ---------- fichas (toque numa linha) ----------

function fichaPessoa(chave) {
  const p = S.pessoas.find((x) => x.key === chave)
  if (!p) return
  const cartoes_ = Object.fromEntries(S.cards.map((c) => [c.key, c.name]))
  const ultimos = p.items.slice(-12).reverse()

  const { bg, fechar } = sheet({
    titulo: p.name + (p.eu ? ' (você)' : ''),
    corpo: `
      <div class="grid g2" style="margin-bottom:14px">
        <div class="kpi ${p.eu ? '' : 'warn'}"><div class="lbl">${p.eu ? 'Minha parte (tudo)' : 'Deve'}</div><div class="val">${money(p.saldo)}</div><div class="sub">${money(p.totalItems)} lançados</div></div>
        <div class="kpi ok"><div class="lbl">${p.eu ? 'Já paguei' : 'Já pagou'}</div><div class="val">${money(p.totalPaid)}</div></div>
      </div>

      ${p.eu
        ? '<div class="banner info">🫵 Essa é você. Seus gastos não entram em "a receber" e você nunca é cobrada(o).</div>'
        : `<button class="btn full" data-copiar="/texto/pessoa?p=${encodeURIComponent(p.key)}" data-rotulo="Mensagem copiada — é só colar no WhatsApp!" style="margin-bottom:10px">📋 Copiar cobrança para mandar</button>`}

      <div class="btn-row" style="margin-bottom:16px">
        <button class="btn ${p.eu ? '' : 'ghost'}" data-f="receber">💵 ${p.eu ? 'Registrar que paguei' : 'Recebi'}</button>
        <button class="btn ghost" data-f="editar">✏️ Editar</button>
      </div>

      <button class="btn ghost full" data-f="marcar-eu" style="margin-bottom:16px">
        ${p.eu ? '🫵 Não sou eu (desmarcar)' : '🫵 Sou eu'}
      </button>

      <h3 style="font-size:13px;margin-bottom:8px">Últimos lançamentos
        <button class="btn ghost sm push" data-f="hist">📜 Ver tudo</button>
      </h3>
      <div class="rows">
        ${ultimos.length ? ultimos.map((i) => `<div class="row-item" style="cursor:default">
          <span class="grow"><span class="t1" style="font-weight:500;font-size:14px">${esc(i.note || 'sem descrição')}</span>
          <span class="t2">${dataBR(i.at)}${i.card ? ' · ' + esc(cartoes_[i.card] || i.card) : ''}${i.parcela ? ` · ${i.parcela.n}/${i.parcela.total}` : ''}</span></span>
          <b class="v">${money(i.value)}</b></div>`).join('')
          : '<div class="empty">Sem lançamentos.</div>'}
      </div>`,
  })

  ligarCopia(bg)
  $('[data-f="hist"]', bg).onclick = () => { fechar(); acoes['hist-pessoa']({ p: p.key }) }
  $('[data-f="receber"]', bg).onclick = () => { fechar(); setTimeout(() => formPagamento(p), 200) }
  $('[data-f="editar"]', bg).onclick = () => { fechar(); setTimeout(() => formPessoa(p), 200) }
  $('[data-f="marcar-eu"]', bg).onclick = async () => {
    vibrar()
    await api('/settings', { body: { eu: p.eu ? '' : p.key } })
    fechar()
    toast(p.eu ? 'Desmarcado.' : `Beleza, ${p.name} é você.`)
    render()
  }
}

/** Detalhe da SUA parte num cartão: item a item, com o total a pagar */
function detalheMinhaParte(cardKey) {
  const c = S.minhaParte.porCartao.find((x) => x.cardKey === cardKey)
  if (!c) return
  const falta = c.falta

  const { bg } = sheet({
    titulo: `Minha parte — ${c.card}`,
    corpo: `
      <div style="text-align:center;padding:2px 0 14px">
        <div class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;font-weight:700">${falta > 0.009 ? 'Eu pago nesta fatura' : 'Quitado'}</div>
        <div style="font-size:32px;font-weight:700;letter-spacing:-1.2px;margin-top:3px${falta <= 0.009 ? ';color:var(--ok)' : ''}">${money(Math.max(falta, 0))}</div>
        <div class="muted" style="font-size:12.5px;margin-top:4px">
          fatura de ${mesLongo(c.competencia)}${c.vencimento ? ` · vence ${new Date(c.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}` : ''}
        </div>
        ${c.pago ? `<div class="tag ok" style="margin-top:8px">já paguei ${money(c.pago)} de ${money(c.total)}</div>` : ''}
      </div>
      <div class="rows">
        ${c.itens.map((i) => `<div class="row-item" style="cursor:default">
          <span class="grow"><span class="t1" style="font-weight:500;font-size:14px">${esc(i.note || 'sem descrição')}</span>
          <span class="t2">${dataBR(i.at)}${i.parcela ? ` · parcela ${i.parcela.n}/${i.parcela.total}` : ''}</span></span>
          <b class="v">${money(i.value)}</b></div>`).join('')}
      </div>`,
    acoes: [{ label: '📋 Copiar', classe: 'ghost', onClick: () => {
      let t = `👤 *Minha parte — ${c.card}* (${mesLongo(c.competencia)})\n\n`
      t += c.itens.map((i) => `▸ ${dataBR(i.at)} ${money(i.value)}${i.note ? ` — ${i.note}` : ''}${i.parcela ? ` [${i.parcela.n}/${i.parcela.total}]` : ''}`).join('\n')
      t += `\n\n━━━━━━━━━━\nTotal lançado: ${money(c.total)}\n`
      if (c.pago) t += `Já paguei: ${money(c.pago)}\n`
      t += `💰 *Falta pagar: ${money(Math.max(falta, 0))}*`
      copiar(t, 'Copiado!')
    } }],
  })
  void bg
}

/** Em que fatura um gasto cairia num dado cartão — mesma regra do servidor */
function competenciaLocal(dataISO, cardKey) {
  const d = new Date(dataISO)
  const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const c = S.cards.find((x) => x.key === cardKey)
  if (!c?.fechamento || d.getDate() <= c.fechamento) return mes
  const n = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

/** Liga um grupo de chips com seleção única; devolve () => valor escolhido */
function grupoChips(bg, sel, aoTrocar) {
  const grupo = $(sel, bg)
  if (!grupo) return () => ''
  $$('.chip', grupo).forEach((c) => {
    c.onclick = () => {
      vibrar()
      $$('.chip', grupo).forEach((x) => x.classList.remove('on'))
      c.classList.add('on')
      aoTrocar?.(c.dataset.v)
    }
  })
  return () => $('.chip.on', grupo)?.dataset.v ?? ''
}

function fichaGasto(id) {
  const e = S.expenses.find((x) => x.id === id)
  if (!e) return
  const dataInput = new Date(e.at)
  const dataVal = `${dataInput.getFullYear()}-${String(dataInput.getMonth() + 1).padStart(2, '0')}-${String(dataInput.getDate()).padStart(2, '0')}`

  const { bg, fechar } = sheet({
    titulo: 'Editar lançamento',
    corpo: `
      <div class="field"><label>Valor${e.parcela ? ' da parcela' : ''}</label>
        <input id="eValor" class="valor-big" inputmode="decimal" value="${String(e.value.toFixed(2)).replace('.', ',')}"></div>

      <div class="field">
        <label>Cartão</label>
        <div class="chips" id="eCartao">
          ${S.cards.map((c) => `<button class="chip ${c.key === e.card ? 'on' : ''}" data-v="${esc(c.key)}">${esc(c.name)}</button>`).join('')}
          <button class="chip ${!e.card ? 'on' : ''}" data-v="">sem cartão</button>
        </div>
        <div class="banner info" id="eFatura" style="margin:10px 0 0"></div>
      </div>

      <div class="field">
        <label>Pessoa</label>
        <div class="chips" id="ePessoa">
          ${S.pessoas.map((p) => `<button class="chip ${p.key === e.person ? 'on' : ''}" data-v="${esc(p.key)}">${p.eu ? '🫵 ' : ''}${esc(p.name)}</button>`).join('')}
        </div>
      </div>

      <div class="field-row">
        <div class="field"><label>Data da compra</label><input id="eData" type="date" value="${dataVal}"></div>
      </div>
      <div class="field"><label>Observação</label><input id="eNota" value="${esc(e.note)}" placeholder="lanche, uber…"></div>

      ${e.parcela ? `<div class="banner warn">🔁 Parcela <b>${e.parcela.n} de ${e.parcela.total}</b>. As mudanças de cartão, pessoa e data valem para <b>todas as parcelas</b>; o valor muda só nesta.</div>` : ''}

      <button class="btn danger full" data-f="excluir">${e.parcela ? `Excluir as ${e.parcela.total} parcelas` : 'Excluir lançamento'}</button>`,
    acoes: [{
      label: 'Salvar', onClick: async ({ btn }) => {
        const valor = numeroBR($('#eValor', bg).value)
        if (!valor) return toast('Informe o valor.', 'err')
        btn.disabled = true
        try {
          await api(`/expenses/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: {
              value: valor,
              card: pegaCartao() || null,
              person: pegaPessoa(),
              at: new Date($('#eData', bg).value + 'T12:00:00').toISOString(),
              note: $('#eNota', bg).value.trim(),
            },
          })
          fechar(); toast('Lançamento atualizado.'); render({ manterScroll: true })
        } catch (err) { btn.disabled = false; toast(err.message, 'err') }
      },
    }],
  })

  const mostrarFatura = () => {
    const ck = pegaCartao()
    const comp = ck ? competenciaLocal($('#eData', bg).value + 'T12:00:00', ck) : $('#eData', bg).value.slice(0, 7)
    const c = S.cards.find((x) => x.key === ck)
    const mudou = comp !== e.competencia || ck !== (e.card || '')
    $('#eFatura', bg).innerHTML = ck
      ? `📅 Cai na fatura de <b>${mesLongo(comp)}</b>${c?.fechamento ? ` <span class="muted">(fecha dia ${c.fechamento})</span>` : ''}` +
        (mudou ? `<br><span class="muted">antes: ${mesLongo(e.competencia)}${e.card ? ' · ' + esc(S.cards.find((x) => x.key === e.card)?.name ?? e.card) : ' · sem cartão'}</span>` : '')
      : `📅 Sem cartão — fica no mês de <b>${mesLongo(comp)}</b>`
  }

  const pegaCartao = grupoChips(bg, '#eCartao', mostrarFatura)
  const pegaPessoa = grupoChips(bg, '#ePessoa')
  $('#eData', bg).onchange = mostrarFatura
  mostrarFatura()

  $('[data-f="excluir"]', bg).onclick = async () => {
    if (!await confirmar(e.parcela ? `Excluir esse lançamento e as ${e.parcela.total} parcelas?` : 'Excluir esse lançamento?', 'Excluir')) return
    await api(`/expenses/${encodeURIComponent(id)}${e.parcela ? '?grupo=1' : ''}`, { method: 'DELETE' })
    fechar(); toast('Excluído.'); render({ manterScroll: true })
  }
}

function fichaPagamento(id) {
  const p = S.payments.find((x) => x.id === id)
  if (!p) return
  const nome = S.pessoas.find((x) => x.key === p.person)?.name || p.person

  const { bg, fechar } = sheet({
    titulo: `Pagamento de ${nome}`,
    corpo: `
      <div class="field"><label>Valor recebido</label>
        <input id="pgValor" class="valor-big" inputmode="decimal" value="${String(p.value.toFixed(2)).replace('.', ',')}"></div>

      <div class="field">
        <label>Abater de qual cartão</label>
        <div class="chips" id="pgCartao">
          <button class="chip ${!p.card ? 'on' : ''}" data-v="">Geral</button>
          ${S.cards.map((c) => `<button class="chip ${c.key === p.card ? 'on' : ''}" data-v="${esc(c.key)}">${esc(c.name)}</button>`).join('')}
        </div>
        <div class="banner info" id="pgFatura" style="margin:10px 0 0"></div>
      </div>

      <div class="field"><label>Observação</label><input id="pgNota" value="${esc(p.note || '')}" placeholder="pix, dinheiro…"></div>
      <p class="muted" style="font-size:12.5px;margin-bottom:14px">Recebido em ${new Date(p.at).toLocaleDateString('pt-BR')}.</p>

      <button class="btn danger full" data-f="excluir">Excluir pagamento</button>`,
    acoes: [{
      label: 'Salvar', onClick: async ({ btn }) => {
        const valor = numeroBR($('#pgValor', bg).value)
        if (!valor) return toast('Informe o valor.', 'err')
        btn.disabled = true
        try {
          await api(`/payments/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: { value: valor, card: pegaCartao() || null, note: $('#pgNota', bg).value.trim() },
          })
          fechar(); toast('Pagamento atualizado.'); render({ manterScroll: true })
        } catch (err) { btn.disabled = false; toast(err.message, 'err') }
      },
    }],
  })

  const mostrar = (v) => {
    const ck = v ?? pegaCartao()
    const c = S.cards.find((x) => x.key === ck)
    $('#pgFatura', bg).innerHTML = c
      ? `💳 Abate da fatura atual do <b>${esc(c.name)}</b>`
      : '💰 Abate do saldo geral da pessoa, sem amarrar a um cartão'
  }
  const pegaCartao = grupoChips(bg, '#pgCartao', mostrar)
  mostrar()

  $('[data-f="excluir"]', bg).onclick = async () => {
    if (!await confirmar('Excluir esse pagamento?', 'Excluir')) return
    await api(`/payments/${encodeURIComponent(id)}`, { method: 'DELETE' })
    fechar(); toast('Excluído.'); render({ manterScroll: true })
  }
}

// ---------- formulários ----------

function formCartao(c) {
  const { bg, fechar } = sheet({
    titulo: c ? c.name : 'Novo cartão',
    corpo: `
      <div class="field"><label>Nome</label><input id="fNome" value="${esc(c?.name || '')}" placeholder="Nubank" ${c ? 'readonly' : ''}></div>
      <div class="field-row">
        <div class="field"><label>Fecha dia</label><input id="fFecha" type="number" inputmode="numeric" min="1" max="31" value="${c?.fechamento ?? ''}" placeholder="3"></div>
        <div class="field"><label>Vence dia</label><input id="fVence" type="number" inputmode="numeric" min="1" max="31" value="${c?.vencimento ?? ''}" placeholder="10"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Limite</label><input id="fLimite" inputmode="decimal" value="${c?.limite || ''}" placeholder="5000"></div>
        <div class="field" style="flex:0 0 84px"><label>Cor</label><input id="fCor" type="color" value="${esc(c?.cor || '#7c5cff')}" style="padding:4px;min-height:48px"></div>
      </div>
      <div class="banner info">Compra feita <b>depois</b> do dia de fechamento entra na fatura do mês seguinte — é assim que eu acerto a fatura sozinho.</div>
      ${c ? '<button class="btn danger full" data-f="excluir">Excluir cartão</button>' : ''}`,
    acoes: [{
      label: 'Salvar', onClick: async ({ btn }) => {
        const name = $('#fNome', bg).value.trim()
        if (!name) return toast('Informe o nome.', 'err')
        btn.disabled = true
        try {
          await api('/cards', {
            body: {
              name,
              fechamento: $('#fFecha', bg).value ? Number($('#fFecha', bg).value) : null,
              vencimento: $('#fVence', bg).value ? Number($('#fVence', bg).value) : null,
              limite: numeroBR($('#fLimite', bg).value), cor: $('#fCor', bg).value,
            },
          })
          fechar(); toast('Cartão salvo.'); render()
        } catch (e) { btn.disabled = false; toast(e.message, 'err') }
      },
    }],
  })

  $('[data-f="excluir"]', bg)?.addEventListener('click', async () => {
    if (!await confirmar(`Excluir o cartão "${c.name}"? Os gastos continuam salvos, mas ficam sem cartão.`, 'Excluir')) return
    await api(`/cards/${encodeURIComponent(c.key)}`, { method: 'DELETE' })
    fechar(); toast('Cartão excluído.'); render()
  })
}

function formPessoa(p) {
  const { bg, fechar } = sheet({
    titulo: p ? p.name : 'Nova pessoa',
    corpo: `
      <div class="field"><label>Nome</label><input id="pNome" value="${esc(p?.name || '')}" placeholder="danilo" ${p ? 'readonly' : ''}></div>
      <div class="field"><label>Telefone com DDD</label><input id="pFone" type="tel" inputmode="tel" value="${esc(p?.phone || '')}" placeholder="11999998888"></div>
      <div class="banner info">📱 Sem telefone eu não consigo mandar a cobrança automática.</div>
      ${p ? '<button class="btn danger full" data-f="excluir">Excluir pessoa e histórico</button>' : ''}`,
    acoes: [{
      label: 'Salvar', onClick: async ({ btn }) => {
        const name = $('#pNome', bg).value.trim()
        if (!name) return toast('Informe o nome.', 'err')
        btn.disabled = true
        try {
          await api('/people', { body: { name, phone: $('#pFone', bg).value.trim() } })
          fechar(); toast('Pessoa salva.'); render()
        } catch (e) { btn.disabled = false; toast(e.message, 'err') }
      },
    }],
  })

  $('[data-f="excluir"]', bg)?.addEventListener('click', async () => {
    if (!await confirmar(`Excluir "${p.name}" e TODO o histórico? Isso não tem volta.`, 'Excluir tudo')) return
    await api(`/people/${encodeURIComponent(p.key)}`, { method: 'DELETE' })
    fechar(); toast('Pessoa excluída.'); render()
  })
}

function formPagamento(p) {
  const { bg, fechar } = sheet({
    titulo: `Recebi de ${p.name}`,
    corpo: `
      <div class="field"><label>Valor recebido</label>
        <input id="rValor" class="valor-big" inputmode="decimal" value="${p.saldo > 0 ? String(p.saldo.toFixed(2)).replace('.', ',') : ''}"></div>
      <div class="chips" style="margin:-4px 0 16px">
        <button class="chip dim" data-quick="tudo">Tudo (${money(Math.max(p.saldo, 0))})</button>
        <button class="chip dim" data-quick="metade">Metade</button>
      </div>
      ${S.cards.length ? `<div class="field"><label>Abater de qual cartão</label>
        <div class="chips" id="rCartao">
          <button class="chip on" data-v="">Geral</button>
          ${S.cards.map((c) => `<button class="chip" data-v="${esc(c.key)}">${esc(c.name)}</button>`).join('')}
        </div></div>` : ''}
      <div class="field"><label>Observação</label><input id="rNota" placeholder="pix, dinheiro…"></div>`,
    acoes: [{
      label: 'Registrar', onClick: async ({ btn }) => {
        const v = numeroBR($('#rValor', bg).value)
        if (!v) return toast('Informe o valor.', 'err')
        btn.disabled = true
        try {
          const r = await api('/payments', {
            body: { person: p.key, value: v, card: $('#rCartao .chip.on', bg)?.dataset.v || null, note: $('#rNota', bg).value.trim() },
          })
          fechar(); toast(`Registrado. Saldo: ${money(r.saldo)}`); render()
        } catch (e) { btn.disabled = false; toast(e.message, 'err') }
      },
    }],
    aoAbrir: () => setTimeout(() => $('#rValor', bg).select(), 340),
  })

  $$('[data-quick]', bg).forEach((b) => {
    b.onclick = () => {
      vibrar()
      const v = b.dataset.quick === 'tudo' ? p.saldo : p.saldo / 2
      $('#rValor', bg).value = String(Math.max(v, 0).toFixed(2)).replace('.', ',')
    }
  })
  const grupo = $('#rCartao', bg)
  if (grupo) $$('.chip', grupo).forEach((c) => { c.onclick = () => { vibrar(); $$('.chip', grupo).forEach((x) => x.classList.remove('on')); c.classList.add('on') } })
}

function formLote() {
  const { bg, fechar } = sheet({
    titulo: 'Lançar em lote',
    corpo: `
      ${S.cards.length ? `<div class="field"><label>Cartão padrão</label>
        <div class="chips" id="lCartao">
          ${S.cards.map((c, i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-v="${esc(c.key)}">${esc(c.name)}</button>`).join('')}
          <button class="chip" data-v="">sem cartão</button>
        </div></div>` : ''}
      <div class="field"><label>Uma linha por gasto</label>
        <textarea id="lTexto" placeholder="22 danilo lanche&#10;35,90 maria uber&#10;300 joao 3x tenis&#10;18 ana #inter 12/07"></textarea></div>
      <div class="banner info">Ordem livre: <b>valor</b> · <b>pessoa</b> · <code>#cartao</code> · <code>3x</code> · <code>12/07</code> · o resto vira observação.</div>`,
    acoes: [{
      label: 'Conferir', onClick: async ({ btn }) => {
        const texto = $('#lTexto', bg).value
        if (!texto.trim()) return toast('Cole as linhas.', 'err')
        btn.disabled = true
        const card = $('#lCartao .chip.on', bg)?.dataset.v || null
        try {
          const r = await api('/expenses/preview', { body: { texto, card } })
          if (!r.ok.length) { btn.disabled = false; return toast('Não consegui ler nenhuma linha.', 'err') }
          fechar(); setTimeout(() => previewLote(r, texto, card), 200)
        } catch (e) { btn.disabled = false; toast(e.message, 'err') }
      },
    }],
  })

  const grupo = $('#lCartao', bg)
  if (grupo) $$('.chip', grupo).forEach((c) => { c.onclick = () => { vibrar(); $$('.chip', grupo).forEach((x) => x.classList.remove('on')); c.classList.add('on') } })
}

function previewLote(r, texto, card) {
  const total = r.ok.reduce((s, i) => s + i.value, 0)
  sheet({
    titulo: `${r.ok.length} lançamento(s)`,
    corpo: `
      <div class="kpi" style="margin-bottom:14px"><div class="lbl">Total do lote</div><div class="val">${money(total)}</div></div>
      <div class="rows">
        ${r.ok.map((i) => `<div class="row-item" style="cursor:default">
          <span class="avatar">${esc(iniciais(i.pessoa))}</span>
          <span class="grow"><span class="t1">${esc(i.pessoa)}</span>
          <span class="t2">${[i.note, i.cardName, i.parcelas > 1 ? i.parcelas + 'x' : null, dataBR(i.at)].filter(Boolean).map(esc).join(' · ')}</span></span>
          <b class="v">${money(i.value)}</b></div>`).join('')}
      </div>
      ${r.erros.length ? `<div class="banner warn" style="margin-top:14px">⚠️ Não entendi ${r.erros.length} linha(s):<br>${r.erros.map((e) => `<code>${esc(e.linha)}</code>`).join('<br>')}</div>` : ''}
      ${r.ok.some((i) => i.cardName && !i.cardExiste) ? '<div class="banner warn">⚠️ Tem cartão não cadastrado — esses vão entrar sem cartão.</div>' : ''}`,
    acoes: [{
      label: 'Gravar tudo', onClick: async ({ fechar, btn }) => {
        btn.disabled = true
        const res = await api('/expenses/lote', { body: { texto, card } })
        fechar(); toast(`${res.lancados} gravados (${res.parcelas} parcelas).`)
        TAB = 'resumo'; render()
      },
    }],
  })
}

// ---------- cobrança ----------

function formCobranca(cardKey) {
  const c = S.cards.find((x) => x.key === cardKey)
  const { bg, fechar } = sheet({
    titulo: `Cobrar — ${c.name}`,
    corpo: `
      <div class="field"><label>Fatura</label>
        <select id="cbComp">${c.competencias.map((k) => `<option value="${esc(k)}" ${k === c.fatura.competencia ? 'selected' : ''}>${mesLongo(k)}</option>`).join('')}</select></div>
      <div class="banner info">Primeiro eu <b>simulo</b> e te mostro exatamente o que cada pessoa receberia.</div>`,
    acoes: [
      {
        label: '🧪 Simular', onClick: async ({ btn }) => {
          btn.disabled = true
          const comp = $('#cbComp', bg).value
          const r = await api('/cobrar', { body: { card: cardKey, competencia: comp, real: false } })
          fechar(); setTimeout(() => resultadoCobranca(r.resultados, true, { card: cardKey, competencia: comp }), 200)
        },
      },
      {
        label: '📤 Enviar', classe: 'danger', onClick: async ({ btn }) => {
          const comp = $('#cbComp', bg).value
          if (!await confirmar('Enviar as cobranças agora no WhatsApp?', 'Enviar')) return
          btn.disabled = true
          const r = await api('/cobrar', { body: { card: cardKey, competencia: comp, real: true } })
          fechar(); setTimeout(() => resultadoCobranca(r.resultados, false), 200); render()
        },
      },
    ],
  })
}

const ROTULO = {
  enviado: '<span class="tag ok">enviado</span>',
  simulado: '<span class="tag accent">simulado</span>',
  quitado: '<span class="tag ok">quitado</span>',
  'sou-eu': '<span class="tag accent">sou eu</span>',
  'sem-telefone': '<span class="tag warn">sem telefone</span>',
  offline: '<span class="tag danger">bot offline</span>',
  'limite-diario': '<span class="tag warn">limite</span>',
  erro: '<span class="tag danger">erro</span>',
}

function resultadoCobranca(resultados, simulado, reenviar = null) {
  if (!resultados?.length) return toast('Nenhuma cobrança para enviar.')
  const acoes = simulado && reenviar ? [{
    label: '📤 Enviar de verdade', classe: 'danger',
    onClick: async ({ fechar, btn }) => {
      if (!await confirmar('Enviar essas mensagens agora no WhatsApp?', 'Enviar')) return
      btn.disabled = true
      const r = await api('/cobrar', { body: { ...reenviar, real: true } })
      fechar(); setTimeout(() => resultadoCobranca(r.resultados, false), 200); render()
    },
  }] : []

  const comTexto = resultados.filter((r) => r.texto)
  const { bg } = sheet({
    titulo: simulado ? '🧪 Simulação' : '📤 Enviado',
    corpo: `
      ${simulado ? '<div class="banner warn">Nada foi enviado — isso é só a prévia. Dá para copiar e mandar à mão.</div>' : '<div class="banner ok">Mensagens enviadas.</div>'}
      <div class="rows">
        ${resultados.map((r) => `<div class="row-item" style="cursor:default">
          <span class="avatar">${r.status === 'sou-eu' ? '🫵' : esc(iniciais(r.name))}</span>
          <span class="grow"><span class="t1">${esc(r.name)}</span><span class="t2">${money(r.valor)}</span></span>
          ${ROTULO[r.status] || esc(r.status)}</div>`).join('')}
      </div>
      ${comTexto.map((r, i) => `
        <h3 style="margin:18px 0 8px;font-size:13px">📄 Para ${esc(r.name)}
          <button class="btn ghost sm push" data-copiar="#msg${i}" data-rotulo="Mensagem copiada!">📋 Copiar</button>
        </h3>
        <div class="msg-preview" id="msg${i}">${esc(r.texto)}</div>`).join('')}`,
    acoes,
  })
  ligarCopia(bg)
}

function verFaturas(cardKey) {
  const c = S.cards.find((x) => x.key === cardKey)
  const { bg } = sheet({
    titulo: `Faturas — ${c.name}`,
    corpo: `<div class="field"><label>Competência</label>
      <select id="fvComp">${c.competencias.map((k) => `<option value="${esc(k)}">${mesLongo(k)}</option>`).join('')}</select></div>
      <div id="fvBody"></div>`,
  })

  const carregar = async () => {
    const comp = $('#fvComp', bg).value
    const f = await api(`/fatura?card=${encodeURIComponent(cardKey)}&comp=${encodeURIComponent(comp)}`)
    const nomes = Object.fromEntries(S.pessoas.map((p) => [p.key, p.name]))
    const minha = f.pessoas.find((p) => p.person === S.eu)
    $('#fvBody', bg).innerHTML = `
      <div class="grid g2" style="margin-bottom:14px">
        <div class="kpi"><div class="lbl">Total</div><div class="val">${money(f.total)}</div></div>
        <div class="kpi warn"><div class="lbl">Em aberto</div><div class="val">${money(f.aberto)}</div></div>
      </div>
      ${minha ? `<div class="banner info">🫵 Sua parte nesta fatura: <b>${money(minha.aberto)}</b></div>` : ''}
      <button class="btn ghost full" data-copiar="/texto/fatura?card=${encodeURIComponent(cardKey)}&comp=${encodeURIComponent(comp)}" data-rotulo="Resumo da fatura copiado!" style="margin-bottom:14px">📋 Copiar resumo desta fatura</button>
      <div class="rows">
        ${f.lancamentos.length ? f.lancamentos.map((i) => `<div class="row-item" style="cursor:default">
          <span class="avatar">${i.person === S.eu ? '🫵' : esc(iniciais(nomes[i.person] || i.person))}</span>
          <span class="grow"><span class="t1">${esc(nomes[i.person] || i.person)}</span>
          <span class="t2">${dataBR(i.at)}${i.note ? ' · ' + esc(i.note) : ''}${i.parcela ? ` · ${i.parcela.n}/${i.parcela.total}` : ''}</span></span>
          <b class="v">${money(i.value)}</b></div>`).join('')
          : '<div class="empty">Nenhum lançamento nesta fatura.</div>'}
      </div>`
    ligarCopia(bg)
  }
  $('#fvComp', bg).onchange = carregar
  carregar()
}

// ---------- login ----------

function telaLogin(erro = '') {
  $('#topbar').style.display = 'none'
  $('#tabbar').style.display = 'none'
  $('#fab').style.display = 'none'
  $('#main').innerHTML = `
    <div style="min-height:78dvh;display:grid;place-items:center">
      <div style="width:min(400px,100%);text-align:center">
        <div style="font-size:46px;margin-bottom:8px">💳</div>
        <h2 style="font-size:20px;font-weight:660;margin-bottom:4px">Painel Financeiro</h2>
        <p class="muted" style="font-size:14px;margin-bottom:22px">Entre com a senha do painel</p>
        ${erro ? `<div class="banner warn" style="text-align:left">⚠️ ${esc(erro)}</div>` : ''}
        <div class="field"><input id="loginSenha" type="password" placeholder="senha" autocomplete="current-password" style="text-align:center"></div>
        <button class="btn full" id="loginBtn">Entrar</button>
        <p class="muted" style="font-size:12px;margin-top:16px;line-height:1.6">A senha aparece no log do bot ao iniciar,<br>ou no comando <code>/painel</code>.</p>
      </div>
    </div>`

  const entrar = async () => {
    const v = $('#loginSenha').value.trim()
    if (!v) return
    TOKEN = v
    try {
      S = await api('/state')
      sessionStorage.setItem(CHAVE, TOKEN)
      $('#topbar').style.display = ''
      $('#tabbar').style.display = ''
      $('#fab').style.display = ''
      render()
    } catch { /* api já reexibe a tela com o erro */ }
  }
  $('#loginBtn').onclick = entrar
  $('#loginSenha').onkeydown = (e) => { if (e.key === 'Enter') entrar() }
}

// ---------- boot ----------

$$('#tabbar button').forEach((b) => { b.onclick = () => { vibrar(); TAB = b.dataset.tab; render() } })
$('#fab').onclick = () => {
  vibrar()
  if (TAB === 'agenda') return formLembrete()
  if (TAB === 'liturgia') {
    const campo = $('#litTexto')
    campo?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => campo?.focus(), 350)
    return
  }
  formGasto()
}

window.addEventListener('unhandledrejection', (e) => toast(e.reason?.message || 'Erro inesperado', 'err'))

if (!TOKEN) telaLogin()
else api('/state').then((s) => { S = s; render() }).catch(() => {})

// atualiza sozinho quando volta pro app, e a cada 60s
document.addEventListener('visibilitychange', async () => {
  if (document.hidden || !TOKEN || $('.sheet-bg')) return
  try { S = await api('/state'); render() } catch {}
})
setInterval(async () => {
  if ($('.sheet-bg') || !TOKEN || document.hidden) return
  try { S = await api('/state'); render() } catch {}
}, 60_000)
