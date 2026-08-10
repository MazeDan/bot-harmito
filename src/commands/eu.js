import { getPerson, getSettings, listPeople, minhaParte, money, setSettings } from '../lib/finance.js'

const mesBR = (ym) => {
  const [y, m] = String(ym).split('-')
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[Number(m) - 1] ?? m}/${y}`
}
const dataBR = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

export default {
  name: 'eu',
  aliases: ['minhaparte', 'souEu'],
  description: 'Marca quem é você e mostra quanto da fatura é seu: /eu danilo',
  categoria: 'financeiro',
  dono: true,

  async run({ sock, msg, chatId, args }) {
    // /eu danilo  → marca
    if (args[0]) {
      if (/^(nao|não|limpar|nenhum)$/i.test(args[0])) {
        await setSettings({ eu: '' })
        return sock.sendMessage(chatId, { text: '✅ Desmarquei. Agora nenhuma pessoa é "você".' }, { quoted: msg })
      }
      if (!getPerson(args[0])) {
        const nomes = listPeople().map((p) => p.name).join(', ') || 'nenhuma pessoa cadastrada'
        throw new Error(`Não achei *${args[0]}*.\n\nPessoas: _${nomes}_`)
      }
      const s = await setSettings({ eu: args[0] })
      const p = getPerson(s.eu)
      return sock.sendMessage(
        chatId,
        { text: `🫵 Beleza, *${p.name}* é você.\n\n_Seus gastos não entram mais em "a receber" e você nunca é cobrado(a) — mas continuam contando no total da fatura._` },
        { quoted: msg },
      )
    }

    // /eu  → mostra a sua parte
    if (!getSettings().eu) {
      const nomes = listPeople().map((p) => p.name).join(', ') || 'nenhuma pessoa cadastrada'
      throw new Error(`Você ainda não me disse quem é você.\n\nUse: */eu danilo*\n\nPessoas: _${nomes}_`)
    }

    const mp = minhaParte()
    const nome = getPerson(getSettings().eu)?.name ?? 'Você'

    if (!mp.total) {
      return sock.sendMessage(chatId, { text: `👤 *${nome}* — você não tem nenhum gasto nas faturas deste mês. 🎉` }, { quoted: msg })
    }

    let texto = `👤 *Minha parte* — ${nome}\n`
    for (const c of mp.porCartao) {
      texto += `\n💳 *${c.card}* (${mesBR(c.competencia)})`
      if (c.vencimento) texto += ` — vence ${new Date(c.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}`
      texto += '\n'
      texto += c.itens
        .map((i) => `  ▸ ${dataBR(i.at)} ${money(i.value)}${i.note ? ` — ${i.note}` : ''}${i.parcela ? ` [${i.parcela.n}/${i.parcela.total}]` : ''}`)
        .join('\n')
      texto += `\n  _subtotal: ${money(c.total)}`
      if (c.pago) texto += ` · já paguei ${money(c.pago)} · falta ${money(Math.max(c.falta, 0))}`
      texto += '_\n'
    }
    if (mp.semCartao.total > 0) texto += `\n💸 *Sem cartão*: ${money(mp.semCartao.total)}\n`

    texto += `\n━━━━━━━━━━\nTotal lançado: ${money(mp.total)}\n`
    if (mp.pago) texto += `Já paguei: ${money(mp.pago)}\n`
    texto += `💰 *Ainda tenho que pagar: ${money(Math.max(mp.aPagar, 0))}*`

    await sock.sendMessage(chatId, { text: texto }, { quoted: msg })
  },
}
