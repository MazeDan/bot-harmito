import { addExpense, balanceOf, getCard, money } from '../lib/finance.js'
import { parseLinha } from '../lib/parseLancamento.js'

const mesBR = (ym) => {
  const [y, m] = ym.split('-')
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[Number(m) - 1] ?? m}/${y}`
}

export default {
  name: 'gasto',
  aliases: ['item', 'lancar', 'add', 'compra'],
  resumo: 'lança um gasto',
  description: 'Lança um gasto: /gasto 22 danilo nubank lanche (aceita 3x e data 12/07)',
  categoria: 'financeiro',
  dono: true,

  async run({ sock, msg, chatId, args }) {
    // o cartão pode vir como #nubank ou como uma palavra que bate com um cartão cadastrado
    const semCartao = []
    let cartao = null
    for (const a of args) {
      if (!cartao && !a.startsWith('#') && getCard(a)) { cartao = a; continue }
      semCartao.push(a)
    }

    const r = parseLinha(semCartao.join(' '), { cartaoPadrao: cartao })
    if (!r || r.erro) {
      throw new Error(
        'Use assim: */gasto 22 danilo nubank lanche*\n\n' +
        '▸ parcelado: `/gasto 300 danilo nubank 3x tênis`\n' +
        '▸ com data: `/gasto 45 maria nubank 12/07 uber`\n' +
        '▸ sem cartão também vale: `/gasto 22 danilo lanche`',
      )
    }

    const created = await addExpense(r)
    const b = balanceOf(r.pessoa)
    const e = created[0]

    let texto = `✅ Lancei *${money(r.value)}* para *${b.name}*`
    if (r.note) texto += ` _(${r.note})_`
    if (e.card) texto += `\n💳 Cartão: *${getCard(e.card).name}* · fatura de *${mesBR(e.competencia)}*`
    if (created.length > 1) {
      texto += `\n🔁 Parcelado em *${created.length}x de ${money(e.value)}* — ` +
        `${mesBR(created[0].competencia)} até ${mesBR(created[created.length - 1].competencia)}`
    }
    texto += `\n\n💰 ${b.name} te deve no total: *${money(b.saldo)}*`

    await sock.sendMessage(chatId, { text: texto }, { quoted: msg })
  },
}
