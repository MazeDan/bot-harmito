import { commands } from '../handler.js'

export default {
  name: 'menu',
  aliases: ['help', 'ajuda', 'comandos'],
  description: 'Mostra todos os comandos',

  async run({ sock, msg, chatId }) {
    const unique = [...new Set(commands.values())]
    const lines = unique.map((c) => `▸ */${c.name}* — ${c.description}`)

    await sock.sendMessage(
      chatId,
      { text: `🤖 *Comandos do Bot*\n\n${lines.join('\n')}` },
      { quoted: msg },
    )
  },
}
