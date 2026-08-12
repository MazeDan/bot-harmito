import { rodarFechamentos } from '../lib/cobranca.js'
import { getCard, getSettings, listCards } from '../lib/finance.js'

export default {
  name: 'fechamento',
  aliases: ['fechou'],
  resumo: 'prévia do aviso de fatura fechada',
  description: 'Mostra a prévia do aviso de fatura fechada: /fechamento nubank',
  categoria: 'financeiro',
  dono: true,

  async run({ sock, msg, chatId, args }) {
    const cartao = args[0]
    if (!cartao) {
      const lista = listCards().map((c) => `▸ *${c.name}* — fecha dia ${c.fechamento ?? '—'}`).join('\n')
      throw new Error(
        `Use: */fechamento nubank*\n\n${lista || '_Nenhum cartão cadastrado._'}\n\n` +
        '_No dia do fechamento eu mando esse aviso sozinho no chat marcado com /relatorios._',
      )
    }

    const c = getCard(cartao)
    if (!c) throw new Error(`Não achei o cartão *${cartao}*.`)

    // forcarCartao ignora o dia de hoje e não marca como já enviado
    const r = await rodarFechamentos({ forcarCartao: c.key })
    const resultado = r[0]
    if (!resultado) throw new Error(`O cartão *${c.name}* não tem dia de fechamento cadastrado. Use \`/cartao edit ${c.key} fecha 3\`.`)

    let texto = resultado.texto
    if (resultado.status !== 'enviado') {
      const aviso = {
        'sem-destino': '_Prévia. Mande */relatorios* no chat que deve receber o aviso automático._',
        offline: '_Prévia. O bot está sem conexão para enviar._',
        erro: `_Não consegui enviar: ${resultado.erro}_`,
      }[resultado.status]
      texto += `\n\n━━━━━━━━━━\n${aviso}`
      return sock.sendMessage(chatId, { text: texto }, { quoted: msg })
    }

    if (getSettings().donoJid !== chatId) {
      await sock.sendMessage(chatId, { text: '🔒 Aviso de fechamento enviado no chat marcado com */relatorios*.' }, { quoted: msg })
    }
  },
}
