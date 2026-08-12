import { PALAVRAS, embaralhar, normalizar, sortear1 } from '../lib/jogos.js'
import { arroba } from '../lib/grupo.js'

const abertas = new Map()
const VALIDADE_MS = 5 * 60_000

export default {
  name: 'palavra',
  aliases: ['anagrama', 'embaralhada'],
  resumo: 'desembaralhe o anagrama',
  description: 'Desembaralhe a palavra: /palavra começa, /palavra abacaxi responde',
  categoria: 'jogos',

  async run({ sock, msg, chatId, userId, args }) {
    const aberta = abertas.get(chatId)
    const expirou = aberta && Date.now() - aberta.em > VALIDADE_MS
    if (expirou) abertas.delete(chatId)

    const palpite = normalizar(args.join(' ')).replace(/\s/g, '')

    if (!palpite) {
      if (aberta && !expirou) {
        return sock.sendMessage(chatId, {
          text: `⏳ Ainda tem uma aberta:\n\n🔠 \`${aberta.embaralhada}\`\n💡 _${aberta.dica}_`,
        }, { quoted: msg })
      }
      const [palavra, dica] = sortear1(PALAVRAS.filter((p) => p[0].length <= 11))
      abertas.set(chatId, { palavra, dica, embaralhada: embaralhar(palavra), em: Date.now(), erros: 0 })
      return sock.sendMessage(chatId, {
        text: `🔠 *DESEMBARALHE*\n\n\`${abertas.get(chatId).embaralhada}\`\n\n💡 Dica: _${dica}_ · ${palavra.length} letras\n\n_Responda com_ \`/palavra sua resposta\`_._`,
      }, { quoted: msg })
    }

    if (!aberta || expirou) throw new Error('Não tem nenhuma aberta. Comece com */palavra*.')

    if (/^(DESISTO|PASSO)$/.test(palpite)) {
      abertas.delete(chatId)
      return sock.sendMessage(chatId, { text: `🏳️ Era *${aberta.palavra}*.\n\n_Bora outra:_ \`/palavra\`` }, { quoted: msg })
    }

    if (palpite === aberta.palavra) {
      abertas.delete(chatId)
      return sock.sendMessage(chatId, {
        text: `🎉 *ACERTOU!* Era *${aberta.palavra}*.\n\n${arroba(userId)} desembaralhou${aberta.erros ? ` na ${aberta.erros + 1}ª tentativa do grupo` : ' de primeira'}. 🧠`,
        mentions: [userId],
      }, { quoted: msg })
    }

    aberta.erros++
    const quase = palpite.length === aberta.palavra.length
    await sock.sendMessage(chatId, {
      text: `❌ Não é *${palpite}*.${quase ? ' _(pelo menos o tamanho está certo)_' : ` _(a palavra tem ${aberta.palavra.length} letras)_`}\n\n🔠 \`${aberta.embaralhada}\` · 💡 _${aberta.dica}_`,
    }, { quoted: msg })
  },
}
