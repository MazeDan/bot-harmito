/** Jogo de adivinhar o número — um por conversa, guardado em memória. */
const jogos = new Map()
const LIMITE_MS = 15 * 60_000

export default {
  name: 'adivinha',
  aliases: ['adivinhar', 'numero', 'número'],
  resumo: 'adivinhe o número que eu pensei',
  description: 'Jogo: eu penso num número e você tenta. /adivinha para começar, /adivinha 42 para chutar',
  categoria: 'jogos',

  async run({ sock, msg, chatId, userId, args }) {
    const jogo = jogos.get(chatId)
    const expirado = jogo && Date.now() - jogo.em > LIMITE_MS
    if (expirado) jogos.delete(chatId)

    // sem chute → começa (ou mostra o andamento)
    if (!args.length || !/^\d+$/.test(args[0])) {
      const max = Math.max(10, Math.min(Number(args[0]) || 100, 10000))
      if (jogo && !expirado) {
        return sock.sendMessage(chatId, {
          text: `🎯 Já tem jogo rolando! Entre *1 e ${jogo.max}*, ${jogo.tentativas} tentativa(s) até agora.\n\n_Chute com_ \`/adivinha 42\`_._`,
        }, { quoted: msg })
      }
      jogos.set(chatId, { alvo: Math.floor(Math.random() * max) + 1, max, tentativas: 0, em: Date.now() })
      return sock.sendMessage(chatId, {
        text: `🎯 *Pensei num número entre 1 e ${max}.*\n\nChute com \`/adivinha 42\`. Eu digo se é maior ou menor.`,
      }, { quoted: msg })
    }

    if (!jogo || expirado) {
      throw new Error('Não tem jogo rolando. Comece com */adivinha* (ou */adivinha 500* para mudar o limite).')
    }

    const chute = Number(args[0])
    jogo.tentativas++

    if (chute === jogo.alvo) {
      jogos.delete(chatId)
      const nota = jogo.tentativas <= 5 ? 'Isso foi sorte ou talento? 👀' : jogo.tentativas <= 10 ? 'Bom trabalho!' : 'Demorou, mas chegou. 😄'
      return sock.sendMessage(chatId, {
        text: `🎉 *Acertou!* Era *${jogo.alvo}*.\n\nVocê levou *${jogo.tentativas}* tentativa(s). ${nota}`,
      }, { quoted: msg })
    }

    const dica = chute < jogo.alvo ? '⬆️ É *maior*' : '⬇️ É *menor*'
    const perto = Math.abs(chute - jogo.alvo) <= Math.max(2, jogo.max * 0.03) ? ' — e tá *quentíssimo*! 🔥' : ''
    await sock.sendMessage(chatId, { text: `${dica} que ${chute}.${perto}\n\n_Tentativa ${jogo.tentativas}._` }, { quoted: msg })
    void userId
  },
}
