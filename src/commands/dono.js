import { getSettings, setSettings } from '../lib/finance.js'
import { tokenValido } from '../lib/donoAuth.js'

export default {
  name: 'dono',
  aliases: ['sououdono'],
  resumo: 'mostra ou troca quem é o dono do bot',
  description: 'Mostra quem é o dono, ou troca: /dono trocar SEU_TOKEN',
  categoria: 'utilidades',

  async run({ sock, msg, chatId, userId, args, ehGrupo }) {
    if (ehGrupo) throw new Error('Isso só funciona no privado, no chat direto com o bot.')

    const dono = getSettings().donoUser
    const acao = (args[0] || '').toLowerCase()

    if (acao === 'trocar') {
      // sem dono ainda: primeiro a usar vira dono, sem precisar de token
      // (mesma regra que já vale pra /gasto e companhia)
      if (!dono) {
        await setSettings({ donoUser: userId })
        return sock.sendMessage(chatId, { text: '👑 Pronto — você é o dono do bot.' }, { quoted: msg })
      }

      if (userId === dono) {
        return sock.sendMessage(chatId, { text: '👑 Você já é o dono. Não precisa trocar.' }, { quoted: msg })
      }

      if (!tokenValido(args[1])) {
        throw new Error(
          'Token errado ou faltando.\n\n' +
          'Use: */dono trocar SEU_TOKEN*\n\n' +
          '_O token está no log do servidor (ou em `DONO_TOKEN`, se você definiu um fixo). ' +
          'Só quem tem acesso ao servidor consegue trocar o dono — é assim de propósito._',
        )
      }

      await setSettings({ donoUser: userId })
      return sock.sendMessage(chatId, {
        text: `👑 Pronto — você é o novo dono. O número anterior (${dono.split('@')[0]}) perdeu o acesso aos comandos de financeiro e agenda.`,
      }, { quoted: msg })
    }

    if (!dono) {
      return sock.sendMessage(chatId, {
        text: '👤 Ainda não tem dono definido. Use qualquer comando de financeiro ou agenda (ex.: `/gasto`) que você vira dono automaticamente.',
      }, { quoted: msg })
    }

    const texto = userId === dono
      ? '👑 Você é o dono do bot.\n\n_Para transferir pra outro número, mande `/dono trocar SEU_TOKEN` a partir do número novo._'
      : `👤 O dono do bot é outro número (${dono.split('@')[0]}).\n\n_Se for você mesmo, de um número diferente, use \`/dono trocar SEU_TOKEN\` — o token está no log do servidor._`

    await sock.sendMessage(chatId, { text: texto }, { quoted: msg })
  },
}
