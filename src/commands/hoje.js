import { hojeISO, somarDias } from '../lib/agenda.js'
import { montarResumoDia } from '../lib/lembretes.js'

export default {
  name: 'hoje',
  aliases: ['agenda', 'dia'],
  description: 'Tudo que você tem para hoje: compromissos, tarefas, atrasados e faturas',

  async run({ sock, msg, chatId, args }) {
    // /hoje 12/09 mostra outro dia
    let data = hojeISO()
    const m = (args[0] || '').match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)
    if (m) {
      const ano = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : new Date().getFullYear()
      data = `${ano}-${String(Number(m[2])).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`
    } else if (/^amanha|amanhã$/i.test(args[0] || '')) {
      data = somarDias(data, 1)
    }

    await sock.sendMessage(chatId, { text: montarResumoDia(data) }, { quoted: msg })
  },
}
