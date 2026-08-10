import { config } from '../config.js'
import { diasAteProximoBackup, enviarBackup, snapshotDiario } from '../lib/backup.js'
import { getSettings } from '../lib/finance.js'

export default {
  name: 'backup',
  aliases: ['exportar', 'csv'],
  description: 'Manda agora o backup dos dados financeiros (.json e .csv)',
  categoria: 'financeiro',
  dono: true,

  async run({ sock, msg, chatId }) {
    const s = getSettings()
    if (!s.donoJid) {
      throw new Error('Antes me diga para onde mandar: envie */relatorios* no chat que deve receber.')
    }

    await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } })
    await snapshotDiario()
    const r = await enviarBackup({ forcado: true })

    if (r.erro) {
      await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } })
      throw new Error(r.erro)
    }

    await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } })
    if (s.donoJid !== chatId) {
      await sock.sendMessage(chatId, { text: '💾 Backup enviado no chat marcado com */relatorios*.' }, { quoted: msg })
    }
    console.log(`💾 Próximo backup automático em ${config.backup.intervaloDias} dias (${diasAteProximoBackup()}).`)
  },
}
