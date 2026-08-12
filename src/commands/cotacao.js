const MOEDAS = {
  dolar: ['USD-BRL', '💵', 'Dólar'],
  usd: ['USD-BRL', '💵', 'Dólar'],
  euro: ['EUR-BRL', '💶', 'Euro'],
  eur: ['EUR-BRL', '💶', 'Euro'],
  libra: ['GBP-BRL', '💷', 'Libra'],
  peso: ['ARS-BRL', '🇦🇷', 'Peso argentino'],
  bitcoin: ['BTC-BRL', '₿', 'Bitcoin'],
  btc: ['BTC-BRL', '₿', 'Bitcoin'],
  ethereum: ['ETH-BRL', 'Ξ', 'Ethereum'],
  eth: ['ETH-BRL', 'Ξ', 'Ethereum'],
}

const PADRAO = ['USD-BRL', 'EUR-BRL', 'BTC-BRL']

const real = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default {
  name: 'cotacao',
  aliases: ['cotação', 'dolar', 'cambio', 'moedas'],
  resumo: 'dólar, euro e bitcoin de hoje',
  description: 'Cotação do dia: /cotacao (dólar, euro e bitcoin) ou /cotacao libra',
  categoria: 'utilidades',

  async run({ sock, msg, chatId, args }) {
    const pedido = (args[0] || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const pares = MOEDAS[pedido] ? [MOEDAS[pedido][0]] : PADRAO

    if (pedido && !MOEDAS[pedido]) {
      throw new Error(`Não conheço *${args[0]}*.\n\nTenho: ${[...new Set(Object.values(MOEDAS).map((m) => m[2]))].join(', ')}.`)
    }

    let dados
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 12000)
      const res = await fetch(`https://economia.awesomeapi.com.br/last/${pares.join(',')}`, { signal: ctrl.signal })
      clearTimeout(t)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      dados = await res.json()
    } catch {
      throw new Error('Não consegui buscar a cotação agora. Tente daqui a pouco.')
    }

    const linhas = Object.values(dados).map((m) => {
      const info = Object.values(MOEDAS).find((x) => x[0] === `${m.code}-${m.codein}`)
      const icone = info?.[1] ?? '💱'
      const nome = info?.[2] ?? m.code
      const variacao = Number(m.pctChange)
      const seta = variacao > 0 ? '🔺' : variacao < 0 ? '🔻' : '➖'
      return (
        `${icone} *${nome}*\n` +
        `   ${real(m.bid)}  ${seta} ${variacao > 0 ? '+' : ''}${variacao.toFixed(2)}%\n` +
        `   _min ${real(m.low)} · máx ${real(m.high)}_`
      )
    })

    const quando = Object.values(dados)[0]?.create_date ?? ''
    await sock.sendMessage(chatId, {
      text: `💱 *Cotação*\n\n${linhas.join('\n\n')}\n\n_Atualizado em ${quando}._`,
    }, { quoted: msg })
  },
}
