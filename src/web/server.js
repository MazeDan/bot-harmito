import http from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from '../config.js'
import { cobrar, montarMensagemPessoa, montarResumoFatura, rodarFechamentos, rodarLembretes } from '../lib/cobranca.js'
import { diasAteProximoBackup, enviarBackup, gerarCSV, snapshotDiario } from '../lib/backup.js'
import * as ag from '../lib/agenda.js'
import { montarFimDeSemana, montarResumoDia, montarSemana } from '../lib/lembretes.js'
import { parseQuando } from '../lib/parseQuando.js'
import * as grp from '../lib/grupos.js'
import { commands } from '../handler.js'
import { isOnline } from '../lib/wa.js'
import { parseLote } from '../lib/parseLancamento.js'
import * as fin from '../lib/finance.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC = path.join(__dirname, 'public')

let token = ''
let server = null

export function painelURL() {
  if (!server) return null
  if (config.web.urlPublica) return config.web.urlPublica.replace(/\/+$/, '')
  const host = config.web.host === '0.0.0.0' ? 'localhost' : config.web.host
  const porta = config.web.port === 80 ? '' : `:${config.web.port}`
  return `http://${host}${porta}`
}

/** Senha do painel — só mostrada no log/`/painel` quando é gerada automaticamente */
export const painelSenhaAutomatica = () => (config.web.token ? null : token)

// ---------- helpers ----------

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
}

const json = (res, code, body) => {
  const data = JSON.stringify(body)
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(data)
}

function tokenOk(given) {
  const a = Buffer.from(String(given || ''))
  const b = Buffer.from(token)
  return a.length === b.length && timingSafeEqual(a, b)
}

// Trava contra força bruta: N erros seguidos de um IP bloqueiam por um tempo.
const MAX_ERROS = 8
const BLOQUEIO_MS = 15 * 60_000
const tentativas = new Map()

function bloqueado(ip) {
  const t = tentativas.get(ip)
  if (!t) return false
  if (Date.now() - t.em > BLOQUEIO_MS) { tentativas.delete(ip); return false }
  return t.erros >= MAX_ERROS
}

function registrarErro(ip) {
  const t = tentativas.get(ip)
  if (!t || Date.now() - t.em > BLOQUEIO_MS) tentativas.set(ip, { erros: 1, em: Date.now() })
  else { t.erros++; t.em = Date.now() }
  console.warn(`🔒 Painel: senha errada de ${ip} (${tentativas.get(ip).erros}/${MAX_ERROS})`)
}

const ipDe = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?'

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (c) => {
      raw += c
      if (raw.length > 2_000_000) { reject(new Error('payload grande demais')); req.destroy() }
    })
    req.on('end', () => {
      if (!raw) return resolve({})
      try { resolve(JSON.parse(raw)) } catch { reject(new Error('JSON inválido')) }
    })
    req.on('error', reject)
  })
}

// ---------- estado completo para o painel ----------

function montarEstado() {
  const cards = fin.listCards().map((c) => {
    const comp = fin.competenciaAtual(c.key)
    const f = fin.faturaOf(c.key, comp)
    return { ...c, fatura: f, competencias: fin.competenciasDoCartao(c.key) }
  })

  const eu = fin.euKey()
  const pessoas = fin.allBalances().map((p) => ({ ...p, eu: p.key === eu }))
  const outros = pessoas.filter((p) => !p.eu)
  const hoje = fin.ym(new Date())
  const gastosMes = fin.raw().expenses.filter((e) => e.competencia === hoje)

  const ahoje = ag.hojeISO()

  return {
    eu,
    minhaParte: fin.minhaParte(),
    grupos: {
      lista: grp.listarGrupos(),
      padrao: grp.raw().padrao,
      // catálogo de comandos para montar as caixinhas do painel
      comandos: [...new Set(commands.values())]
        .filter((c) => !c.dono)
        .map((c) => ({ nome: c.name, descricao: c.description, categoria: c.categoria ?? 'utilidades' }))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    },
    agenda: {
      hoje: ahoje,
      dias: ag.periodo(ahoje, ag.somarDias(ahoje, 45)),
      atrasados: ag.atrasados(ahoje),
      numeros: ag.resumoNumeros(),
      recorrentes: ag.raw().itens.filter((i) => i.recorrencia),
    },
    online: isOnline(),
    cobranca: { dryRun: config.cobranca.dryRun, ativo: config.cobranca.ativo, horario: config.cobranca.horario },
    backup: {
      ativo: config.backup.ativo,
      intervaloDias: config.backup.intervaloDias,
      diasAte: diasAteProximoBackup(),
      ultimo: fin.getSettings().ultimoBackup || null,
      temDestino: Boolean(fin.getSettings().donoJid),
    },
    settings: fin.getSettings(),
    cards,
    pessoas,
    expenses: fin.raw().expenses.slice().sort((a, b) => b.at.localeCompare(a.at)),
    payments: fin.raw().payments.slice().sort((a, b) => b.at.localeCompare(a.at)),
    accounts: fin.getAccounts(),
    evolucao: fin.evolucao(12),
    futuro: fin.comprometidoFuturo(),
    resumo: {
      competencia: hoje,
      totalMes: round2(gastosMes.reduce((s, e) => s + e.value, 0)),
      // "a receber" nunca conta os seus próprios gastos
      aReceber: round2(outros.reduce((s, p) => s + Math.max(0, p.saldo), 0)),
      totalFaturas: round2(cards.reduce((s, c) => s + (c.fatura?.total || 0), 0)),
      emAberto: round2(cards.reduce((s, c) => s + (c.fatura?.aberto || 0), 0)),
      proximoVencimento: cards
        .filter((c) => c.fatura?.vencimento)
        .sort((a, b) => a.fatura.diasParaVencer - b.fatura.diasParaVencer)[0] ?? null,
    },
  }
}

