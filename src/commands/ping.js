export default {
  name: 'ping',
  aliases: ['status'],
  description: 'Verifica se o bot está online e o tempo de resposta',

  async run({ sock, msg, chatId }) {
    const inicio = Date.now()
    const enviada = await sock.sendMessage(chatId, { text: '🏓 Pong!' }, { quoted: msg })
    const ms = Date.now() - inicio

    const uptime = Math.floor(process.uptime())
    const h = Math.floor(uptime / 3600)
    const m = Math.floor((uptime % 3600) / 60)

    await sock.sendMessage(chatId, {
      text: `🏓 Pong!\n⚡ Resposta: *${ms}ms*\n⏱️ Online há: *${h}h ${m}min*`,
      edit: enviada.key,
    })
  },
}
