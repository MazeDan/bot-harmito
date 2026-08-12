import { DESAFIOS, sortear1 } from '../lib/conteudo.js'
import { arroba, mencionados } from '../lib/grupo.js'

export default {
  name: 'desafio',
  aliases: ['dare'],
  resumo: 'sorteia um desafio',
  description: 'Sorteia um desafio (marque alguém para direcionar)',
  categoria: 'diversao',

  async run({ sock, msg, chatId }) {
    const [alvo] = mencionados(msg)
    const desafio = sortear1(DESAFIOS)
    const texto = alvo
      ? `🔥 *Desafio para ${arroba(alvo)}*\n\n${desafio}`
      : `🔥 *Desafio*\n\n${desafio}`

    await sock.sendMessage(chatId, { text: texto, mentions: alvo ? [alvo] : [] }, { quoted: msg })
  },
}
