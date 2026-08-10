import { adicionar, buscar, remover, rotuloData } from '../lib/agenda.js'
import { getSettings } from '../lib/finance.js'
import { descreverRecorrencia, parseQuando } from '../lib/parseQuando.js'

const ajuda =
  '📝 *Anotar um compromisso ou tarefa*\n\n' +
  '▸ `/lembrete 18:30 treinar`\n' +
  '▸ `/lembrete amanhã 09:00 pagar faculdade`\n' +
  '▸ `/lembrete sexta 14h dentista`\n' +
  '▸ `/lembrete dia 12/09 20h show`\n' +
  '▸ `/lembrete em 30min tirar o bolo`\n' +
  '▸ `/lembrete comprar presente` _(tarefa de hoje, sem hora)_\n\n' +
  '*Que se repete:*\n' +
  '▸ `/lembrete todo dia 7h academia`\n' +
  '▸ `/lembrete toda segunda 19h inglês`\n' +
  '▸ `/lembrete dias úteis 6h30 correr`\n' +
  '▸ `/lembrete todo mês dia 10 pagar aluguel`\n\n' +
  '_`/lembretes` lista · `/feito 3` conclui · `/lembrete del 3` apaga._'

export default {
  name: 'lembrete',
  aliases: ['lembrar', 'lembra', 'tarefa', 'compromisso', 'anotar'],
  description: 'Anota um compromisso ou tarefa: /lembrete amanhã 09:00 pagar faculdade',

  async run({ sock, msg, chatId, args }) {
    if (!args.length || /^(help|ajuda)$/i.test(args[0])) {
      return sock.sendMessage(chatId, { text: ajuda }, { quoted: msg })
    }

    // /lembrete del 3
    if (/^(del|apagar|remover|rm|cancelar)$/i.test(args[0])) {
      const num = Number(args[1])
      const item = buscar(num)
      if (!item) throw new Error(`Não achei o lembrete *#${args[1] ?? '?'}*. Veja os números com */lembretes*.`)
      await remover(num)
      return sock.sendMessage(chatId, { text: `🗑️ Apaguei *${item.texto}*.` }, { quoted: msg })
    }

    const r = parseQuando(args.join(' '))
    if (r.erro) throw new Error(`${r.erro === 'sem descrição' ? 'Faltou dizer o quê.' : 'Não entendi.'}\n\n${ajuda}`)

    const item = await adicionar(r)

    let quando = item.recorrencia
      ? `🔁 ${descreverRecorrencia(item.recorrencia)}`
      : `📅 ${rotuloData(item.data)}`
    if (item.hora) quando += ` às *${item.hora}*`

    let texto = `✅ Anotado: *${item.texto}*\n${quando}`
    if (r.dataImplicita && !item.hora) texto += '\n_Sem data nem hora, então marquei como tarefa de hoje._'
    if (!item.hora && !item.recorrencia) texto += '\n\n_Sem hora eu não te aviso na hora — vai aparecer no resumo da manhã._'
    texto += `\n\n_#${item.num} · \`/feito ${item.num}\` quando concluir._`

    if (!getSettings().donoJid) {
      texto += '\n\n⚠️ _Mande */relatorios* no chat onde você quer receber os avisos, senão eu anoto mas não te aviso._'
    }

    await sock.sendMessage(chatId, { text: texto }, { quoted: msg })
  },
}
