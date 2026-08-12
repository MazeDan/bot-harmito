import { ROLETA, sortear1 } from '../lib/jogos.js'
import { arroba } from '../lib/grupo.js'

/** Câmaras restantes por conversa — a tensão aumenta a cada clique */
const tambores = new Map()
const VALIDADE_MS = 10 * 60_000

export default {
  name: 'roleta',
  aliases: ['roletarussa'],
  description: 'Roleta russa de brincadeira: 6 câmaras, uma "bala". Só um clique por vez',
  categoria: 'jogos',

  async run({ sock, msg, chatId, userId }) {
    const t = tambores.get(chatId)
    const expirou = t && Date.now() - t.em > VALIDADE_MS
    const tambor = !t || expirou
      ? { restantes: 6, balaEm: Math.floor(Math.random() * 6) + 1, clique: 0, em: Date.now() }
      : t

    tambor.clique++
    tambor.em = Date.now()
    const morreu = tambor.clique === tambor.balaEm

    if (morreu) {
      tambores.delete(chatId)
      return sock.sendMessage(chatId, {
        text: `🔫 *ROLETA RUSSA*\n\n${arroba(userId)} puxou o gatilho...\n\n${sortear1(ROLETA.perdeu)}\n\n_Tambor recarregado. Próximo._`,
        mentions: [userId],
      }, { quoted: msg })
    }

    tambores.set(chatId, tambor)
    const restam = 6 - tambor.clique
    await sock.sendMessage(chatId, {
      text:
        `🔫 *ROLETA RUSSA*\n\n${arroba(userId)} puxou o gatilho...\n\n${sortear1(ROLETA.salvo)}\n\n` +
        `🎲 Restam *${restam}* câmara(s). Chance de bala no próximo: *${Math.round(100 / restam)}%*`,
      mentions: [userId],
    }, { quoted: msg })
  },
}
