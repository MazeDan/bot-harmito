import { balanceOf, money } from '../lib/finance.js'

const dataBR = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

export default {
  name: 'conta',
  aliases: ['extratopessoa', 'ver'],
  description: 'Mostra o extrato de uma pessoa: /conta danilo',

  async run({ sock, msg, chatId, args }) {
    const pessoa = args[0]
    if (!pessoa) throw new Error('Use assim: */conta danilo*')

    const b = balanceOf(pessoa)
    if (!b) throw new Error(`Não achei a conta de *${pessoa}*.`)

    const itens = b.items.map((i) => `▸ ${dataBR(i.at)} — ${money(i.value)}${i.note ? ` (${i.note})` : ''}`).join('\n') || '—'
    const pagtos = b.payments.length
      ? '\n\n💵 *Pagou:*\n' + b.payments.map((p) => `▸ ${dataBR(p.at)} — ${money(p.value)}`).join('\n')
      : ''

    await sock.sendMessage(
      chatId,
      {
        text:
          `📒 *Conta de ${b.name}*\n\n🧾 *Lançamentos:*\n${itens}${pagtos}\n\n` +
          `Total lançado: ${money(b.totalItems)}\n` +
          `Total pago: ${money(b.totalPaid)}\n` +
          `━━━━━━━━━━\n💰 *Deve: ${money(b.saldo)}*`,
      },
      { quoted: msg },
    )
  },
}
