import { arroba, participantes, sortear } from '../lib/grupo.js'

export default {
  name: 'quem',
  aliases: ['quemvai'],
  description: 'Sorteia alguém para uma pergunta: /quem vai pagar a conta?',
  categoria: 'grupo',

  async run({ sock, msg, chatId, text, ehGrupo }) {
    if (!ehGrupo) throw new Error('Esse é pra usar em grupo. 😄')

    const pergunta = text.replace(/^[/!.]\S+\s*/, '').trim()
    if (!pergunta) throw new Error('Pergunte algo: */quem vai pagar a conta?*')

    const todos = await participantes(sock, chatId)
    const eu = (sock.user?.id || '').split(':')[0] + '@s.whatsapp.net'
    const elegiveis = todos.filter((p) => p !== eu)
    if (!elegiveis.length) throw new Error('Não consegui ver os participantes do grupo.')

    const [escolhido] = sortear(elegiveis, 1)
    const limpa = pergunta.replace(/\?+$/, '')

    await sock.sendMessage(
      chatId,
      { text: `🤔 *Quem ${limpa}?*\n\n👉 ${arroba(escolhido)}\n\n_A decisão do bot é final._`, mentions: [escolhido] },
      { quoted: msg },
    )
  },
}
