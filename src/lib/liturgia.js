import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from '../config.js'
import { hojeISO, somarDias } from './agenda.js'
import { getSettings } from './finance.js'
import { getGrupo } from './grupos.js'
import { isOnline, sendText } from './wa.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', '..', 'data')
export const LITURGIA_FILE = path.join(DATA_DIR, 'liturgia.json')

const vazio = () => ({
  version: 1,
  grupos: [],        // para onde vão as leituras às 06:00
  anotacoes: {},     // 'YYYY-MM-DD' → { texto, em, atualizadoEm }
  enviados: {},      // 'YYYY-MM-DD' → ['leituras', 'aviso-12', ...]
  cache: {},         // 'YYYY-MM-DD' → resposta da API
})

let db = vazio()
let salvando = Promise.resolve()

export function initLiturgia() {
  mkdirSync(DATA_DIR, { recursive: true })
  if (existsSync(LITURGIA_FILE)) db = { ...vazio(), ...JSON.parse(readFileSync(LITURGIA_FILE, 'utf-8')) }
  limparCacheVelho()
  salvar()
}

function salvar() {
  const snapshot = JSON.stringify(db, null, 2)
  salvando = salvando.then(() => writeFile(LITURGIA_FILE, snapshot)).catch((e) => console.error('Erro salvando liturgia.json:', e))
  return salvando
}

/** O cache só serve para o dia; guardar mês de leitura antiga não ajuda */
function limparCacheVelho() {
  const limite = somarDias(hojeISO(), -7)
  for (const d of Object.keys(db.cache)) if (d < limite) delete db.cache[d]
  for (const d of Object.keys(db.enviados)) if (d < somarDias(hojeISO(), -30)) delete db.enviados[d]
}

export const raw = () => db

// ---------- busca ----------

const brParaISO = (br) => {
  const [d, m, a] = String(br || '').split('/')
  return a ? `${a}-${m}-${d}` : null
}

/**
 * Leituras do dia. Usa cache em disco; só bate na API uma vez por data.
 * Fonte: liturgia.up.railway.app (Liturgia Diária, dados da CNBB).
 */
export async function buscarLeituras(dataISO = hojeISO(), { forcar = false } = {}) {
  if (!forcar && db.cache[dataISO]) return db.cache[dataISO]

  const [ano, mes, dia] = dataISO.split('-')
  const url = `${config.liturgia.api}?dia=${dia}&mes=${mes}&ano=${ano}`

  let ultimoErro
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 15000)
      const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } })
      clearTimeout(t)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const dados = await res.json()
      // a API devolve a data em dd/mm/aaaa — confere para não guardar o dia errado
      const recebida = brParaISO(dados?.data)
      if (!dados?.leituras) throw new Error('resposta sem leituras')
      if (recebida && recebida !== dataISO) throw new Error(`veio ${recebida} em vez de ${dataISO}`)

      db.cache[dataISO] = dados
      limparCacheVelho()
      await salvar()
      return dados
    } catch (err) {
      ultimoErro = err
      if (tentativa < 3) await new Promise((r) => setTimeout(r, tentativa * 2000))
    }
  }
  console.error(`📖 Não consegui buscar a liturgia de ${dataISO}:`, ultimoErro?.message)
  return null
}

// ---------- montagem das mensagens ----------

const primeiro = (v) => (Array.isArray(v) ? v[0] : v) ?? null

const cabecalho = (l, dataISO) => {
  const [a, m, d] = dataISO.split('-')
  let t = `📖 *Liturgia Diária* — ${d}/${m}/${a}\n`
  if (l.liturgia) t += `\n✝️ _${l.liturgia}_`
  if (l.cor) t += `\n🎨 Cor litúrgica: *${l.cor}*`
  return t
}

/**
 * Devolve as partes já formatadas, na ordem: cabeçalho, 1ª leitura, salmo,
 * 2ª leitura (quando existe) e evangelho.
 */
