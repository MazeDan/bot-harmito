export default {
  name: 'ship',
  aliases: ['casal'],
  description: 'Mede o casal: /ship @fulano @ciclano (ou marque só uma pessoa para shippar com você)',

  async run({ sock, msg, chatId, userId }) {
    const mencionados =
      msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? []

    if (mencionados.length === 0) {
      throw new Error('Marque uma ou duas pessoas: /ship @fulano @ciclano')
    }

    const [a, b] = mencionados.length >= 2 ? mencionados : [userId, mencionados[0]]
    const porcentagem = Math.floor(Math.random() * 101)
    const barra = '❤️'.repeat(Math.round(porcentagem / 20)).padEnd(5, '🖤')

    let veredito
    if (porcentagem >= 80) veredito = 'Casem logo! 💍'
    else if (porcentagem >= 50) veredito = 'Tem futuro... 👀'
    else if (porcentagem >= 20) veredito = 'Melhor ficar na amizade 😅'
    else veredito = 'Nem no multiverso 💀'

    await sock.sendMessage(
      chatId,
      {
        text: `💘 *Shipômetro*\n\n@${a.split('@')[0]} + @${b.split('@')[0]} = *${porcentagem}%*\n${barra}\n\n${veredito}`,
        mentions: [a, b],
      },
      { quoted: msg },
    )
  },
}
