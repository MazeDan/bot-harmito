import { EU_NUNCA, sortear1 } from '../lib/jogos.js'

export default {
  name: 'eununca',
  aliases: ['eununcaja', 'nunca'],
  resumo: 'sorteia um "eu nunca" pro grupo',
  description: 'Sorteia um "eu nunca" para o grupo responder',
  categoria: 'jogos',

  async run({ sock, msg, chatId }) {
    const frase = sortear1(EU_NUNCA)
    await sock.sendMessage(chatId, {
      text: `🙋 *EU NUNCA...*\n\n_${frase}_\n\n👍 = já fiz  ·  👎 = nunca fiz\n_Reaja aí e não minta._`,
    }, { quoted: msg })
  },
}
