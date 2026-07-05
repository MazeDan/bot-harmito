export default {
  name: 'dado',
  aliases: ['roll'],
  description: 'Joga um dado de 6 lados (ou /dado 20 para um d20)',

  async run({ sock, msg, chatId, args }) {
    const lados = Math.max(2, Math.min(1000, parseInt(args[0], 10) || 6))
    const resultado = Math.floor(Math.random() * lados) + 1
    await sock.sendMessage(
      chatId,
      { text: `🎲 Dado de ${lados} lados: *${resultado}*` },
      { quoted: msg },
    )
  },
}
