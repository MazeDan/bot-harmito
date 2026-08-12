import { arroba, mencionados } from '../lib/grupo.js'

const real = (v) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const numero = (t) => Number(String(t).replace(/[r$\s]/gi, '').replace(/\./g, '').replace(',', '.'))

export default {
  name: 'racha',
  aliases: ['dividir', 'rachar', 'vaquinha'],
  description: 'Divide a conta: /racha 180 4 — ou /racha 180 10% para incluir a gorjeta',
  categoria: 'utilidades',

  async run({ sock, msg, chatId, args, text }) {
    const marcados = mencionados(msg)
    const numeros = args.filter((a) => /^r?\$?\s*[\d.,]+$/i.test(a)).map(numero).filter((n) => n > 0)
    const gorjeta = args.find((a) => /^\d{1,2}%$/.test(a))

    const total = numeros[0]
    if (!total) {
      throw new Error(
        'Quanto e entre quantos?\n\n' +
        '▸ `/racha 180 4` — R$180 entre 4 pessoas\n' +
        '▸ `/racha 180 4 10%` — com 10% de gorjeta\n' +
        '▸ `/racha 180 @fulano @beltrano` — divide entre os marcados',
      )
    }

    const pessoas = marcados.length ? marcados.length + 1 : Math.round(numeros[1] ?? 0)
    if (!pessoas || pessoas < 1) throw new Error('Entre quantas pessoas? Ex.: */racha 180 4*')
    if (pessoas > 100) throw new Error('Cem pessoas? Aí já é evento. 😅')

    const taxa = gorjeta ? Number(gorjeta.replace('%', '')) : 0
    // arredonda o total antes de dividir: 180*1,1 dá 198.00000000000003 em float,
    // e sem isso o "pra cima" cobraria um centavo a mais de cada um
    const comTaxa = Math.round(total * (1 + taxa / 100) * 100) / 100
    const cada = comTaxa / pessoas

    // cada um paga o centavo pra cima; a diferença vira troco
    const cadaArredondado = Math.ceil(cada * 100 - 1e-6) / 100
    const sobra = Math.round((cadaArredondado * pessoas - comTaxa) * 100) / 100

    let texto = `🧾 *Racha da conta*\n\n`
    texto += `Total: *${real(total)}*\n`
    if (taxa) texto += `Gorjeta ${taxa}%: ${real(comTaxa - total)}\n➡️ Com taxa: *${real(comTaxa)}*\n`
    texto += `Pessoas: *${pessoas}*\n\n━━━━━━━━━━\n💸 *Cada um paga ${real(cadaArredondado)}*`
    if (sobra > 0.001) texto += `\n_(sobram ${real(sobra)} de troco no arredondamento)_`

    if (marcados.length) {
      texto += `\n\n👥 ${marcados.map((m) => arroba(m)).join(' ')} _e quem mandou_`
    }

    await sock.sendMessage(chatId, { text: texto, mentions: marcados }, { quoted: msg })
    void text
  },
}
