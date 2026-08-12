import { DETECTOR, sortear1 } from '../lib/jogos.js'
import { arroba, mencionados } from '../lib/grupo.js'

export default {
  name: 'detector',
  aliases: ['mentira', 'poligrafo'],
  resumo: 'detector de mentiras',
  description: 'Detector de mentiras: responda a uma mensagem com /detector',
  categoria: 'jogos',

  async run({ sock, msg, chatId, text }) {
    const [alvo] = mencionados(msg)
    const afirmacao = text.replace(/^[/!.]\S+\s*/, '').replace(/@\d+/g, '').trim()

    if (!alvo && !afirmacao) {
      throw new Error('Responda a uma mensagem com */detector* — ou escreva a afirmação: */detector eu não comi o bolo*')
    }

    const [veredicto, icone, comentario] = sortear1(DETECTOR)
    const confianca = 70 + Math.floor(Math.random() * 30)

    let texto = '🔍 *DETECTOR DE MENTIRAS*\n\n'
    if (afirmacao) texto += `_"${afirmacao.slice(0, 140)}"_\n\n`
    if (alvo) texto += `Analisando ${arroba(alvo)}...\n\n`
    texto += `${icone} *${veredicto}*\n_${comentario}_\n\n📊 Confiança do aparelho: *${confianca}%*`

    await sock.sendMessage(chatId, { text: texto, mentions: alvo ? [alvo] : [] }, { quoted: msg })
  },
}
