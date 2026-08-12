import { PALAVRAS, normalizar, sortear1 } from '../lib/jogos.js'
import { arroba } from '../lib/grupo.js'

/** Um jogo por conversa */
const jogos = new Map()
const VALIDADE_MS = 20 * 60_000
const VIDAS = 6

const BONECO = [
  '```\n ┌───┐\n │   │\n │\n │\n │\n═╧═\n```',
  '```\n ┌───┐\n │   │\n │   😐\n │\n │\n═╧═\n```',
  '```\n ┌───┐\n │   │\n │   😕\n │   │\n │\n═╧═\n```',
  '```\n ┌───┐\n │   │\n │   😟\n │  /│\n │\n═╧═\n```',
  '```\n ┌───┐\n │   │\n │   😧\n │  /│\\\n │\n═╧═\n```',
  '```\n ┌───┐\n │   │\n │   😨\n │  /│\\\n │  /\n═╧═\n```',
  '```\n ┌───┐\n │   │\n │   💀\n │  /│\\\n │  / \\\n═╧═\n```',
]

function painel(j) {
  const mostrado = [...j.palavra].map((c) => (j.acertos.includes(c) ? c : '_')).join(' ')
  const erradas = j.erros.length ? `\n❌ Erradas: ${j.erros.join(' ')}` : ''
  const vidas = '❤️'.repeat(VIDAS - j.erros.length) + '🖤'.repeat(j.erros.length)
  return `${BONECO[j.erros.length]}\n🔤 \`${mostrado}\`\n💡 Dica: _${j.dica}_\n${vidas}${erradas}`
}

export default {
  name: 'forca',
  aliases: ['jogodaforca'],
  description: 'Jogo da forca. /forca começa, /forca a chuta uma letra, /forca abacaxi chuta a palavra',
  categoria: 'jogos',

  async run({ sock, msg, chatId, userId, args }) {
    const jogo = jogos.get(chatId)
    const expirou = jogo && Date.now() - jogo.em > VALIDADE_MS
    if (expirou) jogos.delete(chatId)

    const palpite = normalizar(args.join(' ')).replace(/\s/g, '')

    // ---- começar ----
    if (!palpite) {
      if (jogo && !expirou) {
        return sock.sendMessage(chatId, { text: `🎯 *Já tem forca rolando!*\n\n${painel(jogo)}\n\n_Chute com_ \`/forca a\`_._` }, { quoted: msg })
      }
      const [palavra, dica] = sortear1(PALAVRAS)
      const novo = { palavra, dica, acertos: [], erros: [], em: Date.now(), participantes: new Set() }
      jogos.set(chatId, novo)
      return sock.sendMessage(chatId, {
        // nada de exemplo com as letras da palavra: entregaria o jogo
        text: `🪢 *JOGO DA FORCA*\n\n${painel(novo)}\n\n_Chute uma letra com_ \`/forca a\`\n_Ou arrisque a palavra inteira:_ \`/forca abacaxi\``,
      }, { quoted: msg })
    }

    if (!jogo || expirou) throw new Error('Não tem forca rolando. Comece com */forca*.')
    if (!/^[A-Z]+$/.test(palpite)) throw new Error('Só letras, sem número nem símbolo. 🙂')

    jogo.participantes.add(userId)

    // ---- chute da palavra inteira ----
    if (palpite.length > 1) {
      if (palpite === jogo.palavra) {
        jogos.delete(chatId)
        return sock.sendMessage(chatId, {
          text: `🎉 *ACERTOU DE PRIMEIRA!*\n\nA palavra era *${jogo.palavra}*.\n\n${arroba(userId)} matou a charada. 👏`,
          mentions: [userId],
        }, { quoted: msg })
      }
      jogo.erros.push('•')
      if (jogo.erros.length >= VIDAS) {
        jogos.delete(chatId)
        return sock.sendMessage(chatId, { text: `💀 *ENFORCOU!*\n\nA palavra era *${jogo.palavra}*.\n\nChute errado: _${palpite}_` }, { quoted: msg })
      }
      return sock.sendMessage(chatId, { text: `❌ Não é *${palpite}*.\n\n${painel(jogo)}` }, { quoted: msg })
    }

    // ---- chute de letra ----
    if (jogo.acertos.includes(palpite) || jogo.erros.includes(palpite)) {
      return sock.sendMessage(chatId, { text: `🔁 A letra *${palpite}* já foi tentada.\n\n${painel(jogo)}` }, { quoted: msg })
    }

    if (jogo.palavra.includes(palpite)) {
      jogo.acertos.push(palpite)
      const ganhou = [...jogo.palavra].every((c) => jogo.acertos.includes(c))
      if (ganhou) {
        jogos.delete(chatId)
        return sock.sendMessage(chatId, {
          text: `🎉 *VOCÊS VENCERAM!*\n\nA palavra era *${jogo.palavra}*.\n\nÚltima letra por ${arroba(userId)} · ${jogo.participantes.size} pessoa(s) jogaram.`,
          mentions: [userId],
        }, { quoted: msg })
      }
      return sock.sendMessage(chatId, { text: `✅ Tem *${palpite}* sim!\n\n${painel(jogo)}` }, { quoted: msg })
    }

    jogo.erros.push(palpite)
    if (jogo.erros.length >= VIDAS) {
      jogos.delete(chatId)
      return sock.sendMessage(chatId, { text: `${BONECO[VIDAS]}\n💀 *ENFORCOU!*\n\nA palavra era *${jogo.palavra}*.\n_Dica era: ${jogo.dica}_` }, { quoted: msg })
    }

    await sock.sendMessage(chatId, { text: `❌ Não tem *${palpite}*.\n\n${painel(jogo)}` }, { quoted: msg })
  },
}
