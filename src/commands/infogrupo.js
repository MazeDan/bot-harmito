import { arroba, metadados } from '../lib/grupo.js'
import { getGrupo } from '../lib/grupos.js'

const CATEGORIAS = {
  diversao: '🎲 Diversão', jogos: '🕹️ Jogos', midia: '🖼️ Mídia', grupo: '👥 Grupo',
  utilidades: '🔧 Utilidades', financeiro: '💳 Financeiro', agenda: '📅 Agenda',
}

export default {
  name: 'infogrupo',
  aliases: ['grupo', 'info'],
  resumo: 'dados do grupo e o que está liberado',
  description: 'Mostra os dados do grupo e o que está liberado aqui',
  categoria: 'grupo',

  async run({ sock, msg, chatId, ehGrupo }) {
    if (!ehGrupo) throw new Error('Esse é pra usar em grupo.')

    const meta = await metadados(sock, chatId)
    const cfg = getGrupo(chatId)
    const adms = (meta.participants ?? []).filter((p) => p.admin).length
    const criado = meta.creation ? new Date(meta.creation * 1000).toLocaleDateString('pt-BR') : '—'

    let texto = `👥 *${meta.subject}*\n\n`
    texto += `▸ Membros: *${meta.participants.length}* (${adms} admin)\n`
    texto += `▸ Criado em: ${criado}\n`
    if (meta.desc) texto += `\n📝 _${String(meta.desc).slice(0, 200)}_\n`

    if (cfg) {
      const libs = (cfg.categorias ?? []).map((c) => CATEGORIAS[c] ?? c)
      texto += `\n🔓 *Liberado aqui:* ${libs.join(', ') || '_nada_'}`
      if (cfg.comandos?.length) texto += `\n➕ Extras: ${cfg.comandos.map((c) => '/' + c).join(', ')}`
      if (cfg.bloqueados?.length) texto += `\n🚫 Bloqueados: ${cfg.bloqueados.map((c) => '/' + c).join(', ')}`
      if (cfg.silenciado) texto += '\n\n🔇 _O bot está silenciado neste grupo._'
    }
    texto += '\n\n_O dono ajusta isso pelo painel._'

    await sock.sendMessage(chatId, { text: texto }, { quoted: msg })
    void arroba
  },
}
