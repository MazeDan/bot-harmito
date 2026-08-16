import { config } from '../config.js'
import { diasAteProximoBackup } from '../lib/backup.js'
import { getSettings, listCards, setSettings } from '../lib/finance.js'

export default {
  name: 'relatorios',
  // 'dono' virou comando próprio (troca de dono com token) — não pode colidir
  aliases: ['relatorio', 'aqui'],
  resumo: 'marca este chat para os avisos',
  description: 'Marca este chat para receber fechamento de fatura e backup automático',
  categoria: 'financeiro',
  dono: true,

  async run({ sock, msg, chatId, args }) {
    const s = getSettings()

    if (args[0] && /^(off|desligar|parar|nao|não)$/i.test(args[0])) {
      await setSettings({ donoJid: '' })
      return sock.sendMessage(chatId, { text: '🔕 Parei de mandar os avisos automáticos.' }, { quoted: msg })
    }

    if (s.donoJid === chatId) {
      const dias = diasAteProximoBackup()
      return sock.sendMessage(
        chatId,
        {
          text:
            '✅ *Este chat já recebe os avisos automáticos.*\n\n' +
            `🔒 Fechamento de fatura: ${fechamentos()}\n` +
            `💾 Backup: a cada ${config.backup.intervaloDias} dias — ${dias <= 0 ? 'sai na próxima rotina' : `faltam ${dias} dia(s)`}\n` +
            `⏰ Rotina diária às ${config.cobranca.horario}\n\n` +
            '_`/relatorios off` para parar · `/backup` para mandar agora · `/fechamento nubank` para ver a prévia._',
        },
        { quoted: msg },
      )
    }

    await setSettings({ donoJid: chatId })
    await sock.sendMessage(
      chatId,
      {
        text:
          '✅ *Pronto — é aqui que eu te aviso.*\n\n' +
          `🔒 No dia do fechamento de cada cartão eu mando a fatura fechada: ${fechamentos()}\n` +
          `💾 A cada ${config.backup.intervaloDias} dias mando o backup dos seus dados (.json e .csv)\n` +
          `⏰ Tudo às ${config.cobranca.horario}\n\n` +
          '_`/relatorios off` para parar._',
      },
      { quoted: msg },
    )
  },
}

function fechamentos() {
  const cards = listCards().filter((c) => c.fechamento)
  if (!cards.length) return '_nenhum cartão tem dia de fechamento cadastrado_'
  return cards.map((c) => `${c.name} (dia ${c.fechamento})`).join(', ')
}
