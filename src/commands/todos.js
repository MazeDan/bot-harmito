import { arroba, ehAdmin, participantes } from '../lib/grupo.js'

export default {
  name: 'todos',
  aliases: ['all', 'geral', 'marcar'],
  description: 'Marca todo mundo do grupo: /todos [recado] — só admin',
  categoria: 'grupo',

  async run({ sock, msg, chatId, userId, text, ehGrupo }) {
    if (!ehGrupo) throw new Error('Esse é pra usar em grupo.')
    if (!(await ehAdmin(sock, chatId, userId))) {
      throw new Error('Só *administradores* podem marcar todo mundo. 🙂')
    }

    const recado = text.replace(/^[/!.]\S+\s*/, '').trim()
    const todos = await participantes(sock, chatId)
    const eu = (sock.user?.id || '').split(':')[0] + '@s.whatsapp.net'
    const alvos = todos.filter((p) => p !== eu)
    if (!alvos.length) throw new Error('Não consegui ver os participantes.')

    const texto =
      `📢 *ATENÇÃO GERAL*${recado ? `\n\n${recado}` : ''}\n\n` +
      alvos.map((p) => arroba(p)).join(' ')

    await sock.sendMessage(chatId, { text: texto, mentions: alvos })
  },
}
