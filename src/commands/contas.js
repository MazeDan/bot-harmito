import { allBalances, getAccounts, money } from '../lib/finance.js'

const mesBR = (ym) => {
  const [y, m] = ym.split('-')
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[Number(m) - 1] ?? m}/${y}`
}

export default {
  name: 'contas',
  aliases: ['saldos', 'resumo', 'deve'],
  description: 'Resumo geral: quanto cada um te deve + total por conta bancária',

  async run({ sock, msg, chatId }) {
    const pessoas = allBalances().filter((b) => Math.abs(b.saldo) > 0.001)
    const accounts = getAccounts()

    let texto = '📊 *Resumo financeiro*\n'

    // Pessoas que te devem
    if (pessoas.length) {
      const totalDevido = pessoas.reduce((s, b) => s + b.saldo, 0)
      texto += '\n👥 *Quem te deve:*\n'
      texto += pessoas.map((b) => `▸ ${b.name}: *${money(b.saldo)}*`).join('\n')
      texto += `\n_Total a receber: ${money(totalDevido)}_\n`
    } else {
      texto += '\n👥 Ninguém te deve nada no momento. ✅\n'
    }

    // Contas bancárias (saídas por mês)
    if (accounts.length) {
      texto += '\n🏦 *Contas bancárias (gastos por mês):*\n'
      for (const acc of accounts) {
        texto += `\n*${acc.name}*\n`
        texto += acc.months.map((m) => `  • ${mesBR(m.month)}: saiu *${money(m.saidas)}* (${m.count} lançamentos)`).join('\n')
      }
    } else {
      texto += '\n🏦 Nenhum extrato importado ainda. Me mande o *PDF do extrato* com o nome da conta na legenda.'
    }

    await sock.sendMessage(chatId, { text: texto }, { quoted: msg })
  },
}