const round2 = (v) => Math.round(v * 100) / 100

// ---------- rotas ----------

async function api(req, res, url) {
  const p = url.pathname.replace(/^\/api/, '')
  const body = req.method === 'GET' ? {} : await readBody(req)
  const m = req.method

  if (p === '/state' && m === 'GET') return json(res, 200, montarEstado())

  // --- cartões ---
  if (p === '/cards' && m === 'POST') {
    if (!body.name) return json(res, 400, { erro: 'Nome do cartão é obrigatório.' })
    const c = await fin.upsertCard(body.name, body)
    return json(res, 200, { ok: true, card: c, state: montarEstado() })
  }
  if (p.startsWith('/cards/') && m === 'DELETE') {
    await fin.deleteCard(decodeURIComponent(p.slice(7)))
    return json(res, 200, { ok: true, state: montarEstado() })
  }

  // --- pessoas ---
  if (p === '/people' && m === 'POST') {
    if (!body.name) return json(res, 400, { erro: 'Nome é obrigatório.' })
    const pe = await fin.upsertPerson(body.name, { phone: body.phone, apelido: body.apelido })
    return json(res, 200, { ok: true, pessoa: pe, state: montarEstado() })
  }
  if (p.startsWith('/people/') && m === 'DELETE') {
    await fin.deletePerson(decodeURIComponent(p.slice(8)))
    return json(res, 200, { ok: true, state: montarEstado() })
  }

  // --- gastos ---
  if (p === '/expenses' && m === 'POST') {
    if (!body.person || !body.value) return json(res, 400, { erro: 'Informe pessoa e valor.' })
    const criados = await fin.addExpense(body)
    return json(res, 200, { ok: true, criados, state: montarEstado() })
  }
  if (p === '/expenses/preview' && m === 'POST') {
    const r = parseLote(body.texto || '', { cartaoPadrao: body.card || null })
    return json(res, 200, {
      ...r,
      ok: r.ok.map((i) => ({ ...i, cardName: i.card ? (fin.getCard(i.card)?.name ?? i.card) : null, cardExiste: Boolean(fin.getCard(i.card)) })),
    })
  }
  if (p === '/expenses/lote' && m === 'POST') {
    const r = parseLote(body.texto || '', { cartaoPadrao: body.card || null })
    const criados = []
    for (const it of r.ok) {
      const c = await fin.addExpense({ ...it, person: it.pessoa })
      if (c) criados.push(...c)
    }
    return json(res, 200, { ok: true, lancados: r.ok.length, parcelas: criados.length, erros: r.erros, state: montarEstado() })
  }
  if (p.startsWith('/expenses/') && (m === 'PATCH' || m === 'PUT')) {
    const id = decodeURIComponent(p.slice(10))
    const r = await fin.updateExpense(id, body, { grupo: body.grupo !== false })
    if (!r) return json(res, 404, { erro: 'Lançamento não encontrado.' })
    return json(res, 200, { ok: true, atualizados: r.length, state: montarEstado() })
  }
  if (p.startsWith('/expenses/') && m === 'DELETE') {
    const id = decodeURIComponent(p.slice(10))
    await fin.deleteExpense(id, { grupo: url.searchParams.get('grupo') === '1' })
    return json(res, 200, { ok: true, state: montarEstado() })
  }

  // --- pagamentos ---
  if (p === '/payments' && m === 'POST') {
    if (!body.person || !body.value) return json(res, 400, { erro: 'Informe pessoa e valor.' })
    const b = await fin.addPayment(body.person, body.value, { card: body.card, competencia: body.competencia, note: body.note })
    if (!b) return json(res, 404, { erro: 'Pessoa não encontrada.' })
    return json(res, 200, { ok: true, saldo: b.saldo, state: montarEstado() })
  }
  if (p.startsWith('/payments/') && (m === 'PATCH' || m === 'PUT')) {
    const r = await fin.updatePayment(decodeURIComponent(p.slice(10)), body)
    if (!r) return json(res, 404, { erro: 'Pagamento não encontrado.' })
    return json(res, 200, { ok: true, pagamento: r, state: montarEstado() })
  }
  if (p.startsWith('/payments/') && m === 'DELETE') {
    await fin.deletePayment(decodeURIComponent(p.slice(10)))
    return json(res, 200, { ok: true, state: montarEstado() })
  }

  // --- fatura específica ---
  if (p === '/fatura' && m === 'GET') {
    const f = fin.faturaOf(url.searchParams.get('card'), url.searchParams.get('comp'))
    if (!f) return json(res, 404, { erro: 'Cartão não encontrado.' })
    return json(res, 200, f)
  }

  // --- cobrança ---
  if (p === '/cobrar' && m === 'POST') {
    const r = await cobrar(body.card, { competencia: body.competencia || null, dryRun: body.real !== true, apenas: body.person || null })
    if (r.erro) return json(res, 400, r)
    return json(res, 200, { ...r, state: montarEstado() })
  }
  if (p === '/lembretes' && m === 'POST') {
    const r = await rodarLembretes({ dryRun: body.real !== true })
    return json(res, 200, { resultados: r, state: montarEstado() })
  }

  // --- extratos bancários ---
  if (p.startsWith('/accounts/') && m === 'DELETE') {
    await fin.deleteAccount(decodeURIComponent(p.slice(10)))
    return json(res, 200, { ok: true, state: montarEstado() })
  }

  // --- grupos ---
  if (p.startsWith('/grupos/') && (m === 'PATCH' || m === 'PUT')) {
    const jid = decodeURIComponent(p.slice(8))
    const g = await grp.atualizarGrupo(jid, body)
    if (!g) return json(res, 404, { erro: 'Grupo não encontrado.' })
    return json(res, 200, { ok: true, grupo: g, state: montarEstado() })
  }
  if (p.startsWith('/grupos/') && m === 'DELETE') {
    await grp.removerGrupo(decodeURIComponent(p.slice(8)))
    return json(res, 200, { ok: true, state: montarEstado() })
  }
  if (p === '/grupos/padrao' && m === 'POST') {
    await grp.setPadrao(body)
    return json(res, 200, { ok: true, state: montarEstado() })
  }

  // --- agenda ---
  if (p === '/agenda' && m === 'POST') {
    // aceita a frase solta ("amanhã 9h dentista") ou os campos já separados
    let dados = body
    if (body.frase) {
      const r = parseQuando(body.frase)
      if (r.erro) return json(res, 400, { erro: r.erro === 'sem descrição' ? 'Faltou dizer o quê.' : 'Não entendi o quando.' })
      dados = r
    }
    if (!dados.texto) return json(res, 400, { erro: 'Faltou o texto.' })
    const item = await ag.adicionar(dados)
    return json(res, 200, { ok: true, item, state: montarEstado() })
  }

  if (p === '/agenda/preview' && m === 'POST') {
    const r = parseQuando(body.frase || '')
    return json(res, 200, r)
  }

  if (p === '/agenda/resumos' && m === 'GET') {
    return json(res, 200, {
      dia: montarResumoDia(),
      semana: montarSemana(),
      fimDeSemana: montarFimDeSemana(),
    })
  }

  if (p.startsWith('/agenda/') && (m === 'PATCH' || m === 'PUT')) {
    const num = Number(decodeURIComponent(p.slice(8)))
    if (body.feito !== undefined) {
      const i = await ag.marcarFeito(num, body.feito, body.data || null)
      if (!i) return json(res, 404, { erro: 'Item não encontrado.' })
    }
    const campos = ['texto', 'data', 'hora', 'recorrencia']
    if (campos.some((c) => body[c] !== undefined)) {
      const i = await ag.editar(num, body)
      if (!i) return json(res, 404, { erro: 'Item não encontrado.' })
    }
    return json(res, 200, { ok: true, state: montarEstado() })
  }

  if (p.startsWith('/agenda/') && m === 'DELETE') {
    await ag.remover(Number(decodeURIComponent(p.slice(8))))
    return json(res, 200, { ok: true, state: montarEstado() })
  }

  // --- backup e fechamento ---
  if (p === '/backup' && m === 'POST') {
    await snapshotDiario()
    const r = await enviarBackup({ forcado: true })
    if (r.erro) return json(res, 400, r)
    return json(res, 200, { ...r, state: montarEstado() })
  }
  if (p === '/export.csv' && m === 'GET') {
    const csv = gerarCSV()
    res.writeHead(200, {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="financeiro-${new Date().toISOString().slice(0, 10)}.csv"`,
    })
    return res.end(csv)
  }
  if (p === '/fechamento' && m === 'POST') {
    const r = await rodarFechamentos({ forcarCartao: fin.key(body.card) })
    if (!r.length) return json(res, 400, { erro: 'Esse cartão não tem dia de fechamento cadastrado.' })
    return json(res, 200, { resultado: r[0], state: montarEstado() })
  }

  // --- textos prontos para copiar ---
  if (p === '/texto/pessoa' && m === 'GET') {
    const texto = montarMensagemPessoa(url.searchParams.get('p'))
    if (!texto) return json(res, 404, { erro: 'Pessoa não encontrada.' })
    return json(res, 200, { texto })
  }
  if (p === '/texto/fatura' && m === 'GET') {
    const texto = montarResumoFatura(url.searchParams.get('card'), url.searchParams.get('comp'))
    if (!texto) return json(res, 404, { erro: 'Cartão não encontrado.' })
    return json(res, 200, { texto })
  }

  // --- configurações ---
  if (p === '/settings' && m === 'POST') {
    const patch = {}
    if (body.pix !== undefined) patch.pix = body.pix
    if (body.pixNome !== undefined) patch.pixNome = body.pixNome
    if (body.eu !== undefined) patch.eu = body.eu
    const s = await fin.setSettings(patch)
    return json(res, 200, { ok: true, settings: s, state: montarEstado() })
  }

  return json(res, 404, { erro: 'Rota não encontrada.' })
}

function servirEstatico(res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  const file = path.join(PUBLIC, rel)
  if (!file.startsWith(PUBLIC) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    return res.end('Não encontrado')
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
  createReadStream(file).pipe(res)
}

// ---------- boot ----------

export function iniciarPainel() {
  if (!config.web.ativo) return null
  token = config.web.token || randomBytes(12).toString('hex')

  server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    const ip = ipDe(req)

    // Healthcheck do proxy da hospedagem — responde sem exigir senha
    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'text/plain' })
      return res.end('ok')
    }

    // A página em si é pública (é só a casca); os dados é que são protegidos.
    if (!url.pathname.startsWith('/api')) {
      try { return servirEstatico(res, url.pathname) } catch (err) {
        console.error('Erro servindo arquivo:', err)
        res.writeHead(500); return res.end()
      }
    }

    if (bloqueado(ip)) {
      return json(res, 429, { erro: 'Muitas tentativas erradas. Tente de novo em 15 minutos.' })
    }

    // Senha no header (preferido) ou na query, para compatibilidade
    const dado = req.headers['x-token'] || url.searchParams.get('t')
    if (!tokenOk(dado)) {
      registrarErro(ip)
      return json(res, 401, { erro: 'Senha inválida.' })
    }
    tentativas.delete(ip)

    try {
      return await api(req, res, url)
    } catch (err) {
      console.error('Erro no painel:', err)
      return json(res, 500, { erro: err.message })
    }
  })

  server.listen(config.web.port, config.web.host, () => {
    console.log(`🖥️  Painel financeiro: ${painelURL()}`)
    if (!config.web.token) {
      console.log(`   🔑 Senha desta sessão: ${token}`)
      console.log('   (defina PAINEL_TOKEN no ambiente para uma senha fixa)')
    }
  })

  server.on('error', (err) => {
    console.error(`❌ Painel não subiu na porta ${config.web.port}: ${err.message}`)
    server = null
  })

  return server
}
