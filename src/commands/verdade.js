import { VERDADES, sortear1 } from '../lib/conteudo.js'
import { arroba, mencionados } from '../lib/grupo.js'

export default {
  name: 'verdade',
  aliases: ['truth'],
  description: 'Sorteia uma pergunta de verdade (marque alguém para direcionar)',
  categoria: 'diversao',

  async run({ sock, msg, chatId }) {
    const [alvo] = mencionados(msg)
    const pergunta = sortear1(VERDADES)
    const texto = alvo
      ? `🫵 *Verdade para ${arroba(alvo)}*\n\n${pergunta}`
      : `🎯 *Verdade*\n\n${pergunta}`

    await sock.sendMessage(chatId, { text: texto, mentions: alvo ? [alvo] : [] }, { quoted: msg })
  },
}
