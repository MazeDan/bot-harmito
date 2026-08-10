import { buscar, proximos, remover } from '../lib/agenda.js'

export default {
  name: 'cancelarlembrete',
  aliases: ['apagarlembrete', 'dellembrete'],
  description: 'Apaga um item da agenda: /cancelarlembrete 3',
  categoria: 'agenda',
  dono: true,

  async run({ sock, msg, chatId, args }) {
    if (!args.length) {
      const lista = proximos(10)
      if (!lista.length) throw new Error('Não tem nada anotado.')
      throw new Error(
        'Qual deles?\n\n' +
        lista.map((i) => `▸ *#${i.num}* — ${i.hora ? i.hora + ' ' : ''}${i.texto}`).join('\n') +
        '\n\n_Use `/cancelarlembrete 3`._',
      )
    }

    const nums = args.map(Number).filter((n) => Number.isInteger(n) && n > 0)
    const apagados = []
    const naoAchei = []

    for (const n of nums) {
      const item = buscar(n)
      if (!item) { naoAchei.push(n); continue }
      await remover(n)
      apagados.push(item)
    }

    if (!apagados.length) throw new Error(`Não achei ${nums.map((n) => `*#${n}*`).join(', ')}. Veja os números com */lembretes*.`)

    let texto = apagados.length === 1
      ? `🗑️ Apaguei: *${apagados[0].texto}*`
      : `🗑️ Apaguei ${apagados.length}:\n${apagados.map((i) => `▸ ${i.texto}`).join('\n')}`
    if (naoAchei.length) texto += `\n\n⚠️ _Não achei: ${naoAchei.map((n) => `#${n}`).join(', ')}._`

    await sock.sendMessage(chatId, { text: texto }, { quoted: msg })
  },
}
