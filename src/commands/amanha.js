import { hojeISO, somarDias } from '../lib/agenda.js'
import { montarResumoDia } from '../lib/lembretes.js'

export default {
  name: 'amanha',
  aliases: ['amanhã'],
  resumo: 'a agenda de amanhã',
  description: 'A agenda de amanhã',
  categoria: 'agenda',
  dono: true,

  async run({ sock, msg, chatId }) {
    const texto = montarResumoDia(somarDias(hojeISO(), 1)).replace('☀️ *Bom dia!* —', '📅 *Amanhã* —')
    await sock.sendMessage(chatId, { text: texto }, { quoted: msg })
  },
}
