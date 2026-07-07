import { addItem, money } from '../lib/finance.js'

export default {
  name: 'item',
  aliases: ['lancar', 'add'],
  description: 'Lança um valor na conta de alguém: /item 22 danilo [obs]',

  async run({ sock, msg, chatId, args }) {
    // /item 22 danilo lanche  →  valor=22, pessoa=danilo, obs=lanche
    const valor = Number(String(args[0] ?? '').replace(',', '.'))
    const pessoa = args[1]
    const obs = args.slice(2).join(' ')

    if (!valor || valor <= 0 || !pessoa) {
      throw new Error('Use assim: */item 22 danilo* (valor e nome). Pode add uma obs: /item 22 danilo lanche')
    }

    const b = await addItem(pessoa, valor, obs)
    await sock.sendMessage(
      chatId,
      {
        text:
          `✅ Lancei *${money(valor)}* na conta de *${b.name}*` +
          (obs ? ` _(${obs})_` : '') +
          `.\n\n💰 ${b.name} te deve agora: *${money(b.saldo)}*`,
      },
      { quoted: msg },
    )
  },
}
