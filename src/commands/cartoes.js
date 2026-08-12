import { competenciaAtual, faturaOf, listCards, money } from '../lib/finance.js'

const mesBR = (ym) => {
  const [y, m] = ym.split('-')
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[Number(m) - 1] ?? m}/${y}`
}

export default {
  name: 'cartoes',
  aliases: ['cards'],
  resumo: 'faturas e vencimentos',
  description: 'Lista os cartões com a fatura atual e quanto falta pro vencimento',
  categoria: 'financeiro',
  dono: true,

  async run({ sock, msg, chatId }) {
    const cards = listCards()
    if (!cards.length) {
      throw new Error('Nenhum cartão cadastrado ainda. Use: */cartao add nubank fecha 3 vence 10*')
    }

    let texto = '💳 *Seus cartões*\n'
    for (const c of cards) {
      const f = faturaOf(c.key, competenciaAtual(c.key))
      const prazo = f.diasParaVencer == null ? '' :
        f.diasParaVencer > 0 ? ` — vence em *${f.diasParaVencer} dia${f.diasParaVencer > 1 ? 's' : ''}*` :
        f.diasParaVencer === 0 ? ' — vence *hoje* ⚠️' : ` — *venceu* há ${-f.diasParaVencer}d ⚠️`

      texto += `\n*${c.name}* (${mesBR(f.competencia)})${prazo}\n`
      texto += `  Fatura: *${money(f.total)}*`
      if (f.pago > 0) texto += ` · recebi ${money(f.pago)} · falta *${money(f.aberto)}*`
      if (c.limite) texto += `\n  Limite: ${money(c.limite)} (${Math.round((f.total / c.limite) * 100)}% usado)`
      if (f.pessoas.length) {
        texto += '\n' + f.pessoas.map((p) => `   ▸ ${p.name}: ${money(p.aberto)}`).join('\n')
      }
      texto += '\n'
    }

    texto += '\n_`/fatura nubank` para o detalhe · `/cobrar nubank` para avisar o pessoal._'
    await sock.sendMessage(chatId, { text: texto }, { quoted: msg })
  },
}
