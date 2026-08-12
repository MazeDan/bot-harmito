import { ehAdmin, metadados } from '../lib/grupo.js'
import { atualizarGrupo, getGrupo, registrarGrupo } from '../lib/grupos.js'

export default {
  name: 'boasvindas',
  aliases: ['bemvindo', 'welcome'],
  resumo: 'saúda quem entra no grupo',
  description: 'Liga/desliga a saudação a quem entra no grupo — só admin',
  categoria: 'grupo',

  async run({ sock, msg, chatId, userId, args, ehGrupo }) {
    if (!ehGrupo) throw new Error('Esse é pra usar em grupo.')
    if (!(await ehAdmin(sock, chatId, userId))) throw new Error('Só *administradores* mexem nisso.')

    const meta = await metadados(sock, chatId).catch(() => null)
    await registrarGrupo(chatId, meta?.subject)
    const cfg = getGrupo(chatId)

    const pedido = (args[0] || '').toLowerCase()
    const ligar = /^(on|ligar|sim|1)$/.test(pedido) ? true
      : /^(off|desligar|nao|não|0)$/.test(pedido) ? false
      : !cfg.boasVindas

    await atualizarGrupo(chatId, { boasVindas: ligar })

    await sock.sendMessage(
      chatId,
      {
        text: ligar
          ? '👋 *Boas-vindas ligadas.*\n\nQuando alguém entrar, eu apresento a pessoa e mostro as regras do grupo (se tiver).\n\n_Desligue com_ `/boasvindas off`_._'
          : '🔕 *Boas-vindas desligadas.*',
      },
      { quoted: msg },
    )
  },
}
