import { montarFimDeSemana, montarSemana } from '../lib/lembretes.js'

export default {
  name: 'semana',
  aliases: ['proximos', 'próximos', 'fds'],
  resumo: 'os próximos 7 dias',
  description: 'Visão dos próximos 7 dias (ou /semana fds para o fim de semana)',
  categoria: 'agenda',
  dono: true,

  async run({ sock, msg, chatId, args, text }) {
    const pediuFds = /^(fds|fim|finde)/i.test(args[0] || '') || /^[/!.]fds\b/i.test(text)
    const texto = pediuFds ? montarFimDeSemana() : montarSemana()
    await sock.sendMessage(chatId, { text: texto }, { quoted: msg })
  },
}