export function montarPartes(l, dataISO = hojeISO()) {
  if (!l?.leituras) return []
  const partes = [cabecalho(l, dataISO)]

  const bloco = (emoji, titulo, item) => {
    if (!item?.texto) return null
    let t = `${emoji} *${titulo}*`
    if (item.referencia) t += ` — ${item.referencia}`
    if (item.titulo) t += `\n_${item.titulo}_`
    t += `\n\n${String(item.texto).trim()}`
    return t
  }

  const p1 = bloco('📕', '1ª Leitura', primeiro(l.leituras.primeiraLeitura))
  if (p1) partes.push(p1)

  const salmo = primeiro(l.leituras.salmo)
  if (salmo?.texto) {
    let t = `🎵 *Salmo Responsorial*`
    if (salmo.referencia) t += ` — ${salmo.referencia}`
    if (salmo.refrao) t += `\n\n*R.* ${String(salmo.refrao).trim()}`
    t += `\n\n${String(salmo.texto).trim()}`
    partes.push(t)
  }

  const p2 = bloco('📗', '2ª Leitura', primeiro(l.leituras.segundaLeitura))
  if (p2) partes.push(p2)

  const ev = bloco('✝️', 'Evangelho', primeiro(l.leituras.evangelho))
  if (ev) partes.push(ev)

  return partes
}

/** Tudo numa mensagem só (usado quando config.liturgia.mensagemUnica = true) */
export const montarMensagemUnica = (l, dataISO) => montarPartes(l, dataISO).join('\n\n━━━━━━━━━━\n\n')

/** Versão curta: só as referências, para o lembrete do /ld */
export function montarReferencias(l) {
  if (!l?.leituras) return ''
  const r = []
  const p1 = primeiro(l.leituras.primeiraLeitura)
  const sl = primeiro(l.leituras.salmo)
  const p2 = primeiro(l.leituras.segundaLeitura)
  const ev = primeiro(l.leituras.evangelho)
  if (p1?.referencia) r.push(`📕 ${p1.referencia}`)
  if (sl?.referencia) r.push(`🎵 ${sl.referencia}`)
  if (p2?.referencia) r.push(`📗 ${p2.referencia}`)
  if (ev?.referencia) r.push(`✝️ ${ev.referencia}`)
  return r.join('  ·  ')
}

// ---------- grupos que recebem ----------

export const gruposDaLiturgia = () => [...db.grupos]
export const recebeLiturgia = (jid) => db.grupos.includes(jid)

export async function alternarGrupo(jid, ligar = null) {
  const tem = db.grupos.includes(jid)
  const novo = ligar === null ? !tem : Boolean(ligar)
  if (novo && !tem) db.grupos.push(jid)
  if (!novo && tem) db.grupos = db.grupos.filter((g) => g !== jid)
  await salvar()
  return novo
}

export async function definirGrupos(lista) {
  db.grupos = [...new Set((lista ?? []).filter(Boolean))]
  await salvar()
  return db.grupos
}

// ---------- anotações (/ld) ----------

export const anotacaoDe = (dataISO = hojeISO()) => db.anotacoes[dataISO] ?? null

export async function salvarAnotacao(texto, dataISO = hojeISO()) {
  const t = String(texto || '').trim()
  if (!t) return null
  const atual = db.anotacoes[dataISO]
  db.anotacoes[dataISO] = atual
    ? { texto: `${atual.texto}\n\n${t}`, em: atual.em, atualizadoEm: new Date().toISOString() }
    : { texto: t, em: new Date().toISOString(), atualizadoEm: null }
  await salvar()
  return db.anotacoes[dataISO]
}

export async function substituirAnotacao(texto, dataISO = hojeISO()) {
  const t = String(texto || '').trim()
  if (!t) { delete db.anotacoes[dataISO]; await salvar(); return null }
  db.anotacoes[dataISO] = { texto: t, em: new Date().toISOString(), atualizadoEm: new Date().toISOString() }
  await salvar()
  return db.anotacoes[dataISO]
}

export async function apagarAnotacao(dataISO) {
  if (!db.anotacoes[dataISO]) return false
  delete db.anotacoes[dataISO]
  await salvar()
  return true
}

/** Últimas anotações, da mais recente para a mais antiga */
export const listarAnotacoes = (limite = 30) =>
  Object.entries(db.anotacoes)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, limite)
    .map(([data, a]) => ({ data, ...a }))

/** Dias seguidos com anotação, contando de hoje (ou de ontem) para trás */
export function sequencia() {
  const hoje = hojeISO()
  let d = db.anotacoes[hoje] ? hoje : somarDias(hoje, -1)
  let n = 0
  while (db.anotacoes[d] && n < 3650) { n++; d = somarDias(d, -1) }
  return n
}

// ---------- controle de "já enviei" ----------

const jaFez = (dataISO, marca) => (db.enviados[dataISO] ?? []).includes(marca)

async function marcarFeito(dataISO, marca) {
  db.enviados[dataISO] ??= []
  if (!db.enviados[dataISO].includes(marca)) db.enviados[dataISO].push(marca)
  await salvar()
}

