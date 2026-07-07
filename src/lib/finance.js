import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', '..', 'data')
const FILE = path.join(DATA_DIR, 'finance.json')

let db = { people: {}, accounts: {} }
let saving = Promise.resolve()

export function initFinance() {
  mkdirSync(DATA_DIR, { recursive: true })
  if (existsSync(FILE)) {
    db = JSON.parse(readFileSync(FILE, 'utf-8'))
    db.people ??= {}
    db.accounts ??= {}
  }
}

function save() {
  const snapshot = JSON.stringify(db, null, 2)
  saving = saving.then(() => writeFile(FILE, snapshot))
  return saving
}

export const money = (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`
const key = (s) => String(s || '').trim().toLowerCase()

// ---------- Contas de pessoas (quem te deve) ----------

/** Lança um item na conta de uma pessoa (ela passa a te dever esse valor) */
export async function addItem(person, value, note = '') {
  const k = key(person)
  if (!k) return null
  const p = (db.people[k] ??= { name: String(person).trim(), items: [], payments: [] })
  p.name = String(person).trim()
  p.items.push({ value: Number(value), note: String(note || '').trim(), at: new Date().toISOString() })
  await save()
  return balanceOf(k)
}

/** Registra um pagamento que a pessoa te fez (abate o que ela deve) */
export async function addPayment(person, value) {
  const k = key(person)
  const p = db.people[k]
  if (!p) return null
  p.payments.push({ value: Number(value), at: new Date().toISOString() })
  await save()
  return balanceOf(k)
}

/** Remove a última cobrança lançada para a pessoa (corrige engano) */
export async function undoLastItem(person) {
  const p = db.people[key(person)]
  if (!p || !p.items.length) return null
  const removed = p.items.pop()
  await save()
  return { removed, ...balanceOf(key(person)) }
}

export async function clearPerson(person) {
  const k = key(person)
  if (!db.people[k]) return false
  delete db.people[k]
  await save()
  return true
}

export function balanceOf(person) {
  const p = db.people[key(person)]
  if (!p) return null
  const totalItems = p.items.reduce((s, i) => s + i.value, 0)
  const totalPaid = p.payments.reduce((s, i) => s + i.value, 0)
  return { name: p.name, items: p.items, payments: p.payments, totalItems, totalPaid, saldo: totalItems - totalPaid }
}

/** Todas as pessoas com saldo devedor (ordenadas do maior pro menor) */
export function allBalances() {
  return Object.keys(db.people)
    .map((k) => balanceOf(k))
    .filter(Boolean)
    .sort((a, b) => b.saldo - a.saldo)
}

// ---------- Contas bancárias (extratos) ----------

/**
 * Guarda o total de saídas de um mês para uma conta bancária.
 * Se já existir o mesmo mês para a conta, substitui (reimportação).
 */
export async function saveStatement(account, { month, saidas, entradas, count }) {
  const k = key(account)
  if (!k) return null
  const acc = (db.accounts[k] ??= { name: String(account).trim(), months: {} })
  acc.name = String(account).trim()
  acc.months[month] = {
    month,
    saidas: Number(saidas) || 0,
    entradas: Number(entradas) || 0,
    count: count || 0,
    importedAt: new Date().toISOString(),
  }
  await save()
  return acc.months[month]
}

export function getAccounts() {
  return Object.values(db.accounts).map((a) => ({
    name: a.name,
    months: Object.values(a.months).sort((x, y) => y.month.localeCompare(x.month)),
  }))
}

/** Total de saídas de um mês somando todas as contas */
export function monthTotal(month) {
  let saidas = 0
  const porConta = []
  for (const a of Object.values(db.accounts)) {
    const m = a.months[month]
    if (m) { saidas += m.saidas; porConta.push({ name: a.name, saidas: m.saidas }) }
  }
  return { month, saidas, porConta }
}
