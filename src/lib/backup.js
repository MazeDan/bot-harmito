import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { copyFile, readdir, unlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from '../config.js'
import { AGENDA_FILE } from './agenda.js'
import { getCard, getPerson, getSettings, raw, setSettings } from './finance.js'
import { getSock, isOnline, sendText } from './wa.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', '..', 'data')
const FILE = path.join(DATA_DIR, 'finance.json')
const BACKUP_DIR = path.join(DATA_DIR, 'backups')

const hojeISO = () => new Date().toISOString().slice(0, 10)

/**
 * Cópia local do finance.json, uma por dia, guardando as últimas N.
 * É a rede de segurança de verdade — o envio pelo WhatsApp é conveniência.
 */
export async function snapshotDiario() {
  mkdirSync(BACKUP_DIR, { recursive: true })
  const feitos = []

  for (const [prefixo, origem] of [['finance', FILE], ['agenda', AGENDA_FILE]]) {
    if (!existsSync(origem)) continue
    const destino = path.join(BACKUP_DIR, `${prefixo}-${hojeISO()}.json`)
    if (!existsSync(destino)) {
      await copyFile(origem, destino)
      feitos.push(path.basename(destino))
    }

    // rotaciona: mantém só as cópias mais recentes de cada arquivo
    const arquivos = (await readdir(BACKUP_DIR)).filter((f) => f.startsWith(`${prefixo}-`)).sort()
    for (const velho of arquivos.slice(0, -config.backup.manterDias)) {
      await unlink(path.join(BACKUP_DIR, velho)).catch(() => {})
    }
  }

  if (feitos.length) console.log(`💾 Backup local: ${feitos.join(', ')}`)
  return feitos
}

/** Planilha de todos os lançamentos e pagamentos, pronta pro Excel */
export function gerarCSV() {
  const db = raw()
  const nome = (k) => getPerson(k)?.name ?? k
  const cartao = (k) => (k ? getCard(k)?.name ?? k : '')
  const escapar = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const valorBR = (v) => String(Number(v || 0).toFixed(2)).replace('.', ',')
  const dia = (iso) => new Date(iso).toLocaleDateString('pt-BR')

  const linhas = [['Tipo', 'Data', 'Pessoa', 'Cartão', 'Valor', 'Parcela', 'Fatura', 'Observação']]

  for (const e of [...db.expenses].sort((a, b) => a.at.localeCompare(b.at))) {
    linhas.push(['Gasto', dia(e.at), nome(e.person), cartao(e.card), valorBR(e.value),
      e.parcela ? `${e.parcela.n}/${e.parcela.total}` : '', e.competencia, e.note])
  }
  for (const p of [...db.payments].sort((a, b) => a.at.localeCompare(b.at))) {
    linhas.push(['Pagamento', dia(p.at), nome(p.person), cartao(p.card), valorBR(p.value),
      '', p.competencia ?? '', p.note])
  }

  // BOM + ponto e vírgula: é o que o Excel em português espera
  return Buffer.from('﻿' + linhas.map((l) => l.map(escapar).join(';')).join('\r\n'), 'utf-8')
}

/** Faltam quantos dias para o próximo envio? (<= 0 significa "está na hora") */
export function diasAteProximoBackup() {
  const ultimo = getSettings().ultimoBackup
  if (!ultimo) return 0
  const passados = Math.floor((Date.now() - new Date(ultimo).getTime()) / 86400000)
  return config.backup.intervaloDias - passados
}

/**
 * Manda o backup para o seu WhatsApp: o JSON (para restaurar) e o CSV (para ler).
 * Precisa de um chat marcado com /relatorios.
 */
export async function enviarBackup({ forcado = false } = {}) {
  const s = getSettings()
  if (!s.donoJid) return { erro: 'Nenhum chat marcado para receber. Mande */relatorios* no chat que deve receber.' }
  if (!isOnline()) return { erro: 'Bot não está conectado ao WhatsApp.' }
  if (!existsSync(FILE)) return { erro: 'Ainda não existe nada para fazer backup.' }

  const sock = getSock()
  const db = raw()
  const data = hojeISO()
  const json = readFileSync(FILE)
  const csv = gerarCSV()

  const resumo =
    `💾 *Backup ${forcado ? 'manual' : 'automático'}* — ${new Date().toLocaleDateString('pt-BR')}\n\n` +
    `▸ ${Object.keys(db.cards).length} cartão(ões)\n` +
    `▸ ${Object.keys(db.people).length} pessoa(s)\n` +
    `▸ ${db.expenses.length} lançamento(s)\n` +
    `▸ ${db.payments.length} pagamento(s)\n\n` +
    '_O `.json` é o arquivo de restauração: guarde-o. O `.csv` abre no Excel._'

  await sendText(s.donoJid, resumo)
  await sock.sendMessage(s.donoJid, {
    document: json, mimetype: 'application/json', fileName: `financeiro-${data}.json`,
  })
  await sock.sendMessage(s.donoJid, {
    document: csv, mimetype: 'text/csv', fileName: `financeiro-${data}.csv`,
  })
  if (existsSync(AGENDA_FILE)) {
    await sock.sendMessage(s.donoJid, {
      document: readFileSync(AGENDA_FILE), mimetype: 'application/json', fileName: `agenda-${data}.json`,
    })
  }

  await setSettings({ ultimoBackup: new Date().toISOString() })
  console.log(`💾 Backup enviado para ${s.donoJid}`)
  return { ok: true }
}