// ---------- envio ----------

/** Manda as leituras do dia num chat (quebradas em partes, que lê melhor) */
export async function enviarLeituras(jid, dataISO = hojeISO(), { sock = null } = {}) {
  const l = await buscarLeituras(dataISO)
  if (!l) return { erro: 'não consegui buscar as leituras' }

  const partes = config.liturgia.mensagemUnica
    ? [montarMensagemUnica(l, dataISO)]
    : montarPartes(l, dataISO)
  if (!partes.length) return { erro: 'liturgia sem leituras' }

  for (const p of partes) {
    if (sock) await sock.sendMessage(jid, { text: p })
    else await sendText(jid, p)
    await new Promise((r) => setTimeout(r, 1200))
  }
  return { ok: true, partes: partes.length }
}

/** A rotina das 06:00 — leituras nos grupos escolhidos */
export async function rodarEnvioDiario({ dataISO = hojeISO(), forcar = false } = {}) {
  if (!db.grupos.length) return []
  if (!forcar && jaFez(dataISO, 'leituras')) return []
  if (!isOnline()) return [{ status: 'offline' }]

  const out = []
  for (const jid of db.grupos) {
    const g = getGrupo(jid)
    if (g?.silenciado) { out.push({ jid, nome: g?.nome, status: 'silenciado' }); continue }
    try {
      const r = await enviarLeituras(jid, dataISO)
      out.push({ jid, nome: g?.nome ?? jid, status: r.ok ? 'enviado' : 'erro', erro: r.erro })
    } catch (err) {
      out.push({ jid, nome: g?.nome ?? jid, status: 'erro', erro: err.message })
    }
    await new Promise((r) => setTimeout(r, 3000))
  }

  if (out.some((o) => o.status === 'enviado')) await marcarFeito(dataISO, 'leituras')
  console.log('📖 Liturgia:', out.map((o) => `${o.nome}[${o.status}]`).join(', '))
  return out
}

/** Os três toques do dia cobrando a sua anotação */
export async function rodarLembretesLd({ agora = new Date(), dataISO = hojeISO() } = {}) {
  const hhmm = agora.toTimeString().slice(0, 5)
  const alvo = config.liturgia.lembretes.find((h) => h === hhmm)
  if (!alvo) return null
  if (anotacaoDe(dataISO)) return null
  if (jaFez(dataISO, `aviso-${alvo}`)) return null

  const jid = getSettings().donoJid
  if (!jid) return null
  if (!isOnline()) return null

  const qual = config.liturgia.lembretes.indexOf(alvo)
  const titulos = [
    '🙏 *Você ainda não anotou a leitura de hoje.*',
    '🙏 *Segundo toque: a leitura de hoje continua sem anotação.*',
    '🙏 *Último aviso de hoje sobre a leitura.*',
  ]

  const l = await buscarLeituras(dataISO)
  const refs = montarReferencias(l)

  let txt = `${titulos[qual] ?? titulos[0]}\n`
  if (l?.liturgia) txt += `\n✝️ _${l.liturgia}_\n`
  if (refs) txt += `\n${refs}\n`
  txt += `\n_Mande_ \`/ld\` _seguido do que você entendeu._`
  if (qual === 2) txt += '\n_Depois das 21h eu não insisto mais — mas dá para anotar a qualquer hora._'

  await sendText(jid, txt)
  await marcarFeito(dataISO, `aviso-${alvo}`)
  console.log(`🙏 Lembrete /ld das ${alvo} enviado.`)
  return { hora: alvo, ordem: qual + 1 }
}

// ---------- agendador ----------

let tique = null

export function iniciarLiturgiaScheduler() {
  if (!config.liturgia.ativo) {
    console.log('🔕 Liturgia diária desligada (config.liturgia.ativo = false).')
    return
  }

  const checar = async () => {
    const agora = new Date()
    const hhmm = agora.toTimeString().slice(0, 5)
    try {
      if (hhmm === config.liturgia.horario) await rodarEnvioDiario()
      await rodarLembretesLd({ agora })
    } catch (e) {
      console.error('Erro na rotina da liturgia:', e.message)
    }
  }

  tique = setInterval(checar, 60_000)
  tique.unref?.()
  console.log(`📖 Liturgia diária às ${config.liturgia.horario} · lembretes do /ld às ${config.liturgia.lembretes.join(', ')}`)
}

export const pararLiturgiaScheduler = () => tique && clearInterval(tique)
