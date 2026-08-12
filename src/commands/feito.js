import { buscar, doDia, hojeISO, marcarFeito } from '../lib/agenda.js'
import { descreverRecorrencia } from '../lib/parseQuando.js'

export default {
  name: 'feito',
  // atenção: 'ok' não entra aqui — já é alias do /confirmar do lote
  aliases: ['concluir', 'fiz', 'done', 'check'],
  resumo: 'marca um item como concluído',
  description: 'Marca um item da agenda como concluído: /feito 3',
  categoria: 'agenda',
  dono: true,

  async run({ sock, msg, chatId, args }) {
    if (!args.length) {
      const pendentes = doDia(hojeISO()).filter((i) => !i.feito)
      if (!pendentes.length) throw new Error('Nada pendente para hoje. 🎉')
      throw new Error(
        'Qual deles?\n\n' +
        pendentes.map((i) => `▸ *#${i.num}* — ${i.hora ? i.hora + ' ' : ''}${i.texto}`).join('\n') +
        '\n\n_Use `/feito 3`._',
      )
    }

    // aceita vários de uma vez: /feito 3 5 7
    const nums = args.map(Number).filter((n) => Number.isInteger(n) && n > 0)
    if (!nums.length) throw new Error('Use o número do item: */feito 3*. Veja os números com */lembretes*.')

    const ok = []
    const naoAchei = []
    for (const n of nums) {
      if (!buscar(n)) { naoAchei.push(n); continue }
      const i = await marcarFeito(n, true)
      ok.push(i)
    }

    if (!ok.length) throw new Error(`Não achei ${naoAchei.map((n) => `*#${n}*`).join(', ')}. Veja os números com */lembretes*.`)

    let texto = ok.length === 1
      ? `✅ Feito: *${ok[0].texto}*`
      : `✅ ${ok.length} concluídos:\n${ok.map((i) => `▸ ${i.texto}`).join('\n')}`

    const recorrente = ok.find((i) => i.recorrencia)
    if (recorrente) texto += `\n\n_"${recorrente.texto}" volta ${descreverRecorrencia(recorrente.recorrencia)}._`
    if (naoAchei.length) texto += `\n\n⚠️ _Não achei: ${naoAchei.map((n) => `#${n}`).join(', ')}._`

    const restam = doDia(hojeISO()).filter((i) => !i.feito).length
    texto += restam ? `\n\n📋 Ainda faltam *${restam}* hoje.` : '\n\n🎉 Zerou o dia!'

    await sock.sendMessage(chatId, { text: texto }, { quoted: msg })
  },
}
