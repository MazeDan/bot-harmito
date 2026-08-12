import { QUIZ } from '../lib/conteudo.js'

/** Uma pergunta aberta por conversa. */
const abertas = new Map()
const LIMITE_MS = 5 * 60_000
const LETRAS = ['A', 'B', 'C', 'D']

export default {
  name: 'quiz',
  aliases: ['pergunta', 'trivia'],
  description: 'Pergunta de conhecimentos gerais: /quiz — responda com /quiz b',
  categoria: 'jogos',

  async run({ sock, msg, chatId, args }) {
    const aberta = abertas.get(chatId)
    const expirou = aberta && Date.now() - aberta.em > LIMITE_MS
    if (expirou) abertas.delete(chatId)

    // resposta: /quiz b
    const resposta = (args[0] || '').toUpperCase()
    if (LETRAS.includes(resposta)) {
      if (!aberta || expirou) throw new Error('Não tem pergunta aberta. Peça uma com */quiz*.')
      abertas.delete(chatId)
      const certa = LETRAS[aberta.q.r]
      const acertou = resposta === certa
      return sock.sendMessage(chatId, {
        text: acertou
          ? `✅ *Isso aí!* A resposta é *${certa}) ${aberta.q.o[aberta.q.r]}*.`
          : `❌ *Errou.* A resposta certa é *${certa}) ${aberta.q.o[aberta.q.r]}*.`,
      }, { quoted: msg })
    }

    if (aberta && !expirou) {
      return sock.sendMessage(chatId, {
        text: `⏳ Ainda tem pergunta aberta:\n\n*${aberta.q.p}*\n${aberta.q.o.map((o, i) => `${LETRAS[i]}) ${o}`).join('\n')}\n\n_Responda com_ \`/quiz b\`_._`,
      }, { quoted: msg })
    }

    const q = QUIZ[Math.floor(Math.random() * QUIZ.length)]
    abertas.set(chatId, { q, em: Date.now() })

    await sock.sendMessage(chatId, {
      text: `🧠 *Quiz*\n\n*${q.p}*\n\n${q.o.map((o, i) => `${LETRAS[i]}) ${o}`).join('\n')}\n\n_Responda com_ \`/quiz b\` _— você tem 5 minutos._`,
    }, { quoted: msg })
  },
}
