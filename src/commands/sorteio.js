import { arroba, participantes } from '../lib/grupo.js'
import { sortear } from '../lib/grupo.js'

export default {
  name: 'sorteio',
  aliases: ['sortear', 'rifa'],
  description: 'Sorteia alguém do grupo: /sorteio [quantidade] — ou /sorteio a, b, c',
  categoria: 'grupo',

  async run({ sock, msg, chatId, args, text, ehGrupo }) {
    const corpo = text.replace(/^[/!.]\S+\s*/, '').trim()

    // /sorteio maçã, banana, uva → sorteia entre as opções escritas
    if (corpo.includes(',')) {
      const opcoes = corpo.split(',').map((o) => o.trim()).filter(Boolean)
      const [ganhador] = sortear(opcoes, 1)
      return sock.sendMessage(chatId, { text: `🎲 Sorteei entre ${opcoes.length} opções:\n\n🏆 *${ganhador}*` }, { quoted: msg })
    }

    if (!ehGrupo) throw new Error('Em conversa privada, me dê as opções: */sorteio pizza, hambúrguer, sushi*')

    const quantos = Math.max(1, Math.min(Number(args[0]) || 1, 10))
    const todos = await participantes(sock, chatId)
    const eu = (sock.user?.id || '').split(':')[0] + '@s.whatsapp.net'
    const elegiveis = todos.filter((p) => p !== eu)
    if (!elegiveis.length) throw new Error('Não consegui ver os participantes do grupo.')

    const ganhadores = sortear(elegiveis, Math.min(quantos, elegiveis.length))
    const texto = quantos === 1
      ? `🎉 O sorteado é...\n\n🏆 ${arroba(ganhadores[0])}`
      : `🎉 Sorteados (${ganhadores.length} de ${elegiveis.length}):\n\n${ganhadores.map((g, i) => `${i + 1}. ${arroba(g)}`).join('\n')}`

    await sock.sendMessage(chatId, { text, mentions: ganhadores }, { quoted: msg })
  },
}
