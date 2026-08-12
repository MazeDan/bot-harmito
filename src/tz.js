/**
 * Fuso horário do bot.
 *
 * Servidor de hospedagem quase sempre roda em UTC. Sem isto, tudo que depende
 * de horário sai errado: as leituras das 06:00 chegariam às 03:00, o resumo
 * das 07:00 às 04:00, e depois das 21:00 o "hoje" já viraria o dia seguinte
 * — bagunçando agenda, liturgia e competência dos gastos.
 *
 * Precisa rodar ANTES de qualquer Date do processo, por isso é o primeiro
 * import do index.js. Não mexa na ordem.
 */
export const TIMEZONE = process.env.TZ || 'America/Bahia'
process.env.TZ = TIMEZONE

const agora = new Date()
const offset = -agora.getTimezoneOffset() / 60
console.log(`🕐 Fuso: ${TIMEZONE} (UTC${offset >= 0 ? '+' : ''}${offset}) · agora são ${agora.toLocaleTimeString('pt-BR')}`)
