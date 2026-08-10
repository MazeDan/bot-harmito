import { deletePerson, listPeople, upsertPerson } from '../lib/finance.js'

export default {
  name: 'pessoa',
  aliases: ['pessoas', 'contato'],
  description: 'Vincula o telefone de alguém (pra cobrança): /pessoa danilo 11999998888',
  categoria: 'financeiro',
  dono: true,

  async run({ sock, msg, chatId, args }) {
    if (!args.length || args[0].toLowerCase() === 'list') {
      const people = listPeople()
      if (!people.length) throw new Error('Nenhuma pessoa cadastrada ainda.')
      const txt = people.map((p) => `▸ *${p.name}* — ${p.phone ? `📱 ${p.phone}` : '_sem telefone_'}`).join('\n')
      return sock.sendMessage(chatId, { text: `👥 *Pessoas*\n\n${txt}\n\n_Use \`/pessoa danilo 11999998888\` para vincular o número._` }, { quoted: msg })
    }

    if (args[0].toLowerCase() === 'del') {
      if (!args[1]) throw new Error('Use: */pessoa del danilo*')
      const ok = await deletePerson(args[1])
      return sock.sendMessage(chatId, { text: ok ? `🗑️ Removi *${args[1]}* e todo o histórico dela.` : `Não achei *${args[1]}*.` }, { quoted: msg })
    }

    const [nome, telefone] = args
    if (!telefone) throw new Error('Use: */pessoa danilo 11999998888*')

    const p = await upsertPerson(nome, { phone: telefone })
    if (!p.jid) throw new Error('Telefone inválido. Mande com DDD: */pessoa danilo 11999998888*')

    await sock.sendMessage(
      chatId,
      { text: `✅ *${p.name}* agora está vinculado ao número *${p.phone}*.\n\n_Vou usar esse número nas cobranças automáticas._` },
      { quoted: msg },
    )
  },
}
