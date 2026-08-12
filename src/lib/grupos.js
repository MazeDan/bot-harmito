import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', '..', 'data')
export const GRUPOS_FILE = path.join(DATA_DIR, 'grupos.json')

/** Categorias liberadas por padrão num grupo novo */
const PADRAO = ['diversao', 'jogos', 'grupo', 'midia', 'utilidades']

const vazio = () => ({
  version: 1,
  padrao: { categorias: [...PADRAO], comandos: [], bloqueados: [] },
  grupos: {},
})

let db = vazio()
let salvando = Promise.resolve()

export function initGrupos() {
  mkdirSync(DATA_DIR, { recursive: true })
  if (existsSync(GRUPOS_FILE)) db = { ...vazio(), ...JSON.parse(readFileSync(GRUPOS_FILE, 'utf-8')) }
  salvar()
}

function salvar() {
  const snapshot = JSON.stringify(db, null, 2)
  salvando = salvando.then(() => writeFile(GRUPOS_FILE, snapshot)).catch((e) => console.error('Erro salvando grupos.json:', e))
  return salvando
}

export const raw = () => db
export const ehGrupo = (chatId) => String(chatId || '').endsWith('@g.us')

/** Registra o grupo na primeira mensagem, para ele aparecer no painel */
export async function registrarGrupo(chatId, nome = '') {
  if (!ehGrupo(chatId)) return null
  const g = (db.grupos[chatId] ??= {
    jid: chatId,
    nome: nome || chatId.split('@')[0],
    categorias: [...db.padrao.categorias],
    comandos: [],
    bloqueados: [],
    silenciado: false,
    regras: '',
    boasVindas: false,
    criadoEm: new Date().toISOString(),
  })
  if (nome && g.nome !== nome) g.nome = nome
  g.visto = new Date().toISOString()
  await salvar()
  return g
}

export const getGrupo = (chatId) => db.grupos[chatId] ?? null
export const listarGrupos = () =>
  Object.values(db.grupos).sort((a, b) => (b.visto ?? '').localeCompare(a.visto ?? ''))

export async function atualizarGrupo(chatId, patch = {}) {
  const g = db.grupos[chatId]
  if (!g) return null
  for (const campo of ['categorias', 'comandos', 'bloqueados']) {
    if (Array.isArray(patch[campo])) g[campo] = [...new Set(patch[campo])]
  }
  for (const campo of ['silenciado', 'boasVindas']) {
    if (patch[campo] !== undefined) g[campo] = Boolean(patch[campo])
  }
  if (patch.regras !== undefined) g.regras = String(patch.regras || '')
  if (patch.nome) g.nome = String(patch.nome)
  await salvar()
  return g
}

export async function removerGrupo(chatId) {
  if (!db.grupos[chatId]) return false
  delete db.grupos[chatId]
  await salvar()
  return true
}

export async function setPadrao(patch = {}) {
  for (const campo of ['categorias', 'comandos', 'bloqueados']) {
    if (Array.isArray(patch[campo])) db.padrao[campo] = [...new Set(patch[campo])]
  }
  await salvar()
  return db.padrao
}

/**
 * O comando pode rodar neste chat?
 * Em conversa privada tudo é liberado (o dono é filtrado antes, no handler).
 * Em grupo vale: bloqueado > liberado na unha > categoria liberada.
 */
export function permitido(cmd, chatId) {
  if (!ehGrupo(chatId)) return { ok: true }
  // /menu passa sempre: sem ele ninguém descobre o que está ligado
  if (cmd.sempre) return { ok: true }

  const g = db.grupos[chatId]
  if (!g) return { ok: true, motivo: 'grupo-novo' } // ainda não registrado: não trava

  if (g.silenciado) return { ok: false, motivo: 'silenciado' }

  const nomes = [cmd.name, ...(cmd.aliases ?? [])]
  if (nomes.some((n) => g.bloqueados.includes(n))) return { ok: false, motivo: 'bloqueado' }
  if (nomes.some((n) => g.comandos.includes(n))) return { ok: true }
  if (g.categorias.includes(cmd.categoria ?? 'utilidades')) return { ok: true }

  return { ok: false, motivo: 'categoria-desligada' }
}
