import { commands } from '../handler.js'
import { getSettings } from '../lib/finance.js'
import { ehGrupo as chatEhGrupo, permitido } from '../lib/grupos.js'

/** Ordem e rótulo das seções do menu */
const SECOES = [
  ['diversao', '🎲 Diversão'],
  ['grupo', '👥 Grupo'],
  ['midia', '🖼️ Figurinhas e mídia'],
  ['utilidades', '🔧 Utilidades'],
  ['financeiro', '💳 Financeiro'],
  ['agenda', '📅 Agenda'],
]

const APELIDO = {
  financeiro: 'financeiro', agenda: 'agenda', diversao: 'diversão',
  grupo: 'grupo', midia: 'mídia', utilidades: 'utilidades',
}

const semAcento = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')

export default {
  name: 'menu',
  aliases: ['help', 'ajuda', 'comandos'],
  description: 'Mostra os comandos disponíveis (/menu diversão para detalhar uma seção)',
  categoria: 'utilidades',
  sempre: true, // nunca é bloqueado por configuração de grupo

  async run({ sock, msg, chatId, userId, args }) {
    const unicos = [...new Set(commands.values())]
    const dono = getSettings().donoUser
    const souDono = !dono || userId === dono
    const emGrupo = chatEhGrupo(chatId)

    // mostra só o que a pessoa realmente consegue usar aqui
    const visiveis = unicos.filter((c) => (c.dono ? souDono && !emGrupo : permitido(c, chatId).ok))

    // /menu diversão → só aquela seção, com a descrição completa
    const filtro = semAcento((args[0] || '').toLowerCase())
    if (filtro) {
      const alvo = SECOES.find(([id]) => id.startsWith(filtro) || semAcento(APELIDO[id]).startsWith(filtro))
      if (!alvo) throw new Error(`Seção não encontrada.\n\nTente: ${SECOES.map(([id]) => `*${APELIDO[id]}*`).join(', ')}`)

      const [id, titulo] = alvo
      const lista = visiveis.filter((c) => (c.categoria ?? 'utilidades') === id).sort((a, b) => a.name.localeCompare(b.name))
      if (!lista.length) throw new Error(`Nada de *${APELIDO[id]}* liberado neste chat.`)

      return sock.sendMessage(chatId, {
        text: `${titulo}\n\n${lista.map((c) => `▸ */${c.name}*\n   _${c.description}_`).join('\n\n')}`,
      }, { quoted: msg })
    }

    let texto = '🤖 *Menu*\n'
    for (const [id, titulo] of SECOES) {
      const lista = visiveis.filter((c) => (c.categoria ?? 'utilidades') === id).sort((a, b) => a.name.localeCompare(b.name))
      if (!lista.length) continue
      texto += `\n${titulo}\n${lista.map((c) => `/${c.name}`).join('  ·  ')}\n`
    }

    const escondidos = unicos.length - visiveis.length
    texto += `\n_${visiveis.length} comando(s) aqui`
    if (escondidos > 0 && emGrupo) texto += ` · ${escondidos} desligado(s) neste grupo`
    texto += '._\n_`/menu diversão` mostra o que cada um faz._'
    if (emGrupo) texto += '\n_`/infogrupo` mostra o que está liberado aqui._'

    await sock.sendMessage(chatId, { text: texto }, { quoted: msg })
  },
}
