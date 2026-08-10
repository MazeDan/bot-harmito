import { botEhAdmin, ehAdmin, metadados } from '../lib/grupo.js'

export default {
  name: 'link',
  aliases: ['convite'],
  description: 'Pega o link de convite do grupo — só admin',
  categoria: 'grupo',

  async run({ sock, msg, chatId, userId, ehGrupo }) {
    if (!ehGrupo) throw new Error('Esse é pra usar em grupo.')
    if (!(await ehAdmin(sock, chatId, userId))) throw new Error('Só *administradores* podem pegar o link.')
    if (!(await botEhAdmin(sock, chatId))) throw new Error('Eu preciso ser *administrador* para gerar o link. 🙏')

    const codigo = await sock.groupInviteCode(chatId)
    const meta = await metadados(sock, chatId)

    await sock.sendMessage(
      chatId,
      { text: `🔗 *Convite de ${meta.subject}*\n\nhttps://chat.whatsapp.com/${codigo}` },
      { quoted: msg },
    )
  },
}
