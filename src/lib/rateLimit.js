import { config } from '../config.js'

const usage = new Map()

/**
 * Retorna true se o usuário ainda pode usar comandos nesta janela de tempo.
 */
export function allow(userId) {
  const now = Date.now()
  const timestamps = (usage.get(userId) ?? []).filter(
    (t) => now - t < config.rateLimit.windowMs,
  )

  if (timestamps.length >= config.rateLimit.max) {
    usage.set(userId, timestamps)
    return false
  }

  timestamps.push(now)
  usage.set(userId, timestamps)
  return true
}

// Limpeza periódica para o Map não crescer para sempre
setInterval(() => {
  const now = Date.now()
  for (const [userId, timestamps] of usage) {
    const fresh = timestamps.filter((t) => now - t < config.rateLimit.windowMs)
    if (fresh.length === 0) usage.delete(userId)
    else usage.set(userId, fresh)
  }
}, 5 * 60_000).unref()
