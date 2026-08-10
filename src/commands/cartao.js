import { deleteCard, getCard, listCards, money, upsertCard } from '../lib/finance.js'

const ajuda =
  '💳 *Cartões*\n\n' +
  '▸ `/cartao add nubank fecha 3 vence 10 limite 5000`\n' +
  '▸ `/cartao edit nubank vence 12`\n' +
  '▸ `/cartao del nubank`\n' +
  '▸ `/cartoes` — lista tudo'

/** Lê pares "chave valor" soltos: fecha 3 vence 10 limite 5000 */
function lerOpcoes(args) {
  const o = {}
  for (let i = 0; i < args.length; i++) {
    const a = args[i].toLowerCase()
    const v = args[i + 1]
    if (/^(fecha|fechamento)$/.test(a)) { o.fechamento = Number(v); i++ }
    else if (/^(vence|vencimento)$/.test(a)) { o.vencimento = Number(v); i++ }
    else if (/^(limite)$/.test(a)) { o.limite = Number(String(v).replace(/\./g, '').replace(',', '.')); i++ }
    else if (/^(cor)$/.test(a)) { o.cor = v; i++ }
  }
  return o
}

export default {
  name: 'cartao',
  aliases: ['card'],
  description: 'Cadastra e edita cartões: /cartao add nubank fecha 3 vence 10',
  categoria: 'financeiro',
  dono: true,

  async run({ sock, msg, chatId, args }) {
    const acao = (args[0] || '').toLowerCase()
    const nome = args[1]

    if (!acao || acao === 'help') return sock.sendMessage(chatId, { text: ajuda }, { quoted: msg })

    if (acao === 'del' || acao === 'remove' || acao === 'rm') {
      if (!nome) throw new Error('Use: */cartao del nubank*')
      const ok = await deleteCard(nome)
      return sock.sendMessage(chatId, { text: ok ? `🗑️ Cartão *${nome}* removido (os gastos ficaram sem cartão).` : `Não achei o cartão *${nome}*.` }, { quoted: msg })
    }

    if (acao !== 'add' && acao !== 'edit' && acao !== 'set') throw new Error(ajuda)
    if (!nome) throw new Error('Faltou o nome do cartão. Ex.: */cartao add nubank fecha 3 vence 10*')

    const existia = Boolean(getCard(nome))
    const c = await upsertCard(nome, lerOpcoes(args.slice(2)))

    await sock.sendMessage(chatId, {
      text:
        `${existia ? '✏️ Atualizei' : '✅ Cadastrei'} o cartão *${c.name}*\n\n` +
        `📆 Fecha dia: *${c.fechamento ?? '—'}*\n` +
        `📅 Vence dia: *${c.vencimento ?? '—'}*\n` +
        `💳 Limite: *${c.limite ? money(c.limite) : '—'}*\n\n` +
        (c.fechamento ? '' : '_Dica: sem o dia de fechamento eu não sei em qual fatura jogar cada compra. Rode `/cartao edit ' + c.name + ' fecha 3`._'),
    }, { quoted: msg })

    if (!listCards().length) return
  },
}
