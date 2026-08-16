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
import * as lit from '../lib/liturgia.js'
import { commands } from '../handler.js'
import { isOnline } from '../lib/wa.js'
import { parseLote } from '../lib/parseLancamento.js'
import * as fin from '../lib/finance.js'
import { donoTokenAutomatico } from '../lib/donoAuth.js'
import * as pr from '../lib/producao.js'

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

/** Corpo cru em Buffer, com limite — usado pro upload (não dá pra virar string, corromperia binário) */
function readBodyBuffer(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const pedacos = []
    let total = 0
    req.on('data', (c) => {
      total += c.length
      if (total > maxBytes) { reject(new Error('Arquivo(s) grande(s) demais para esse lote.')); req.destroy(); return }
      pedacos.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(pedacos)))
    req.on('error', reject)
  })
}

/**
 * Parser mínimo de multipart/form-data — sem dependência externa. Devolve
 * uma lista de partes: campos de texto ({name, valor}) e arquivos
 * ({name, filename, mime, data: Buffer}).
 */
function parseMultipart(buffer, boundary) {
  const partes = []
  const marcador = Buffer.from(`--${boundary}`)
  let pos = buffer.indexOf(marcador)
  if (pos === -1) return partes
  pos += marcador.length

  while (true) {
    const fim = buffer.indexOf(marcador, pos)
    if (fim === -1) break
    let trecho = buffer.subarray(pos, fim)
    if (trecho.subarray(0, 2).toString('latin1') === '\r\n') trecho = trecho.subarray(2)
    if (trecho.subarray(-2).toString('latin1') === '\r\n') trecho = trecho.subarray(0, -2)

    const fimCabecalho = trecho.indexOf('\r\n\r\n')
    if (fimCabecalho !== -1) {
      const cabecalho = trecho.subarray(0, fimCabecalho).toString('utf-8')
      const dados = trecho.subarray(fimCabecalho + 4)
      const nome = cabecalho.match(/name="([^"]*)"/)?.[1]
      const arquivo = cabecalho.match(/filename="([^"]*)"/)?.[1]
      const mime = cabecalho.match(/Content-Type:\s*([^\r\n]+)/i)?.[1]
      if (nome) partes.push({ name: nome, filename: arquivo || null, mime: mime || 'application/octet-stream', data: dados })
    }

    pos = fim + marcador.length
    if (buffer.subarray(pos, pos + 2).toString('latin1') === '--') break
  }
  return partes
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
    dono: {
      atual: fin.getSettings().donoUser || null,
      // só mostra o token quando ele é gerado automaticamente — se veio de
      // DONO_TOKEN fixo, quem entrou no painel já tem acesso ao servidor
      token: donoTokenAutomatico(),
    },
    grupos: {
      lista: grp.listarGrupos(),
      padrao: grp.raw().padrao,
      // catálogo de comandos para montar as caixinhas do painel
      comandos: [...new Set(commands.values())]
        .filter((c) => !c.dono)
        .map((c) => ({ nome: c.name, descricao: c.description, categoria: c.categoria ?? 'utilidades' }))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    },
    liturgia: {
      ativo: config.liturgia.ativo,
      horario: config.liturgia.horario,
      lembretes: config.liturgia.lembretes,
      grupos: lit.gruposDaLiturgia(),
      anotacaoHoje: lit.anotacaoDe(),
      anotacoes: lit.listarAnotacoes(30),
      sequencia: lit.sequencia(),
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
    producao: {
      ativo: config.producao.ativo,
      dashboard: pr.dashboard(),
      clientes: pr.listClientes(),
      semanaAtual: pr.semana(),
      naoPlanejados: pr.conteudosNaoPlanejados(),
      tarefasAtrasadas: pr.tarefasAtrasadas(),
      tarefasPendentes: pr.tarefasPendentes(),
      recorrencias: pr.listRecorrencias(),
      lembretes: pr.getLembretesConfig(),
      extensoesAceitas: config.producao.extensoes,
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
  const m = req.method

  // --- upload de arquivo (multipart, não é JSON — trata antes do resto) ---
  if (p === '/producao/upload' && m === 'POST') {
    const contentType = req.headers['content-type'] || ''
    const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1] ||
      contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2]
    if (!boundary) return json(res, 400, { erro: 'Envie como multipart/form-data.' })

    let buffer
    try { buffer = await readBodyBuffer(req, config.producao.maxLoteBytes) }
    catch (err) { return json(res, 413, { erro: err.message }) }

    const partes = parseMultipart(buffer, boundary)
    const clienteKey = partes.find((x) => x.name === 'cliente')?.data.toString('utf-8')
    const cliente = pr.getCliente(clienteKey)
    if (!cliente) return json(res, 400, { erro: 'Cliente não encontrado.' })

    const arquivos = partes.filter((x) => x.filename)
    if (!arquivos.length) return json(res, 400, { erro: 'Nenhum arquivo no upload.' })

    const criados = []
    const erros = []
    for (const parte of arquivos) {
      if (parte.data.length > config.producao.maxArquivoBytes) {
        erros.push(`${parte.filename}: maior que ${Math.round(config.producao.maxArquivoBytes / 1024 / 1024)} MB`)
        continue
      }
      try {
        const conteudo = await pr.addConteudo({ clienteKey: cliente.key, titulo: parte.filename.replace(/\.[^.]+$/, '') })
        const arquivo = pr.guardarArquivo(cliente.key, conteudo.num, parte.data, parte.filename, parte.mime)
        await pr.anexarArquivo(conteudo.num, arquivo)
        criados.push(conteudo.num)
      } catch (err) {
        erros.push(`${parte.filename}: ${err.message}`)
      }
    }
    return json(res, 200, { ok: true, criados: criados.length, erros, state: montarEstado() })
  }

  // --- servir o arquivo enviado (protegido pelo mesmo token do painel) ---
  if (p.startsWith('/producao/arquivo/') && m === 'GET') {
    const num = Number(decodeURIComponent(p.slice('/producao/arquivo/'.length)))
    const conteudo = pr.getConteudo(num)
    const arq = conteudo?.arquivos?.[0]
    if (!arq) return json(res, 404, { erro: 'Arquivo não encontrado.' })
    const caminho = pr.caminhoAbsoluto(arq.arquivo)
    if (!existsSync(caminho)) return json(res, 404, { erro: 'Arquivo não encontrado no disco.' })
    res.writeHead(200, { 'content-type': arq.mime || 'application/octet-stream', 'cache-control': 'private, max-age=86400' })
    return createReadStream(caminho).pipe(res)
  }

  const body = req.method === 'GET' ? {} : await readBody(req)

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

  // --- liturgia ---
  if (p === '/liturgia/grupos' && m === 'POST') {
    const lista = await lit.definirGrupos(body.grupos)
    return json(res, 200, { ok: true, grupos: lista, state: montarEstado() })
  }
  if (p === '/liturgia/anotacao' && m === 'POST') {
    const a = body.substituir
      ? await lit.substituirAnotacao(body.texto, body.data)
      : await lit.salvarAnotacao(body.texto, body.data)
    return json(res, 200, { ok: true, anotacao: a, state: montarEstado() })
  }
  if (p.startsWith('/liturgia/anotacao/') && m === 'DELETE') {
    await lit.apagarAnotacao(decodeURIComponent(p.slice(19)))
    return json(res, 200, { ok: true, state: montarEstado() })
  }
  if (p === '/liturgia/leituras' && m === 'GET') {
    const data = url.searchParams.get('data') || ag.hojeISO()
    const l = await lit.buscarLeituras(data)
    if (!l) return json(res, 502, { erro: 'Não consegui buscar a liturgia agora. A fonte pode estar fora do ar.' })
    return json(res, 200, {
      ...lit.montarEstruturado(l, data),
      partes: lit.montarPartes(l, data), // texto pronto, para o botão de copiar
      anotacao: lit.anotacaoDe(data),
    })
  }
  if (p === '/liturgia/enviar' && m === 'POST') {
    const r = await lit.rodarEnvioDiario({ forcar: true })
    return json(res, 200, { resultados: r, state: montarEstado() })
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

  // --- produção: clientes ---
  if (p === '/producao/clientes' && m === 'POST') {
    if (!body.name) return json(res, 400, { erro: 'Nome é obrigatório.' })
    const c = await pr.upsertCliente(body.name, body)
    return json(res, 200, { ok: true, cliente: c, state: montarEstado() })
  }
  if (p.startsWith('/producao/clientes/') && m === 'DELETE') {
    await pr.deleteCliente(decodeURIComponent(p.slice('/producao/clientes/'.length)))
    return json(res, 200, { ok: true, state: montarEstado() })
  }

  // --- produção: conteúdos ---
  if (p === '/producao/conteudos' && m === 'POST') {
    if (!body.clienteKey) return json(res, 400, { erro: 'Escolha um cliente.' })
    const c = await pr.addConteudo(body)
    if (!c) return json(res, 404, { erro: 'Cliente não encontrado.' })
    return json(res, 200, { ok: true, conteudo: c, state: montarEstado() })
  }
  if (p.startsWith('/producao/conteudos/') && p.endsWith('/agendar') && (m === 'PATCH' || m === 'PUT')) {
    const num = p.split('/')[3]
    const c = await pr.agendarConteudo(num, body.data, body.hora)
    if (!c) return json(res, 404, { erro: 'Conteúdo não encontrado.' })
    return json(res, 200, { ok: true, state: montarEstado() })
  }
  if (p.startsWith('/producao/conteudos/') && (m === 'PATCH' || m === 'PUT')) {
    const num = decodeURIComponent(p.slice('/producao/conteudos/'.length))
    const c = await pr.updateConteudo(num, body)
    if (!c) return json(res, 404, { erro: 'Conteúdo não encontrado.' })
    return json(res, 200, { ok: true, state: montarEstado() })
  }
  if (p.startsWith('/producao/conteudos/') && m === 'DELETE') {
    await pr.deleteConteudo(decodeURIComponent(p.slice('/producao/conteudos/'.length)))
    return json(res, 200, { ok: true, state: montarEstado() })
  }

  // --- produção: tarefas ---
  if (p === '/producao/tarefas' && m === 'POST') {
    if (!body.clienteKey) return json(res, 400, { erro: 'Escolha um cliente.' })
    const t = await pr.addTarefa(body)
    if (!t) return json(res, 404, { erro: 'Cliente não encontrado.' })
    return json(res, 200, { ok: true, tarefa: t, state: montarEstado() })
  }
  if (p.startsWith('/producao/tarefas/') && (m === 'PATCH' || m === 'PUT')) {
    const num = decodeURIComponent(p.slice('/producao/tarefas/'.length))
    const t = await pr.updateTarefa(num, body)
    if (!t) return json(res, 404, { erro: 'Tarefa não encontrada.' })
    return json(res, 200, { ok: true, state: montarEstado() })
  }
  if (p.startsWith('/producao/tarefas/') && m === 'DELETE') {
    await pr.deleteTarefa(decodeURIComponent(p.slice('/producao/tarefas/'.length)))
    return json(res, 200, { ok: true, state: montarEstado() })
  }

  // --- produção: recorrências ---
  if (p === '/producao/recorrencias' && m === 'POST') {
    if (!body.clienteKey || body.diaSemana === undefined) return json(res, 400, { erro: 'Escolha cliente e dia da semana.' })
    const r = await pr.addRecorrencia(body)
    if (!r) return json(res, 404, { erro: 'Cliente não encontrado.' })
    await pr.gerarConteudosRecorrentes()
    return json(res, 200, { ok: true, state: montarEstado() })
  }
  if (p.startsWith('/producao/recorrencias/') && m === 'DELETE') {
    await pr.removerRecorrencia(decodeURIComponent(p.slice('/producao/recorrencias/'.length)))
    return json(res, 200, { ok: true, state: montarEstado() })
  }

  // --- produção: semana e configurações ---
  if (p === '/producao/semana' && m === 'GET') {
    return json(res, 200, pr.semana(url.searchParams.get('data') || undefined))
  }
  if (p === '/producao/fechar' && m === 'POST') {
    await pr.fecharSemana(body.data)
    return json(res, 200, { ok: true, state: montarEstado() })
  }
  if (p === '/producao/lembretes' && m === 'POST') {
    await pr.setLembretesConfig(body)
    return json(res, 200, { ok: true, state: montarEstado() })
  }
  if (p === '/producao/cliente' && m === 'GET') {
    const c = pr.getCliente(url.searchParams.get('key'))
    if (!c) return json(res, 404, { erro: 'Cliente não encontrado.' })
    return json(res, 200, {
      cliente: c,
      resumo: pr.resumoCliente(c.key),
      conteudos: pr.listConteudos({ clienteKey: c.key }),
      tarefas: pr.listTarefas({ clienteKey: c.key }),
      recorrencias: pr.listRecorrencias(c.key),
    })
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
