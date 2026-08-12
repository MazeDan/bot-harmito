import { commands } from '../handler.js'
import { getSettings } from '../lib/finance.js'
import { ehGrupo as chatEhGrupo, permitido } from '../lib/grupos.js'

/** Ordem, ícone e frase de cada seção */
const SECOES = [
  ['diversao', '🎲', 'Diversão', 'pra quando o grupo esfriar'],
  ['jogos', '🕹️', 'Jogos', 'tem gente que leva a sério demais'],
  ['grupo', '👥', 'Grupo', 'ferramentas de administração'],
  ['midia', '🖼️', 'Figurinhas & mídia', 'transformo quase tudo'],
  ['fe', '🙏', 'Fé', 'a liturgia de cada dia'],
  ['utilidades', '🔧', 'Utilidades', 'as coisas úteis do dia a dia'],
  ['financeiro', '💳', 'Financeiro', 'só suas, no privado'],
  ['agenda', '📅', 'Agenda', 'pra não esquecer nada'],
]

const APELIDO = Object.fromEntries(SECOES.map(([id, , nome]) => [id, nome.toLowerCase()]))

const semAcento = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Saudação conforme a hora — pequeno, mas dá vida */
function saudacao() {
  const h = new Date().getHours()
  if (h < 5) return ['🌙', 'Boa madrugada', 'ainda de pé, hein?']
  if (h < 12) return ['☀️', 'Bom dia', 'bora resolver o dia']
  if (h < 18) return ['🌤️', 'Boa tarde', 'no que eu ajudo?']
  return ['🌙', 'Boa noite', 'às ordens']
}

/** Dica aleatória no rodapé, pra ir ensinando os comandos aos poucos */
const DICAS = [
  'manda uma foto com a legenda `/f` que eu devolvo figurinha — quadrada e inteira',
  '`/f i` faz só a figurinha inteira, sem cortar nada',
  '`/enquete Vamos sair? | sim | não` cria enquete de verdade, dessas de votar',
  '`/quem vai pagar a conta?` decide por vocês, e não tem recurso',
  'responda um vídeo com `/audio voz` que eu devolvo como mensagem de voz',
  '`/menu jogos` mostra o que cada jogo faz',
  '`/ranking` sai um pódio novo todo dia',
  '`/sorteio pizza, sushi, hambúrguer` resolve o almoço',
  '`/forca` tem palavra nova toda rodada',
  '`/calc 1500*0.13` faz a conta sem sair do zap',
  '`/cotacao dolar` traz o câmbio de agora',
  '`/racha 180 4` divide a conta do rolê',
  '`/clima Salvador` diz se vai chover',
  '`/horario` mostra minha hora e quando cada rotina dispara',
]

export default {
  name: 'menu',
  aliases: ['help', 'ajuda', 'comandos', 'oi'],
  description: 'Mostra tudo que eu sei fazer aqui (/menu jogos detalha uma seção)',
  categoria: 'utilidades',
  sempre: true, // nunca é bloqueado por configuração de grupo

  async run({ sock, msg, chatId, userId, args }) {
    const unicos = [...new Set(commands.values())]
    const dono = getSettings().donoUser
    const souDono = !dono || userId === dono
    const emGrupo = chatEhGrupo(chatId)

    // só aparece o que a pessoa realmente consegue usar neste chat
    const visiveis = unicos.filter((c) => (c.dono ? souDono && !emGrupo : permitido(c, chatId).ok))
    const daSecao = (id) =>
      visiveis.filter((c) => (c.categoria ?? 'utilidades') === id).sort((a, b) => a.name.localeCompare(b.name))

    // ---- /menu jogos → detalha uma seção ----
    const filtro = semAcento((args[0] || '').toLowerCase())
    if (filtro) {
      const alvo = SECOES.find(([id]) => id.startsWith(filtro) || semAcento(APELIDO[id]).startsWith(filtro))
      if (!alvo) {
        throw new Error(
          `Não conheço a seção *${args[0]}*. 🤔\n\n` +
          `Tenho estas:\n${SECOES.map(([id, ic, nome]) => `${ic} ${nome.toLowerCase()}`).join('\n')}`,
        )
      }
      const [id, icone, nome, frase] = alvo
      const lista = daSecao(id)
      if (!lista.length) throw new Error(`Nada de *${nome.toLowerCase()}* liberado neste chat. 🚫`)

      return sock.sendMessage(chatId, {
        text:
          `${icone} *${nome.toUpperCase()}*\n_${frase}_\n` +
          `━━━━━━━━━━━━━━━\n\n` +
          lista.map((c) => `*/${c.name}*\n${c.description}`).join('\n\n') +
          `\n\n━━━━━━━━━━━━━━━\n_${lista.length} comando(s) nesta seção._`,
      }, { quoted: msg })
    }

    // ---- menu completo ----
    const [emoji, ola, complemento] = saudacao()

    let texto = `${emoji} *${ola}!* Eu sou o *Harmito*.\n_${complemento}_\n`
    texto += '━━━━━━━━━━━━━━━\n'

    for (const [id, icone, nome] of SECOES) {
      const lista = daSecao(id)
      if (!lista.length) continue
      texto += `\n${icone} *${nome}*\n${lista.map((c) => `/${c.name}`).join(' · ')}\n`
    }

    texto += '\n━━━━━━━━━━━━━━━\n'

    texto += `📦 *${visiveis.length}* comandos por aqui`
    if (emGrupo) {
      // separa "não vale em grupo" de "o dono desligou aqui" — são coisas diferentes
      const bloqueadosNoGrupo = unicos.filter((c) => !c.dono && !permitido(c, chatId).ok).length
      if (bloqueadosNoGrupo) texto += ` · ${bloqueadosNoGrupo} desligados neste grupo`
    }
    texto += '\n'

    texto += `\n💡 _Dica: ${DICAS[Math.floor(Math.random() * DICAS.length)]}._`
    texto += '\n📂 _`/menu jogos` mostra o que cada um faz._'
    if (emGrupo) texto += '\n⚙️ _`/infogrupo` mostra o que está liberado aqui._'

    await sock.sendMessage(chatId, { text: texto }, { quoted: msg })
  },
}
