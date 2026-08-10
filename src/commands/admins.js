import { arroba, metadados } from '../lib/grupo.js'

export default {
  name: 'admins',
  aliases: ['adm', 'staff'],
  description: 'Lista os administradores do grupo',
  categoria: 'grupo',

  async run({ sock, msg, chatId, ehGrupo }) {
    if (!ehGrupo) throw new Error('Esse é pra usar em grupo.')

    const meta = await metadados(sock, chatId)
    const adms = (meta?.participants ?? []).filter((p) => p.admin)
    if (!adms.length) throw new Error('Não consegui ver os administradores.')

    const dono = adms.find((p) => p.admin === 'superadmin')
    const outros = adms.filter((p) => p.admin !== 'superadmin')

    let texto = `👮 *Administradores de ${meta.subject}*\n`
    if (dono) texto += `\n👑 ${arroba(dono.id)} _(criador)_\n`
    if (outros.length) texto += '\n' + outros.map((p) => `▸ ${arroba(p.id)}`).join('\n')
    texto += `\n\n_${adms.length} de ${meta.participants.length} membros._`

    await sock.sendMessage(chatId, { text: texto, mentions: adms.map((p) => p.id) }, { quoted: msg })
  },
}
