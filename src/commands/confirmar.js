import { money } from '../lib/finance.js'
import { aplicarLote, pendentes } from './lote.js'

const VALIDADE_MS = 10 * 60 * 1000

export default {
  name: 'confirmar',
  aliases: ['ok', 'confirma'],
  resumo: 'confirma o lote pendente',
  description: 'Confirma o último lote de lançamentos enviado com /lote',
  categoria: 'financeiro',
  dono: true,

  async run({ sock, msg, chatId, userId }) {
    const p = pendentes.get(userId)
    if (!p) throw new Error('Não tem nenhum lote esperando confirmação. Use */lote* primeiro.')
    if (Date.now() - p.criadoEm > VALIDADE_MS) {
      pendentes.delete(userId)
      throw new Error('Esse lote expirou (mais de 10 min). Mande o */lote* de novo.')
    }

    pendentes.delete(userId)
    const criados = await aplicarLote(p.itens)

    await sock.sendMessage(
      chatId,
      {
        text:
          `✅ *${p.itens.length} lançamento${p.itens.length > 1 ? 's' : ''} gravado${p.itens.length > 1 ? 's' : ''}* ` +
          `(${criados.length} parcela${criados.length > 1 ? 's' : ''} no total).\n\n💸 Total: *${money(p.total)}*\n\n_Veja com_ */cartoes* _ou_ */contas*.`,
      },
      { quoted: msg },
    )
  },
}
