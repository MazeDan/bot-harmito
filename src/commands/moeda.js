export default {
  name: 'moeda',
  aliases: ['coin', 'caraoucoroa'],
  description: 'Cara ou coroa',

  async run({ sock, msg, chatId }) {
    const lado = Math.random() < 0.5 ? '🪙 *Cara!*' : '🪙 *Coroa!*'
    await sock.sendMessage(chatId, { text: lado }, { quoted: msg })
  },
}
