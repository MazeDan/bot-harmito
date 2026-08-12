import { EMOJIS, normalizar, sortear1 } from '../lib/jogos.js'
import { arroba } from '../lib/grupo.js'

const abertas = new Map()
const VALIDADE_MS = 5 * 60_000

export default {
  name: 'emoji',
  aliases: ['emojis', 'adivinheoemoji'],
  resumo: 'adivinhe o filme pelos emojis',
  description: 'Adivinhe o que os emojis querem dizer: /emoji começa, /emoji rei leão responde',
  categoria: 'jogos',

  async run({ sock, msg, chatId, userId, args }) {
    const aberta = abertas.get(chatId)
    const expirou = aberta && Date.now() - aberta.em > VALIDADE_MS
    if (expirou) abertas.delete(chatId)

    const palpite = normalizar(args.join(' '))

    // ---- nova rodada ----
    if (!palpite) {
      if (aberta && !expirou) {
        return sock.sendMessage(chatId, {
          text: `⏳ Ainda tem uma aberta:\n\n# ${aberta.q[0]}\n\n💡 _${aberta.q[2]}_\n\n_Responda com_ \`/emoji sua resposta\`_._`,
        }, { quoted: msg })
      }
      const q = sortear1(EMOJIS)
      abertas.set(chatId, { q, em: Date.now(), erros: 0 })
      return sock.sendMessage(chatId, {
        text: `🎬 *O QUE É ISTO?*\n\n# ${q[0]}\n\n💡 _${q[2]}_\n\n_Responda com_ \`/emoji sua resposta\` — 5 minutos._`,
      }, { quoted: msg })
    }

    if (!aberta || expirou) throw new Error('Não tem nenhuma aberta. Comece com */emoji*.')

    // ---- desistir ----
    if (/^(DESISTO|PASSO|NAO SEI)$/.test(palpite)) {
      abertas.delete(chatId)
      return sock.sendMessage(chatId, { text: `🏳️ A resposta era *${aberta.q[1]}*.\n\n_Bora outra:_ \`/emoji\`` }, { quoted: msg })
    }

    // ---- resposta ----
    const certa = normalizar(aberta.q[1])
    // aceita acerto parcial quando a resposta tem mais de uma palavra
    const acertou = palpite === certa ||
      (certa.split(' ').length > 1 && certa.includes(palpite) && palpite.length >= Math.ceil(certa.length * 0.6))

    if (acertou) {
      abertas.delete(chatId)
      return sock.sendMessage(chatId, {
        text: `🎉 *ISSO!* ${aberta.q[0]} = *${aberta.q[1]}*\n\n${arroba(userId)} acertou${aberta.erros ? ` depois de ${aberta.erros} tentativa(s) do grupo` : ' de primeira'}. 👏`,
        mentions: [userId],
      }, { quoted: msg })
    }

    aberta.erros++
    await sock.sendMessage(chatId, {
      text: `❌ Não é *${palpite}*.\n\n# ${aberta.q[0]}\n💡 _${aberta.q[2]}_ · ${aberta.erros} erro(s)\n\n_\`/emoji desisto\` entrega o jogo._`,
    }, { quoted: msg })
  },
}
