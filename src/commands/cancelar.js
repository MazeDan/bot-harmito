import { pendentes } from './lote.js'

export default {
  name: 'cancelar',
  aliases: ['cancela'],
  description: 'Descarta o lote de lançamentos pendente',

  async run({ sock, msg, chatId, userId }) {
    const tinha = pendentes.delete(userId)
    await sock.sendMessage(
      chatId,
      { text: tinha ? '🗑️ Lote descartado, nada foi gravado.' : 'Não tinha nenhum lote pendente.' },
      { quoted: msg },
    )
  },
}
