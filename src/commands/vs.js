import { arroba, mencionados, participantes, sortear } from '../lib/grupo.js'
import { DUELOS, sortear1 } from '../lib/conteudo.js'

export default {
  name: 'vs',
  aliases: ['duelo', 'briga'],
  description: 'Duelo entre dois: /vs @fulano @beltrano (ou /vs @fulano)',
  categoria: 'grupo',

  async run({ sock, msg, chatId, userId, ehGrupo }) {
    if (!ehGrupo) throw new Error('Esse é pra usar em grupo. 😄')

    let [a, b] = mencionados(msg)
    // /vs @fulano → você contra ele
    if (a && !b) { b = a; a = userId }
    // /vs sem ninguém → sorteia dois
    if (!a) {
      const todos = await participantes(sock, chatId)
      const eu = (sock.user?.id || '').split(':')[0] + '@s.whatsapp.net'
      const elegiveis = todos.filter((p) => p !== eu)
      if (elegiveis.length < 2) throw new Error('Marque dois: */vs @fulano @beltrano*')
      ;[a, b] = sortear(elegiveis, 2)
    }
    if (a === b) throw new Error('Precisa ser gente diferente. 😅')

    const forcaA = Math.floor(Math.random() * 101)
    const forcaB = Math.floor(Math.random() * 101)
    const vencedor = forcaA >= forcaB ? a : b
    const perdedor = vencedor === a ? b : a

    const narracao = sortear1(DUELOS)
      .replace('{a}', arroba(vencedor))
      .replace('{b}', arroba(perdedor))

    await sock.sendMessage(
      chatId,
      {
        text:
          `⚔️ *DUELO*\n\n${arroba(a)} — *${forcaA}*\n${arroba(b)} — *${forcaB}*\n\n` +
          `🏆 Vitória de ${arroba(vencedor)}!\n_${narracao}_`,
        mentions: [a, b],
      },
      { quoted: msg },
    )
  },
}
