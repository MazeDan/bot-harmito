import { ehAdmin, metadados } from '../lib/grupo.js'
import { atualizarGrupo, getGrupo, registrarGrupo } from '../lib/grupos.js'

export default {
  name: 'regras',
  aliases: ['regra'],
  description: 'Mostra as regras do grupo. Admin define com /regras set <texto>',
  categoria: 'grupo',

  async run({ sock, msg, chatId, userId, args, text, ehGrupo }) {
    if (!ehGrupo) throw new Error('Esse é pra usar em grupo.')

    const acao = (args[0] || '').toLowerCase()

    if (acao === 'set' || acao === 'definir') {
      if (!(await ehAdmin(sock, chatId, userId))) throw new Error('Só *administradores* mudam as regras.')
      const novas = text.replace(/^[/!.]\S+\s+\S+\s*/, '').trim()
      if (!novas) throw new Error('Escreva as regras:\n\n*/regras set*\n1. Sem spam\n2. Respeito sempre')

      const meta = await metadados(sock, chatId).catch(() => null)
      await registrarGrupo(chatId, meta?.subject)
      await atualizarGrupo(chatId, { regras: novas })
      return sock.sendMessage(chatId, { text: `✅ Regras atualizadas!\n\n📜 *Regras*\n\n${novas}` }, { quoted: msg })
    }

    if (acao === 'limpar' || acao === 'apagar') {
      if (!(await ehAdmin(sock, chatId, userId))) throw new Error('Só *administradores* mudam as regras.')
      await atualizarGrupo(chatId, { regras: '' })
      return sock.sendMessage(chatId, { text: '🗑️ Regras apagadas.' }, { quoted: msg })
    }

    const cfg = getGrupo(chatId)
    if (!cfg?.regras) {
      throw new Error('Esse grupo ainda não tem regras.\n\n_Um admin define com_ */regras set 1. Sem spam...*')
    }

    const meta = await metadados(sock, chatId).catch(() => null)
    await sock.sendMessage(
      chatId,
      { text: `📜 *Regras${meta?.subject ? ' de ' + meta.subject : ''}*\n\n${cfg.regras}` },
      { quoted: msg },
    )
  },
}
