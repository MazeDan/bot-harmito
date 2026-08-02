import { config } from '../config.js'
import { cobrar } from '../lib/cobranca.js'
import { money } from '../lib/finance.js'

const rotulo = {
  enviado: '✅ enviado',
  simulado: '🧪 simulado',
  quitado: '✔️ já quitado',
  'sem-telefone': '⚠️ sem telefone',
  offline: '🔌 bot offline',
  'limite-diario': '⏸️ limite da rodada',
  erro: '❌ erro',
}

export default {
  name: 'cobrar',
  aliases: ['cobranca', 'avisar'],
  description: 'Cobra quem deve num cartão: /cobrar nubank [2026-09] [real]',

  async run({ sock, msg, chatId, args }) {
    const cartao = args[0]
    if (!cartao) throw new Error('Use: */cobrar nubank*\n\n_Por padrão eu só **simulo** e te mostro as mensagens. Para enviar de verdade: `/cobrar nubank real`._')

    const comp = args.find((a) => /^\d{4}-\d{2}$/.test(a)) || null
    const real = args.some((a) => /^(real|enviar|vai)$/i.test(a))
    const dryRun = real ? false : config.cobranca.dryRun

    const r = await cobrar(cartao, { competencia: comp, dryRun })
    if (r.erro) throw new Error(r.erro)

    if (!r.resultados.length) {
      return sock.sendMessage(chatId, { text: `Ninguém tem lançamento na fatura de *${r.fatura.competencia}* do *${r.fatura.card}*.` }, { quoted: msg })
    }

    const linhas = r.resultados.map((x) => `▸ *${x.name}* — ${money(x.valor)} · ${rotulo[x.status] ?? x.status}`).join('\n')
    let texto = `${dryRun ? '🧪 *SIMULAÇÃO*' : '📤 *Cobrança enviada*'} — ${r.fatura.card} (${r.fatura.competencia})\n\n${linhas}`

    if (dryRun) {
      const previa = r.resultados.find((x) => x.texto)
      if (previa) texto += `\n\n📄 *Prévia da mensagem para ${previa.name}:*\n\n${previa.texto}`
      texto += '\n\n_Nada foi enviado. Para enviar de verdade: `/cobrar ' + cartao + ' real`._'
    }
    if (r.resultados.some((x) => x.status === 'sem-telefone')) {
      texto += '\n\n_Vincule os números com `/pessoa nome 11999998888`._'
    }

    await sock.sendMessage(chatId, { text: texto }, { quoted: msg })
  },
}
