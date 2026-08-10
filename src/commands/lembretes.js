import { atrasados, hojeISO, proximos, rotuloData } from '../lib/agenda.js'
import { linhaItem } from '../lib/lembretes.js'

export default {
  name: 'lembretes',
  aliases: ['tarefas', 'compromissos', 'pendencias', 'pendências'],
  description: 'Lista os próximos compromissos e tarefas, com o número de cada um',

  async run({ sock, msg, chatId, args }) {
    const quantidade = Number(args[0]) > 0 ? Math.min(Number(args[0]), 40) : 15
    const itens = proximos(quantidade)
    const atrasadas = atrasados(hojeISO())

    if (!itens.length && !atrasadas.length) {
      return sock.sendMessage(
        chatId,
        { text: '🎉 Nada pendente!\n\n_Anote com_ `/lembrete amanhã 09:00 pagar faculdade`_._' },
        { quoted: msg },
      )
    }

    let texto = '📋 *Seus próximos*\n'

    if (atrasadas.length) {
      texto += `\n⚠️ *Atrasados*\n${atrasadas.slice(0, 10).map((i) => `▸ ${i.texto} _(${rotuloData(i.data, { curto: true })} · #${i.num})_`).join('\n')}\n`
    }

    // agrupa por dia para dar noção de tempo
    const porDia = new Map()
    for (const i of itens) {
      if (!porDia.has(i.data)) porDia.set(i.data, [])
      porDia.get(i.data).push(i)
    }
    for (const [data, lista] of porDia) {
      texto += `\n*${rotuloData(data)}*\n${lista.map((i) => linhaItem(i, { mostrarNum: true, mostrarRecorrencia: true })).join('\n')}\n`
    }

    texto += '\n_`/feito 3` conclui · `/lembrete del 3` apaga · `/semana` mostra os 7 dias._'
    await sock.sendMessage(chatId, { text: texto }, { quoted: msg })
  },
}
