import { aleatorioDoDia, arroba, participantes, sortear } from '../lib/grupo.js'
import { RANKINGS, sortear1 } from '../lib/conteudo.js'

const MEDALHAS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣']

export default {
  name: 'ranking',
  aliases: ['top', 'podio', 'pódio'],
  description: 'Pódio do dia no grupo: /ranking [tema] — ex.: /ranking mais dorminhoco',
  categoria: 'grupo',

  async run({ sock, msg, chatId, text, ehGrupo }) {
    if (!ehGrupo) throw new Error('Esse é pra usar em grupo. 😄')

    const tema = text.replace(/^[/!.]\S+\s*/, '').trim() || sortear1(RANKINGS)

    const todos = await participantes(sock, chatId)
    const eu = (sock.user?.id || '').split(':')[0] + '@s.whatsapp.net'
    const elegiveis = todos.filter((p) => p !== eu)
    if (elegiveis.length < 2) throw new Error('Precisa de pelo menos 2 pessoas no grupo.')

    // pontuação fixa no dia: o ranking só muda amanhã
    const pontuados = elegiveis
      .map((p) => ({ jid: p, pontos: aleatorioDoDia(`${chatId}|${tema}|${p}`, 101) }))
      .sort((a, b) => b.pontos - a.pontos)
      .slice(0, Math.min(5, elegiveis.length))

    const linhas = pontuados.map((p, i) => `${MEDALHAS[i]} ${arroba(p.jid)} — *${p.pontos}%*`)

    await sock.sendMessage(
      chatId,
      {
        text: `🏆 *Ranking: ${tema}*\n\n${linhas.join('\n')}\n\n_Vale por hoje. Amanhã tem outro._`,
        mentions: pontuados.map((p) => p.jid),
      },
      { quoted: msg },
    )
    void sortear
  },
}
