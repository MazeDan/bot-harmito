import { config } from '../config.js'
import { TIMEZONE } from '../tz.js'

/** Quanto falta até o próximo HH:MM, em texto curto */
function faltaPara(hhmm, agora = new Date()) {
  const [h, m] = hhmm.split(':').map(Number)
  const alvo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), h, m, 0)
  if (alvo <= agora) alvo.setDate(alvo.getDate() + 1)
  const min = Math.round((alvo - agora) / 60000)
  if (min < 60) return `em ${min}min`
  const horas = Math.floor(min / 60)
  const resto = min % 60
  return `em ${horas}h${resto ? String(resto).padStart(2, '0') : ''}`
}

export default {
  name: 'horario',
  aliases: ['hora', 'horarios', 'relogio'],
  resumo: 'minha hora e as rotinas do dia',
  description: 'Mostra a hora do bot e quando cada rotina automática dispara',
  categoria: 'utilidades',

  async run({ sock, msg, chatId }) {
    const agora = new Date()
    const offset = -agora.getTimezoneOffset() / 60

    const rotinas = [
      ['📖 Leituras nos grupos', config.liturgia.horario, config.liturgia.ativo],
      ['☀️ Resumo da agenda', config.agenda.horarioResumo, config.agenda.ativo],
      ['💳 Cobrança e backup', config.cobranca.horario, config.cobranca.ativo],
      ...config.liturgia.lembretes.map((h, i) => [`🙏 Cobrança do /ld (${i + 1}ª)`, h, config.liturgia.ativo]),
    ]

    const linhas = rotinas
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([nome, hora, ativo]) =>
        `▸ *${hora}* — ${nome}${ativo ? ` _(${faltaPara(hora, agora)})_` : ' _(desligado)_'}`)

    const texto =
      `🕐 *Relógio do bot*\n\n` +
      `Agora: *${agora.toLocaleTimeString('pt-BR')}*\n` +
      `${agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}\n` +
      `Fuso: *${TIMEZONE}* (UTC${offset >= 0 ? '+' : ''}${offset})\n\n` +
      `⏰ *Rotinas automáticas*\n${linhas.join('\n')}\n\n` +
      `_Se a hora acima não bater com a sua, ajuste a variável_ \`TZ\` _no servidor._`

    await sock.sendMessage(chatId, { text: texto }, { quoted: msg })
  },
}
