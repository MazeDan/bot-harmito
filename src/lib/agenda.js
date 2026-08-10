import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', '..', 'data')
export const AGENDA_FILE = path.join(DATA_DIR, 'agenda.json')

const vazio = () => ({ version: 1, proximoNum: 1, itens: [] })

let db = vazio()
let salvando = Promise.resolve()

// ---------- datas (sempre no fuso local) ----------

export const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const hojeISO = () => iso(new Date())
export const somarDias = (dataISO, n) => {
  const [y, m, d] = dataISO.split('-').map(Number)
  return iso(new Date(y, m - 1, d + n))
}
export const diaDaSemana = (dataISO) => {
  const [y, m, d] = dataISO.split('-').map(Number)
  return new Date(y, m - 1, d).getDay() // 0 = domingo
}
const diaDoMes = (dataISO) => Number(dataISO.split('-')[2])

export const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "2026-08-11" → "seg, 11/ago" · hoje e amanhã viram nome */
export function rotuloData(dataISO, { curto = false } = {}) {
  const hoje = hojeISO()
  if (dataISO === hoje) return 'Hoje'
  if (dataISO === somarDias(hoje, 1)) return 'Amanhã'
  if (dataISO === somarDias(hoje, -1)) return 'Ontem'
  const [, m, d] = dataISO.split('-')
  const nome = DIAS[diaDaSemana(dataISO)].slice(0, 3)
  return curto ? `${d}/${MESES[Number(m) - 1]}` : `${nome}, ${d}/${MESES[Number(m) - 1]}`
}

// ---------- persistência ----------

export function initAgenda() {
  mkdirSync(DATA_DIR, { recursive: true })
  if (existsSync(AGENDA_FILE)) {
    const bruto = JSON.parse(readFileSync(AGENDA_FILE, 'utf-8'))
    db = { ...vazio(), ...bruto }
  }
  salvar()
}

function salvar() {
  const snapshot = JSON.stringify(db, null, 2)
  salvando = salvando.then(() => writeFile(AGENDA_FILE, snapshot)).catch((e) => console.error('Erro salvando agenda.json:', e))
  return salvando
}

export const raw = () => db

// ---------- CRUD ----------

/**
 * Cria um item da agenda.
 * - com `hora`  → compromisso: dispara aviso na hora marcada
 * - sem `hora`  → tarefa: só aparece no resumo do dia
 * - com `recorrencia` → se repete ({ tipo: 'diaria'|'uteis'|'semanal'|'mensal', dia })
 */
export async function adicionar({ texto, data = null, hora = null, recorrencia = null }) {
  const t = String(texto || '').trim()
  if (!t) return null

  const item = {
    num: db.proximoNum++,
    texto: t,
    data: recorrencia ? null : (data || hojeISO()),
    hora: hora || null,
    recorrencia,
    feito: false,
    feitoEm: null,
    ultimoAviso: null,
    criadoEm: new Date().toISOString(),
  }
  db.itens.push(item)
  await salvar()
  return item
}

export const buscar = (num) => db.itens.find((i) => i.num === Number(num)) ?? null

export async function remover(num) {
  const antes = db.itens.length
  db.itens = db.itens.filter((i) => i.num !== Number(num))
  if (db.itens.length === antes) return false
  await salvar()
  return true
}

/** Marca como feito. Em item recorrente, marca só a ocorrência do dia. */
export async function marcarFeito(num, feito = true, dataISO = null) {
  const i = buscar(num)
  if (!i) return null
  if (i.recorrencia) {
    i.feitosEm ??= []
    const d = dataISO || hojeISO()
    if (feito) { if (!i.feitosEm.includes(d)) i.feitosEm.push(d) }
    else i.feitosEm = i.feitosEm.filter((x) => x !== d)
  } else {
    i.feito = feito
    i.feitoEm = feito ? new Date().toISOString() : null
  }
  await salvar()
  return i
}

export async function editar(num, patch = {}) {
  const i = buscar(num)
  if (!i) return null
  for (const campo of ['texto', 'data', 'hora', 'recorrencia']) {
    if (patch[campo] !== undefined) i[campo] = patch[campo] || null
  }
  if (patch.texto) i.texto = String(patch.texto).trim()
  if (i.recorrencia) i.data = null
  else if (!i.data) i.data = hojeISO()
  await salvar()
  return i
}

