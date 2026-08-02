import { config } from '../config.js'
import {
  competenciaAtual, faturaOf, getPerson, getSettings, listCards,
  markReminder, money, reminderSent,
} from './finance.js'
import { sendText, isOnline } from './wa.js'

const dataBR = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
const mesBR = (ym) => {
  const [y, m] = ym.split('-')
  const nomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  return `${nomes[Number(m) - 1] ?? m}/${y}`
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Monta o texto da cobrança de uma pessoa numa fatura */
export function montarMensagem(fatura, pessoa) {
  const s = getSettings()
  const venc = fatura.vencimento ? new Date(fatura.vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : null
  const itens = pessoa.items
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((i) => {
      const p = i.parcela ? ` [${i.parcela.n}/${i.parcela.total}]` : ''
      return `▸ ${dataBR(i.at)} — ${money(i.value)}${i.note ? ` _(${i.note})_` : ''}${p}`
    })
    .join('\n')

  let txt = `Oi, ${pessoa.name}! 👋\n\nSegue o que ficou no meu cartão *${fatura.card}* na fatura de *${mesBR(fatura.competencia)}*:\n\n${itens}\n\n`
  if (pessoa.pago > 0) txt += `Já recebi: ${money(pessoa.pago)}\n`
  txt += `━━━━━━━━━━\n💰 *Total: ${money(pessoa.aberto)}*\n`
  if (venc) txt += `📅 Vence em *${venc}*`
  if (venc && fatura.diasParaVencer != null) {
    txt += fatura.diasParaVencer > 0 ? ` (faltam ${fatura.diasParaVencer} dia${fatura.diasParaVencer > 1 ? 's' : ''})` :
      fatura.diasParaVencer === 0 ? ' (é *hoje*!)' : ` (*venceu* há ${-fatura.diasParaVencer} dia${-fatura.diasParaVencer > 1 ? 's' : ''})`
  }
  if (s.pix) txt += `\n\n🔑 *PIX:* ${s.pix}${s.pixNome ? `\n_(${s.pixNome})_` : ''}`
  return txt
}

/**
 * Envia (ou simula) a cobrança de um cartão.
 * Retorna a lista do que foi enviado/simulado/pulado.
 */
export async function cobrar(cardName, { competencia = null, dryRun = config.cobranca.dryRun, tipo = 'manual', apenas = null } = {}) {
  const fatura = faturaOf(cardName, competencia)
  if (!fatura) return { erro: `Cartão "${cardName}" não existe.` }

  const resultados = []
  let enviados = 0

  for (const pessoa of fatura.pessoas) {
    if (apenas && pessoa.person !== apenas) continue
    if (pessoa.aberto <= 0.009) { resultados.push({ ...base(pessoa), status: 'quitado' }); continue }

    const p = getPerson(pessoa.person)
    const texto = montarMensagem(fatura, pessoa)

    if (!p?.jid) { resultados.push({ ...base(pessoa), status: 'sem-telefone', texto }); continue }
    if (dryRun) { resultados.push({ ...base(pessoa), status: 'simulado', jid: p.jid, texto }); continue }
    if (!isOnline()) { resultados.push({ ...base(pessoa), status: 'offline', texto }); continue }
    if (enviados >= config.cobranca.maxPorRodada) { resultados.push({ ...base(pessoa), status: 'limite-diario', texto }); continue }

    try {
      await sendText(p.jid, texto)
      await markReminder(fatura.cardKey, pessoa.person, fatura.competencia, tipo)
      enviados++
      resultados.push({ ...base(pessoa), status: 'enviado', jid: p.jid, texto })
      // intervalo aleatório entre envios para não parecer disparo em massa
      const [min, max] = config.cobranca.intervaloMs
      await sleep(min + Math.random() * (max - min))
    } catch (err) {
      resultados.push({ ...base(pessoa), status: 'erro', erro: err.message, texto })
    }
  }

  return { fatura: { ...fatura, lancamentos: undefined }, dryRun, resultados }

  function base(pessoa) {
    return { person: pessoa.person, name: pessoa.name, valor: pessoa.aberto }
  }
}

/** Qual gatilho (se algum) se aplica hoje a uma fatura */
function gatilho(dias) {
  if (dias === 5) return 'D-5'
  if (dias === 2) return 'D-2'
  if (dias === 0) return 'D-0'
  if (dias === -1) return 'D+1'
  return null
}

/** Roda uma vez: percorre os cartões e dispara os lembretes do dia */
export async function rodarLembretes({ dryRun = config.cobranca.dryRun } = {}) {
  const saida = []
  for (const card of listCards()) {
    const comp = competenciaAtual(card.key)
    const fatura = faturaOf(card.key, comp)
    if (!fatura || fatura.diasParaVencer == null) continue

    const tipo = gatilho(fatura.diasParaVencer)
    if (!tipo) continue

    for (const pessoa of fatura.pessoas) {
      if (pessoa.aberto <= 0.009) continue
      if (reminderSent(card.key, pessoa.person, comp, tipo)) continue
      const r = await cobrar(card.key, { competencia: comp, dryRun, tipo, apenas: pessoa.person })
      saida.push(...(r.resultados || []).map((x) => ({ ...x, card: card.name, competencia: comp, tipo })))
    }
  }
  if (saida.length) {
    console.log(`🔔 Lembretes (${dryRun ? 'SIMULAÇÃO' : 'envio real'}):`)
    for (const s of saida) console.log(`   ${s.tipo} ${s.card} → ${s.name} ${money(s.valor)} [${s.status}]`)
  }
  return saida
}

let timer = null

/** Agenda a checagem diária no horário configurado */
export function iniciarAgendador() {
  if (!config.cobranca.ativo) {
    console.log('🔕 Agendador de cobrança desligado (config.cobranca.ativo = false).')
    return
  }
  const [hh, mm] = config.cobranca.horario.split(':').map(Number)

  const agendar = () => {
    const agora = new Date()
    const alvo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), hh, mm, 0)
    if (alvo <= agora) alvo.setDate(alvo.getDate() + 1)
    const ms = alvo - agora
    timer = setTimeout(async () => {
      try { await rodarLembretes() } catch (e) { console.error('Erro nos lembretes:', e) }
      agendar()
    }, ms)
    timer.unref?.()
    console.log(`⏰ Próxima checagem de cobrança: ${alvo.toLocaleString('pt-BR')}${config.cobranca.dryRun ? ' (modo simulação)' : ''}`)
  }
  agendar()
}

export const pararAgendador = () => timer && clearTimeout(timer)
