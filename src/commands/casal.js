import { aleatorioDoDia, arroba, participantes, sortear } from '../lib/grupo.js'

const CORACOES = ['💘', '💞', '💕', '❤️‍🔥', '💖']
const VEREDICTO = [
  [95, '👰🤵 Casem logo e me chamem pra festa.'],
  [80, '🔥 Isso aí tem futuro.'],
  [60, '😊 Dá namoro, com esforço.'],
  [40, '🤝 Melhor ficarem amigos.'],
  [20, '😬 Só se for o último casal na Terra.'],
  [0, '🧊 Nem no multiverso.'],
]

export default {
  name: 'casal',
  aliases: ['shipdodia', 'casaldodia'],
  description: 'Sorteia o casal do dia no grupo (o mesmo até amanhã)',
  categoria: 'jogos',

  async run({ sock, msg, chatId, ehGrupo }) {
    if (!ehGrupo) throw new Error('Esse é pra usar em grupo. 😄')

    const todos = await participantes(sock, chatId)
    const eu = (sock.user?.id || '').split(':')[0] + '@s.whatsapp.net'
    const elegiveis = todos.filter((p) => p !== eu)
    if (elegiveis.length < 2) throw new Error('Precisa de pelo menos 2 pessoas no grupo.')

    // escolha fixa no dia: o casal só muda amanhã
    const ordenados = elegiveis
      .map((p) => ({ p, n: aleatorioDoDia(`casal|${chatId}|${p}`, 100000) }))
      .sort((a, b) => a.n - b.n)
    const a = ordenados[0].p
    const b = ordenados[1].p

    const nota = aleatorioDoDia(`casal-nota|${chatId}`, 101)
    const [, frase] = VEREDICTO.find(([min]) => nota >= min)
    const coracao = CORACOES[aleatorioDoDia(`casal-cor|${chatId}`, CORACOES.length)]

    await sock.sendMessage(chatId, {
      text:
        `${coracao} *CASAL DO DIA* ${coracao}\n\n${arroba(a)}\n＋\n${arroba(b)}\n\n` +
        `Compatibilidade: *${nota}%*\n${frase}\n\n_Vale até amanhã. Não briguem._`,
      mentions: [a, b],
    }, { quoted: msg })
    void sortear
  },
}
