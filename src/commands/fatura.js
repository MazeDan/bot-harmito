import { competenciasDoCartao, faturaOf, listCards, money } from '../lib/finance.js'

const dataBR = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
const mesBR = (ym) => {
  const [y, m] = ym.split('-')
  const nomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  return `${nomes[Number(m) - 1] ?? m}/${y}`
}

export default {
  name: 'fatura',
  aliases: ['f'],
  description: 'Detalha a fatura de um cartão: /fatura nubank [2026-09]',
  categoria: 'financeiro',
  dono: true,

  async run({ sock, msg, chatId, args }) {
    const cartao = args[0]
    if (!cartao) {
      const nomes = listCards().map((c) => c.name).join(', ') || 'nenhum cartão cadastrado'
      throw new Error(`Use: */fatura nubank* — ou */fatura nubank 2026-09*\n\nCartões: _${nomes}_`)
    }

    const comp = args[1] && /^\d{4}-\d{2}$/.test(args[1]) ? args[1] : null
    const f = faturaOf(cartao, comp)
    if (!f) throw new Error(`Não achei o cartão *${cartao}*.`)

    let texto = `💳 *${f.card}* — fatura de *${mesBR(f.competencia)}*\n`
    if (f.vencimento) {
      const d = new Date(f.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')
      texto += `📅 Vence em *${d}*` +
        (f.diasParaVencer > 0 ? ` (faltam ${f.diasParaVencer}d)` : f.diasParaVencer === 0 ? ' (*hoje*)' : ` (*venceu* há ${-f.diasParaVencer}d)`) + '\n'
    }
    texto += `\n💸 Total: *${money(f.total)}*`
    if (f.pago > 0) texto += `\n💵 Recebido: ${money(f.pago)}\n🟠 Em aberto: *${money(f.aberto)}*`

    if (f.pessoas.length) {
      texto += '\n\n👥 *Por pessoa:*\n'
      for (const p of f.pessoas) {
        texto += `\n*${p.name}* — ${money(p.aberto)}${p.pago ? ` _(pagou ${money(p.pago)})_` : ''}\n`
        texto += p.items
          .sort((a, b) => a.at.localeCompare(b.at))
          .map((i) => `   ▸ ${dataBR(i.at)} ${money(i.value)}${i.note ? ` — ${i.note}` : ''}${i.parcela ? ` [${i.parcela.n}/${i.parcela.total}]` : ''}`)
          .join('\n')
      }
    } else {
      texto += '\n\n_Nenhum lançamento nessa fatura._'
    }

    const outras = competenciasDoCartao(cartao).filter((c) => c !== f.competencia).slice(0, 5)
    if (outras.length) texto += `\n\n_Outras faturas: ${outras.join(', ')}_`

    await sock.sendMessage(chatId, { text: texto }, { quoted: msg })
  },
}