/** Apaga tarefas avulsas já concluídas há mais de N dias */
export async function limparConcluidos(dias = 30) {
  const limite = somarDias(hojeISO(), -dias)
  const antes = db.itens.length
  db.itens = db.itens.filter((i) => !(i.feito && i.data && i.data < limite))
  if (db.itens.length !== antes) await salvar()
  return antes - db.itens.length
}

// ---------- recorrência ----------

/** O item recorrente acontece nesse dia? */
export function ocorreEm(item, dataISO) {
  const r = item.recorrencia
  if (!r) return item.data === dataISO
  const dow = diaDaSemana(dataISO)
  if (r.tipo === 'diaria') return true
  if (r.tipo === 'uteis') return dow >= 1 && dow <= 5
  if (r.tipo === 'semanal') return dow === Number(r.dia)
  if (r.tipo === 'mensal') return diaDoMes(dataISO) === Number(r.dia)
  return false
}

export const estaFeito = (item, dataISO) =>
  item.recorrencia ? (item.feitosEm ?? []).includes(dataISO) : Boolean(item.feito)

/**
 * Tudo que acontece num dia, já ordenado: com hora primeiro (na ordem do
 * relógio), depois as tarefas sem hora.
 */
export function doDia(dataISO = hojeISO()) {
  return db.itens
    .filter((i) => ocorreEm(i, dataISO))
    .map((i) => ({ ...i, data: dataISO, feito: estaFeito(i, dataISO) }))
    .sort((a, b) => (a.hora ?? '99:99').localeCompare(b.hora ?? '99:99') || a.num - b.num)
}

/** Dias de `de` até `ate` (inclusive), só os que têm algo */
export function periodo(de, ate) {
  const out = []
  let d = de
  let guarda = 0
  while (d <= ate && guarda++ < 400) {
    const itens = doDia(d)
    if (itens.length) out.push({ data: d, itens })
    d = somarDias(d, 1)
  }
  return out
}

/** Tarefas de dias passados que ficaram sem marcar como feitas */
export function atrasados(dataISO = hojeISO(), limiteDias = 30) {
  return db.itens
    .filter((i) => !i.recorrencia && !i.feito && i.data && i.data < dataISO && i.data >= somarDias(dataISO, -limiteDias))
    .sort((a, b) => a.data.localeCompare(b.data))
}

/** Próximos N itens a partir de agora (para /lembretes) */
export function proximos(quantidade = 15, dias = 60) {
  const hoje = hojeISO()
  const agora = new Date().toTimeString().slice(0, 5)
  const out = []
  for (const { data, itens } of periodo(hoje, somarDias(hoje, dias))) {
    for (const i of itens) {
      if (i.feito) continue
      if (data === hoje && i.hora && i.hora < agora) continue
      out.push(i)
      if (out.length >= quantidade) return out
    }
  }
  return out
}

/**
 * Compromissos com hora que já venceram e ainda não foram avisados.
 * A janela evita disparar avisos antigos se o bot ficou fora do ar.
 */
export function devidos({ agora = new Date(), janelaMin = 30 } = {}) {
  const hoje = iso(agora)
  const hhmm = agora.toTimeString().slice(0, 5)
  const limite = new Date(agora.getTime() - janelaMin * 60000).toTimeString().slice(0, 5)

  return db.itens.filter((i) => {
    if (!i.hora || !ocorreEm(i, hoje)) return false
    if (estaFeito(i, hoje)) return false
    if (i.hora > hhmm || i.hora < limite) return false
    return i.ultimoAviso !== `${hoje}T${i.hora}`
  })
}

export async function marcarAvisado(item, dataISO = hojeISO()) {
  const i = buscar(item.num)
  if (!i) return
  i.ultimoAviso = `${dataISO}T${i.hora}`
  await salvar()
}

// ---------- estatísticas para o painel ----------

export function resumoNumeros() {
  const hoje = hojeISO()
  const doDiaHoje = doDia(hoje)
  return {
    hoje: doDiaHoje.length,
    pendentesHoje: doDiaHoje.filter((i) => !i.feito).length,
    atrasados: atrasados(hoje).length,
    total: db.itens.length,
  }
}
