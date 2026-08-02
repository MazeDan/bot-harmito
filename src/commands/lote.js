import { addExpense, getCard, money } from '../lib/finance.js'
import { parseLote } from '../lib/parseLancamento.js'

/** Lotes aguardando confirmação, por usuário */
export const pendentes = new Map()

/** Grava um lote já parseado. Usado pelo /confirmar e pelo painel web. */
export async function aplicarLote(itens) {
  const criados = []
  for (const it of itens) {
    const c = await addExpense({ ...it, person: it.pessoa })
    if (c) criados.push(...c)
  }
  return criados
}

const exemplo =
  'Mande assim (várias linhas, primeira linha = cartão padrão):\n\n' +
  '```\n/lote nubank\n22 danilo lanche\n35,90 maria uber\n300 joao 3x tenis\n18 ana #inter 12/07\n```'

export default {
  name: 'lote',
  aliases: ['lancar-lote', 'batch'],
  description: 'Lança vários gastos de uma vez (mensagem de várias linhas)',

  async run({ sock, msg, chatId, userId, text }) {
    // tudo depois da primeira linha do comando é o corpo do lote
    const linhas = text.split(/\r?\n/)
    const primeira = linhas[0].trim().split(/\s+/).slice(1) // remove "/lote"
    const cartaoPadrao = primeira.length ? primeira.join(' ').replace(/^#/, '') : null
    const corpo = linhas.slice(1).join('\n')

    if (!corpo.trim()) throw new Error(exemplo)

    const r = parseLote(corpo, { cartaoPadrao })
    if (!r.ok.length) {
      throw new Error(`Não consegui ler nenhuma linha.\n\n${exemplo}`)
    }

    // valida cartões citados
    const cartoesInvalidos = [...new Set(r.ok.map((i) => i.card).filter((c) => c && !getCard(c)))]

    let preview = r.ok.map((i, n) => {
      const parc = i.parcelas > 1 ? ` (${i.parcelas}x)` : ''
      const card = i.card ? ` · ${getCard(i.card)?.name ?? i.card}` : ''
      const dia = new Date(i.at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      return `${String(n + 1).padStart(2, ' ')}. ${money(i.value)}${parc} → *${i.pessoa}*${i.note ? ` _(${i.note})_` : ''}${card} · ${dia}`
    }).join('\n')

    let texto = `🧾 *Confira o lote* (${r.ok.length} lançamento${r.ok.length > 1 ? 's' : ''})\n\n${preview}\n\n━━━━━━━━━━\n💸 Total: *${money(r.total)}*`

    if (r.erros.length) {
      texto += `\n\n⚠️ *Não entendi ${r.erros.length} linha(s):*\n` + r.erros.map((e) => `▸ \`${e.linha}\` — ${e.erro}`).join('\n')
    }
    if (cartoesInvalidos.length) {
      texto += `\n\n⚠️ Cartão não cadastrado: *${cartoesInvalidos.join(', ')}* — vou lançar sem cartão. Cadastre com \`/cartao add ${cartoesInvalidos[0]} fecha 3 vence 10\`.`
    }
    texto += '\n\n👉 Responda */confirmar* para gravar, ou */cancelar* para descartar.'

    pendentes.set(userId, { itens: r.ok, criadoEm: Date.now(), total: r.total })
    await sock.sendMessage(chatId, { text: texto }, { quoted: msg })
  },
}

