import { addPayment, money } from '../lib/finance.js'

export default {
  name: 'pagou',
  aliases: ['pago', 'pagar'],
  description: 'Registra um pagamento que a pessoa te fez: /pagou 22 danilo',

  async run({ sock, msg, chatId, args }) {
    const valor = Number(String(args[0] ?? '').replace(',', '.'))
    const pessoa = args[1]
    if (!valor || valor <= 0 || !pessoa) {
      throw new Error('Use assim: */pagou 50 danilo* (valor que a pessoa te pagou).')
    }

    const b = await addPayment(pessoa, valor)
    if (!b) throw new Error(`Não achei a conta de *${pessoa}*. Lance um item antes com /item.`)

    const situacao =
      b.saldo > 0 ? `Ainda te deve *${money(b.saldo)}*.` :
      b.saldo === 0 ? `Conta *zerada*! 🎉` :
      `Ficou *${money(-b.saldo)}* de crédito a favor dele(a).`

    await sock.sendMessage(
      chatId,
      { text: `✅ Recebi *${money(valor)}* de *${b.name}*.\n\n${situacao}` },
      { quoted: msg },
    )
  },
}
