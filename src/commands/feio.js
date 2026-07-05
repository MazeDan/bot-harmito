export default {
  name: 'feio',
  aliases: ['feia'],
  description: 'Mede o quanto a pessoa é feia (marque alguém: /feio @fulano)',

  async run({ sock, msg, chatId, userId }) {
    const mencionado =
      msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ?? userId

    const porcentagem = Math.floor(Math.random() * 101)
    const barra = '█'.repeat(Math.round(porcentagem / 10)).padEnd(10, '░')

    await sock.sendMessage(
      chatId,
      {
        text: `🔎 Análise concluída!\n\n@${mencionado.split('@')[0]} é *${porcentagem}% feio(a)*\n[${barra}]`,
        mentions: [mencionado],
      },
      { quoted: msg },
    )
  },
}
