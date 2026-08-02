import { addPayment, getCard, money } from '../lib/finance.js'

export default {
  name: 'pagou',
  aliases: ['pago', 'pagar', 'recebi'],
  description: 'Registra um pagamento recebido: /pagou 50 danilo [nubank]',

  async run({ sock, msg, chatId, args }) {
    const valor = Number(String(args[0] ?? '').replace(/\./g, '').replace(',', '.'))
    const pessoa = args[1]
    if (!valor || valor <= 0 || !pessoa) {
      throw new Error('Use assim: */pagou 50 danilo* — ou */pagou 50 danilo nubank* para abater de um cartão específico.')
    }

    const cartao = args[2] && getCard(args[2]) ? args[2] : null
    const b = await addPayment(pessoa, valor, { card: cartao })
    if (!b) throw new Error(`Não achei a conta de *${pessoa}*. Lance um gasto antes com */gasto*.`)

    const situacao =
      b.saldo > 0.009 ? `Ainda te deve *${money(b.saldo)}*.` :
      Math.abs(b.saldo) <= 0.009 ? 'Conta *zerada*! 🎉' :
      `Ficou *${money(-b.saldo)}* de crédito a favor dele(a).`

    await sock.sendMessage(
      chatId,
      { text: `✅ Recebi *${money(valor)}* de *${b.name}*${cartao ? ` (cartão *${getCard(cartao).name}*)` : ''}.\n\n${situacao}` },
      { quoted: msg },
    )
  },
}
