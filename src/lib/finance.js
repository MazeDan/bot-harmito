import { existsSync, mkdirSync, readFileSync, copyFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', '..', 'data')
const FILE = path.join(DATA_DIR, 'finance.json')

const empty = () => ({
  version: 2,
  cards: {},
  people: {},
  expenses: [],
  payments: [],
  accounts: {},
  reminders: [],
  // `eu` = chave da pessoa que é o dono do cartão (você). Os gastos dela não
  // entram em "a receber" e ela nunca é cobrada.
  settings: { pix: '', pixNome: '', eu: '' },
})

let db = empty()
let saving = Promise.resolve()

export const money = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`
export const key = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const num = (v) => Number(String(v ?? '').replace(',', '.')) || 0
const id = () => randomUUID()

/** 'YYYY-MM' do mês de uma data */
export const ym = (d) => {
  const dt = d instanceof Date ? d : new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
}

/** Soma n meses a uma competência 'YYYY-MM' */
export function addMonths(comp, n) {
  const [y, m] = comp.split('-').map(Number)
  const dt = new Date(y, m - 1 + n, 1)
  return ym(dt)
}

// ---------- persistência ----------

export function initFinance() {
  mkdirSync(DATA_DIR, { recursive: true })
  if (existsSync(FILE)) {
    const raw = JSON.parse(readFileSync(FILE, 'utf-8'))
    db = migrate(raw)
  }
  save()
}

/** Converte o formato v1 (people com items/payments embutidos) para o v2 */
function migrate(raw) {
  if (raw.version === 2) {
    const d = { ...empty(), ...raw }
    d.settings = { ...empty().settings, ...(raw.settings || {}) }
    return d
  }

  // backup antes de mexer
  try { copyFileSync(FILE, FILE.replace(/\.json$/, `.v1.bak.json`)) } catch {}

  const d = empty()
  d.accounts = raw.accounts || {}
  for (const [k, p] of Object.entries(raw.people || {})) {
    d.people[k] = { key: k, name: p.name || k, phone: '', jid: '' }
    for (const i of p.items || []) {
      d.expenses.push({
        id: id(), person: k, card: null, value: num(i.value), note: i.note || '',
        at: i.at || new Date().toISOString(), competencia: ym(i.at || new Date()), parcela: null,
      })
    }
    for (const pg of p.payments || []) {
      d.payments.push({ id: id(), person: k, card: null, competencia: null, value: num(pg.value), at: pg.at || new Date().toISOString(), note: '' })
    }
  }
  console.log(`🔄 Base financeira migrada para v2 (${d.expenses.length} gastos, ${d.payments.length} pagamentos).`)
  return d
}

function save() {
  const snapshot = JSON.stringify(db, null, 2)
  saving = saving.then(() => writeFile(FILE, snapshot)).catch((e) => console.error('Erro salvando finance.json:', e))
  return saving
}

export const raw = () => db

// ---------- cartões ----------

/** Cria ou atualiza um cartão. fechamento/vencimento são dias do mês (1-31). */
export async function upsertCard(name, { fechamento, vencimento, limite, cor } = {}) {
  const k = key(name)
  if (!k) return null
  const c = (db.cards[k] ??= { key: k, name: String(name).trim(), fechamento: null, vencimento: null, limite: 0, cor: '' })
  c.name = String(name).trim()
  if (fechamento !== undefined) c.fechamento = fechamento === null ? null : Math.min(31, Math.max(1, Number(fechamento)))
  if (vencimento !== undefined) c.vencimento = vencimento === null ? null : Math.min(31, Math.max(1, Number(vencimento)))
  if (limite !== undefined) c.limite = num(limite)
  if (cor !== undefined) c.cor = cor || ''
  await save()
  return c
}

export async function deleteCard(name) {
  const k = key(name)
  if (!db.cards[k]) return false
  delete db.cards[k]
  for (const e of db.expenses) if (e.card === k) e.card = null
  await save()
  return true
}

export const getCard = (name) => db.cards[key(name)] || null
export const listCards = () => Object.values(db.cards).sort((a, b) => a.name.localeCompare(b.name))

/** Em que fatura ('YYYY-MM') cai um gasto feito nessa data nesse cartão */
export function competenciaFor(dateISO, cardKey) {
  const dt = dateISO instanceof Date ? dateISO : new Date(dateISO)
  const card = db.cards[key(cardKey)]
  if (!card?.fechamento) return ym(dt)
  // comprou depois do fechamento → entra na fatura do mês seguinte
  return dt.getDate() > card.fechamento ? addMonths(ym(dt), 1) : ym(dt)
}

/** Data real de vencimento (Date) da fatura de competência `comp` */
export function vencimentoDate(cardKey, comp) {
  const card = db.cards[key(cardKey)]
  if (!card?.vencimento) return null
  const [y, m] = comp.split('-').map(Number)
  const ultimoDia = new Date(y, m, 0).getDate()
  return new Date(y, m - 1, Math.min(card.vencimento, ultimoDia))
}

/** Competência da fatura "atual" (a próxima a vencer) do cartão */
export function competenciaAtual(cardKey, hoje = new Date()) {
  const card = db.cards[key(cardKey)]
  if (!card) return ym(hoje)
  const comp = ym(hoje)
  const venc = vencimentoDate(cardKey, comp)
  if (venc && hoje > venc) return addMonths(comp, 1)
  return comp
}

// ---------- pessoas ----------

export async function upsertPerson(name, { phone, apelido } = {}) {
  const k = key(name)
  if (!k) return null
  const p = (db.people[k] ??= { key: k, name: String(name).trim(), phone: '', jid: '' })
  if (apelido) p.name = String(apelido).trim()
  if (phone !== undefined) {
    const digits = String(phone || '').replace(/\D/g, '')
    p.phone = digits
    p.jid = digits ? `${digits.length <= 11 ? '55' + digits : digits}@s.whatsapp.net` : ''
  }
  await save()
  return p
}

export async function deletePerson(name) {
  const k = key(name)
  if (!db.people[k]) return false
  delete db.people[k]
  db.expenses = db.expenses.filter((e) => e.person !== k)
  db.payments = db.payments.filter((p) => p.person !== k)
  await save()
  return true
}

export const getPerson = (name) => db.people[key(name)] || null
export const listPeople = () => Object.values(db.people).sort((a, b) => a.name.localeCompare(b.name))

// ---------- gastos ----------

/**
 * Lança um gasto. Se `parcelas` > 1, cria N lançamentos em competências seguidas
 * (o valor informado é o TOTAL; cada parcela recebe total/N).
 * Retorna a lista de lançamentos criados.
 */
export async function addExpense({ person, value, card = null, note = '', at = null, parcelas = 1, valorPorParcela = false }) {
  const pk = key(person)
  if (!pk) return null
  await upsertPerson(person)

  const ck = card ? key(card) : null
  const dt = at ? new Date(at) : new Date()
  const n = Math.max(1, Math.min(60, Number(parcelas) || 1))
  const total = num(value)
  const each = valorPorParcela ? total : total / n
  const base = ck ? competenciaFor(dt, ck) : ym(dt)
  const grupo = n > 1 ? id() : null

  const created = []
  for (let i = 0; i < n; i++) {
    const e = {
      id: id(),
      person: pk,
      card: ck,
      value: Math.round(each * 100) / 100,
      note: String(note || '').trim(),
      at: dt.toISOString(),
      competencia: addMonths(base, i),
      parcela: n > 1 ? { n: i + 1, total: n, grupo } : null,
    }
    db.expenses.push(e)
    created.push(e)
  }
  await save()
  return created
}

export async function deleteExpense(expenseId, { grupo = false } = {}) {
  const e = db.expenses.find((x) => x.id === expenseId)
  if (!e) return false
  if (grupo && e.parcela?.grupo) db.expenses = db.expenses.filter((x) => x.parcela?.grupo !== e.parcela.grupo)
  else db.expenses = db.expenses.filter((x) => x.id !== expenseId)
  await save()
  return true
}

/** Remove o último gasto lançado (opcionalmente de uma pessoa) */
export async function undoLast(person = null) {
  const pk = person ? key(person) : null
  for (let i = db.expenses.length - 1; i >= 0; i--) {
    if (!pk || db.expenses[i].person === pk) {
      const [removed] = db.expenses.splice(i, 1)
      if (removed.parcela?.grupo) db.expenses = db.expenses.filter((x) => x.parcela?.grupo !== removed.parcela.grupo)
      await save()
      return removed
    }
  }
  return null
}

// ---------- pagamentos ----------

export async function addPayment(person, value, { card = null, competencia = null, note = '' } = {}) {
  const pk = key(person)
  if (!db.people[pk]) return null
  const ck = card ? key(card) : null
  const p = {
    id: id(), person: pk, card: ck,
    competencia: competencia || (ck ? competenciaAtual(ck) : null),
    value: num(value), at: new Date().toISOString(), note: String(note || '').trim(),
  }
  db.payments.push(p)
  await save()
  return balanceOf(pk)
}

export async function deletePayment(paymentId) {
  const before = db.payments.length
  db.payments = db.payments.filter((p) => p.id !== paymentId)
  if (db.payments.length === before) return false
  await save()
  return true
}

// ---------- consultas ----------

export function balanceOf(person) {
  const k = key(person)
  const p = db.people[k]
  if (!p) return null
  const items = db.expenses.filter((e) => e.person === k).sort((a, b) => a.at.localeCompare(b.at))
  const payments = db.payments.filter((x) => x.person === k).sort((a, b) => a.at.localeCompare(b.at))
  const totalItems = items.reduce((s, i) => s + i.value, 0)
  const totalPaid = payments.reduce((s, i) => s + i.value, 0)
  return {
    key: k, name: p.name, phone: p.phone, jid: p.jid,
    items, payments, totalItems, totalPaid,
    saldo: Math.round((totalItems - totalPaid) * 100) / 100,
  }
}

export function allBalances() {
  return Object.keys(db.people).map((k) => balanceOf(k)).filter(Boolean).sort((a, b) => b.saldo - a.saldo)
}

/**
 * Fatura de um cartão numa competência, quebrada por pessoa.
 */
export function faturaOf(cardName, comp = null) {
  const ck = key(cardName)
  const card = db.cards[ck]
  if (!card) return null
  const competencia = comp || competenciaAtual(ck)
  const gastos = db.expenses.filter((e) => e.card === ck && e.competencia === competencia)
  const pagos = db.payments.filter((p) => p.card === ck && p.competencia === competencia)

  const porPessoa = new Map()
  for (const e of gastos) {
    const cur = porPessoa.get(e.person) ?? { person: e.person, name: db.people[e.person]?.name ?? e.person, total: 0, pago: 0, items: [] }
    cur.total += e.value
    cur.items.push(e)
    porPessoa.set(e.person, cur)
  }
  for (const p of pagos) {
    const cur = porPessoa.get(p.person) ?? { person: p.person, name: db.people[p.person]?.name ?? p.person, total: 0, pago: 0, items: [] }
    cur.pago += p.value
    porPessoa.set(p.person, cur)
  }

  const pessoas = [...porPessoa.values()]
    .map((x) => ({ ...x, total: r2(x.total), pago: r2(x.pago), aberto: r2(x.total - x.pago) }))
    .sort((a, b) => b.aberto - a.aberto)

  const venc = vencimentoDate(ck, competencia)
  return {
    card: card.name, cardKey: ck, competencia,
    total: r2(gastos.reduce((s, e) => s + e.value, 0)),
    pago: r2(pagos.reduce((s, p) => s + p.value, 0)),
    aberto: r2(gastos.reduce((s, e) => s + e.value, 0) - pagos.reduce((s, p) => s + p.value, 0)),
    vencimento: venc ? venc.toISOString().slice(0, 10) : null,
    diasParaVencer: venc ? Math.ceil((venc - startOfDay(new Date())) / 86400000) : null,
    limite: card.limite || 0,
    pessoas,
    lancamentos: gastos.sort((a, b) => a.at.localeCompare(b.at)),
  }
}

/** Competências que têm algum lançamento nesse cartão (mais recente primeiro) */
export function competenciasDoCartao(cardName) {
  const ck = key(cardName)
  const set = new Set(db.expenses.filter((e) => e.card === ck).map((e) => e.competencia))
  set.add(competenciaAtual(ck))
  return [...set].sort().reverse()
}

/** Total gasto por competência somando todos os cartões (para o gráfico de evolução) */
export function evolucao(meses = 12) {
  const out = []
  let comp = ym(new Date())
  for (let i = 0; i < meses; i++) {
    const c = addMonths(comp, -i)
    const gastos = db.expenses.filter((e) => e.competencia === c)
    out.push({
      competencia: c,
      total: r2(gastos.reduce((s, e) => s + e.value, 0)),
      porCartao: listCards().map((card) => ({
        card: card.name,
        total: r2(gastos.filter((e) => e.card === card.key).reduce((s, e) => s + e.value, 0)),
      })),
    })
  }
  return out.reverse()
}

/** Parcelas já comprometidas em competências futuras */
export function comprometidoFuturo() {
  const atual = ym(new Date())
  const futuros = db.expenses.filter((e) => e.competencia > atual)
  const porComp = new Map()
  for (const e of futuros) porComp.set(e.competencia, r2((porComp.get(e.competencia) || 0) + e.value))
  return [...porComp.entries()].map(([competencia, total]) => ({ competencia, total })).sort((a, b) => a.competencia.localeCompare(b.competencia))
}

// ---------- lembretes de cobrança ----------

export function reminderSent(card, person, competencia, tipo) {
  return db.reminders.some((r) => r.card === key(card) && r.person === key(person) && r.competencia === competencia && r.tipo === tipo)
}

export async function markReminder(card, person, competencia, tipo) {
  db.reminders.push({ card: key(card), person: key(person), competencia, tipo, sentAt: new Date().toISOString() })
  if (db.reminders.length > 5000) db.reminders = db.reminders.slice(-2000)
  await save()
}

// ---------- configurações ----------

export const getSettings = () => ({ ...db.settings })
export async function setSettings(patch) {
  db.settings = { ...db.settings, ...patch }
  if (patch.eu !== undefined) db.settings.eu = patch.eu ? key(patch.eu) : ''
  await save()
  return db.settings
}

/** Chave da pessoa marcada como "você" (dono dos cartões) */
export const euKey = () => db.settings.eu || ''
export const souEu = (person) => Boolean(db.settings.eu) && key(person) === db.settings.eu

/**
 * Quanto da(s) fatura(s) é seu: total do mês e a quebra por cartão.
 * `comp` vazio usa a competência atual de cada cartão.
 */
export function minhaParte(comp = null) {
  const eu = euKey()
  if (!eu) return null
  const porCartao = listCards().map((c) => {
    const competencia = comp || competenciaAtual(c.key)
    const itens = db.expenses.filter((e) => e.card === c.key && e.person === eu && e.competencia === competencia)
    const pago = db.payments
      .filter((p) => p.card === c.key && p.person === eu && p.competencia === competencia)
      .reduce((s, p) => s + p.value, 0)
    return {
      card: c.name, cardKey: c.key, competencia,
      total: r2(itens.reduce((s, e) => s + e.value, 0)),
      pago: r2(pago),
      vencimento: vencimentoDate(c.key, competencia)?.toISOString().slice(0, 10) ?? null,
      itens: itens.sort((a, b) => a.at.localeCompare(b.at)),
    }
  }).filter((x) => x.total > 0 || x.pago > 0)

  // gastos meus sem cartão nenhum
  const compAtual = comp || ym(new Date())
  const soltos = db.expenses.filter((e) => !e.card && e.person === eu && e.competencia === compAtual)

  const totalSoltos = soltos.reduce((s, e) => s + e.value, 0)
  const total = porCartao.reduce((s, x) => s + x.total, 0) + totalSoltos
  const pago = porCartao.reduce((s, x) => s + x.pago, 0)

  return {
    total: r2(total),
    pago: r2(pago),
    aPagar: r2(total - pago),   // é isso que ainda sai do seu bolso
    porCartao: porCartao.map((c) => ({ ...c, falta: r2(c.total - c.pago) })),
    semCartao: { total: r2(totalSoltos), itens: soltos },
  }
}

// ---------- contas bancárias (extratos PDF) ----------

export async function saveStatement(account, { month, saidas, entradas, count }) {
  const k = key(account)
  if (!k) return null
  const acc = (db.accounts[k] ??= { name: String(account).trim(), months: {} })
  acc.name = String(account).trim()
  acc.months[month] = { month, saidas: num(saidas), entradas: num(entradas), count: count || 0, importedAt: new Date().toISOString() }
  await save()
  return acc.months[month]
}

export function getAccounts() {
  return Object.values(db.accounts).map((a) => ({
    name: a.name,
    months: Object.values(a.months).sort((x, y) => y.month.localeCompare(x.month)),
  }))
}

export function monthTotal(month) {
  let saidas = 0
  const porConta = []
  for (const a of Object.values(db.accounts)) {
    const m = a.months[month]
    if (m) { saidas += m.saidas; porConta.push({ name: a.name, saidas: m.saidas }) }
  }
  return { month, saidas: r2(saidas), porConta }
}

export async function deleteAccount(name) {
  const k = key(name)
  if (!db.accounts[k]) return false
  delete db.accounts[k]
  await save()
  return true
}

// ---------- compat v1 (comandos antigos continuam funcionando) ----------

export async function addItem(person, value, note = '') {
  const created = await addExpense({ person, value, note })
  return created ? balanceOf(person) : null
}

export async function undoLastItem(person) {
  const removed = await undoLast(person)
  if (!removed) return null
  return { removed, ...balanceOf(person) }
}

export const clearPerson = deletePerson

const r2 = (v) => Math.round(v * 100) / 100
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
