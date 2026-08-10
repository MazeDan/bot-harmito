/** Ajudantes para lidar com grupos do WhatsApp (metadados, admins, menções). */

const cache = new Map()
const TTL = 5 * 60_000

export const ehGrupo = (chatId) => String(chatId || '').endsWith('@g.us')

/** Metadados do grupo, com cache curto — a chamada é cara e o WhatsApp limita */
export async function metadados(sock, chatId, { forcar = false } = {}) {
  if (!ehGrupo(chatId)) return null
  const guardado = cache.get(chatId)
  if (!forcar && guardado && Date.now() - guardado.em < TTL) return guardado.dados

  const dados = await sock.groupMetadata(chatId)
  cache.set(chatId, { dados, em: Date.now() })
  return dados
}

export const limparCache = (chatId) => (chatId ? cache.delete(chatId) : cache.clear())

/** Lista de JIDs dos participantes */
export async function participantes(sock, chatId) {
  const meta = await metadados(sock, chatId)
  return (meta?.participants ?? []).map((p) => p.id)
}

/** JIDs dos administradores */
export async function admins(sock, chatId) {
  const meta = await metadados(sock, chatId)
  return (meta?.participants ?? []).filter((p) => p.admin).map((p) => p.id)
}

export async function ehAdmin(sock, chatId, userId) {
  if (!ehGrupo(chatId)) return true
  return (await admins(sock, chatId)).includes(userId)
}

/** O próprio bot é admin? (necessário para link de convite, remover, etc.) */
export async function botEhAdmin(sock, chatId) {
  const eu = (sock.user?.id || '').split(':')[0] + '@s.whatsapp.net'
  return (await admins(sock, chatId)).includes(eu)
}

/** "5511999998888@s.whatsapp.net" → "@5511999998888" */
export const arroba = (jid) => '@' + String(jid).split('@')[0].split(':')[0]

/** Nome curto para exibir: usa o número, que é o que sempre temos */
export const nomeCurto = (jid) => String(jid).split('@')[0].split(':')[0]

/** JIDs mencionados na mensagem (por @ ou por reply) */
export function mencionados(msg) {
  const ctx =
    msg.message?.extendedTextMessage?.contextInfo ??
    msg.message?.imageMessage?.contextInfo ??
    msg.message?.videoMessage?.contextInfo
  const lista = [...(ctx?.mentionedJid ?? [])]
  if (ctx?.participant && !lista.includes(ctx.participant)) lista.push(ctx.participant)
  return lista
}

/** Sorteia n itens distintos de uma lista */
export function sortear(lista, n = 1) {
  const copia = [...lista]
  const out = []
  while (out.length < n && copia.length) {
    out.push(...copia.splice(Math.floor(Math.random() * copia.length), 1))
  }
  return out
}

/**
 * Número "aleatório" mas estável no dia para uma chave — assim o /ranking
 * não muda a cada chamada, só no dia seguinte.
 */
export function aleatorioDoDia(chave, max = 100) {
  const semente = `${chave}|${new Date().toDateString()}`
  let h = 2166136261
  for (let i = 0; i < semente.length; i++) {
    h ^= semente.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h) % max
}
