import { config } from '../config.js'
import { hojeISO, somarDias } from '../lib/agenda.js'
import { getSettings } from '../lib/finance.js'
import { ehAdmin, metadados } from '../lib/grupo.js'
import { registrarGrupo } from '../lib/grupos.js'
import { alternarGrupo, buscarLeituras, enviarLeituras, gruposDaLiturgia } from '../lib/liturgia.js'

export default {
  name: 'liturgia',
  aliases: ['leituras', 'leitura', 'missa', 'evangelho'],
  resumo: 'leituras católicas do dia',
  description: 'Leituras católicas do dia. /liturgia aqui liga o envio diário neste grupo',
  categoria: 'fe',

  async run({ sock, msg, chatId, userId, args, ehGrupo }) {
    const acao = (args[0] || '').toLowerCase()

    // /liturgia aqui → liga (ou desliga) o envio automático neste grupo
    if (/^(aqui|ligar|on|off|desligar|parar)$/.test(acao)) {
      if (!ehGrupo) throw new Error('Esse ajuste é para grupos. No privado, use */liturgia* quando quiser ler.')

      const dono = getSettings().donoUser
      const souDono = dono && userId === dono
      if (!souDono && !(await ehAdmin(sock, chatId, userId))) {
        throw new Error('Só o dono do bot ou um *administrador* do grupo pode ligar isso.')
      }

      const meta = await metadados(sock, chatId).catch(() => null)
      await registrarGrupo(chatId, meta?.subject)

      const desligar = /^(off|desligar|parar)$/.test(acao)
      const ligado = await alternarGrupo(chatId, desligar ? false : true)

      return sock.sendMessage(chatId, {
        text: ligado
          ? `📖 *Leituras ligadas neste grupo.*\n\nTodo dia às *${config.liturgia.horario}* eu mando a 1ª leitura, o salmo, a 2ª leitura (quando tiver) e o evangelho.\n\n_Desligue com_ \`/liturgia off\`_._`
          : '🔕 *Parei de mandar as leituras neste grupo.*',
      }, { quoted: msg })
    }

    // /liturgia grupos → onde está ligado (só o dono)
    if (acao === 'grupos') {
      const dono = getSettings().donoUser
      if (dono && userId !== dono) throw new Error('Só o dono vê essa lista.')
      const lista = gruposDaLiturgia()
      return sock.sendMessage(chatId, {
        text: lista.length
          ? `📖 *Leituras ligadas em ${lista.length} grupo(s)*\n\n${lista.map((j) => `▸ ${j}`).join('\n')}\n\n_Ajuste pelo painel ou com_ \`/liturgia aqui\`_._`
          : '📖 Nenhum grupo recebendo ainda.\n\n_Mande_ `/liturgia aqui` _no grupo que deve receber._',
      }, { quoted: msg })
    }

    // /liturgia [ontem | amanhã | 12/09] → manda as leituras aqui
    let data = hojeISO()
    if (acao === 'ontem') data = somarDias(data, -1)
    else if (/^(amanha|amanhã)$/.test(acao)) data = somarDias(data, 1)
    else {
      const m = acao.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/)
      if (m) data = `${m[3] || new Date().getFullYear()}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    }

    await sock.sendMessage(chatId, { react: { text: '📖', key: msg.key } })

    const l = await buscarLeituras(data)
    if (!l) throw new Error('Não consegui buscar a liturgia agora — a fonte pode estar fora do ar. Tente daqui a pouco.')

    const r = await enviarLeituras(chatId, data, { sock })
    if (r.erro) throw new Error(r.erro)
  },
}
