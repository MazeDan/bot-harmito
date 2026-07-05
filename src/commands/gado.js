export default {
  name: 'gado',
  aliases: ['gada'],
  description: 'Mede o nível de gado: /gado @fulano (sem marcar, mede você mesmo)',

  async run({ sock, msg, chatId, userId }) {
    const alvo =
      msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ?? userId

    const porcentagem = Math.floor(Math.random() * 101)
    const barra = '🐮'.repeat(Math.round(porcentagem / 20)).padEnd(5, '▫️')

    await sock.sendMessage(
      chatId,
      {
        text: `🐂 *Gadômetro*\n\n@${alvo.split('@')[0]} é *${porcentagem}% gado*\n${barra}`,
        mentions: [alvo],
      },
      { quoted: msg },
    )
  },
}
