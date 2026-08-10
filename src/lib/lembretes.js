import { config } from '../config.js'
import {
  atrasados, devidos, diaDaSemana, doDia, hojeISO,
  marcarAvisado, periodo, rotuloData, somarDias,
} from './agenda.js'
import { descreverRecorrencia } from './parseQuando.js'
import { competenciaAtual, faturaOf, getSettings, listCards, money } from './finance.js'
import { isOnline, sendText } from './wa.js'

/** Uma linha de item: "▸ 09:00 pagar faculdade" */
export function linhaItem(i, { mostrarNum = false, mostrarRecorrencia = false } = {}) {
  const marca = i.feito ? '✅' : '▸'
  const hora = i.hora ? `*${i.hora}* ` : ''
  const num = mostrarNum ? ` _#${i.num}_` : ''
  const rec = mostrarRecorrencia && i.recorrencia ? ` _(${descreverRecorrencia(i.recorrencia)})_` : ''
  const texto = i.feito ? `~${i.texto}~` : i.texto
  return `${marca} ${hora}${texto}${rec}${num}`
}

/** Cartões que vencem dentro de N dias — entram no resumo do dia */
export function faturasProximas(dias = 3) {
  const out = []
  for (const c of listCards()) {
    const f = faturaOf(c.key, competenciaAtual(c.key))
    if (!f?.vencimento || f.diasParaVencer == null) continue
    if (f.diasParaVencer < 0 || f.diasParaVencer > dias) continue
    if (f.aberto <= 0.009 && f.total <= 0.009) continue
    out.push({ card: c.name, dias: f.diasParaVencer, total: f.total, aberto: f.aberto })
  }
  return out.sort((a, b) => a.dias - b.dias)
}

/** O bom-dia: o que tem hoje, o que ficou pra trás e as faturas chegando */
export function montarResumoDia(dataISO = hojeISO()) {
  const itens = doDia(dataISO).filter((i) => !i.feito)
  const atrasadas = atrasados(dataISO)
  const faturas = faturasProximas(3)

  const nomeDia = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'][diaDaSemana(dataISO)]
  const [, m, d] = dataISO.split('-')
  let txt = `☀️ *Bom dia!* — ${nomeDia}, ${d}/${m}\n`

  if (!itens.length && !atrasadas.length && !faturas.length) {
    return txt + '\n🎉 Nada marcado para hoje. Dia livre.'
  }

  const comHora = itens.filter((i) => i.hora)
  const semHora = itens.filter((i) => !i.hora)

  if (comHora.length) {
    txt += `\n🕐 *Compromissos de hoje*\n${comHora.map((i) => linhaItem(i)).join('\n')}\n`
  }
  if (semHora.length) {
    txt += `\n📋 *Tarefas de hoje*\n${semHora.map((i) => linhaItem(i, { mostrarNum: true })).join('\n')}\n`
  }
  if (atrasadas.length) {
    txt += `\n⚠️ *Ficou pra trás*\n${atrasadas.slice(0, 8).map((i) => `▸ ${i.texto} _(${rotuloData(i.data, { curto: true })} · #${i.num})_`).join('\n')}\n`
    if (atrasadas.length > 8) txt += `_...e mais ${atrasadas.length - 8}._\n`
  }
  if (faturas.length) {
    txt += '\n💳 *Faturas chegando*\n'
    txt += faturas.map((f) => `▸ *${f.card}* — ${money(f.aberto)} ${f.dias === 0 ? '*vence hoje*' : `vence em ${f.dias}d`}`).join('\n')
    txt += '\n'
  }

  txt += '\n_`/feito 3` marca como concluído · `/lembrete` adiciona._'
  return txt
}

/** Repetir "tomar remédio" 7 vezes não ajuda ninguém — vira um bloco só. */
const ehRotina = (i) => i.recorrencia && (i.recorrencia.tipo === 'diaria' || i.recorrencia.tipo === 'uteis')

function blocoRotina(blocos) {
  const vistos = new Map()
  for (const b of blocos) {
    for (const i of b.itens) if (ehRotina(i) && !vistos.has(i.num)) vistos.set(i.num, i)
  }
  if (!vistos.size) return ''
  const linhas = [...vistos.values()]
    .sort((a, b) => (a.hora ?? '99:99').localeCompare(b.hora ?? '99:99'))
    .map((i) => `▸ ${i.hora ? `*${i.hora}* ` : ''}${i.texto} _(${descreverRecorrencia(i.recorrencia)})_`)
  return `\n🔁 *Rotina*\n${linhas.join('\n')}\n`
}

/** Segunda de manhã: a semana inteira pela frente */
export function montarSemana(deISO = hojeISO(), dias = 7) {
  const blocos = periodo(deISO, somarDias(deISO, dias - 1))
  const ate = somarDias(deISO, dias - 1)
  let txt = `📅 *Sua semana* — ${rotuloData(deISO, { curto: true })} a ${rotuloData(ate, { curto: true })}\n`

  let total = 0
  let corpo = ''
  for (const b of blocos) {
    const pend = b.itens.filter((i) => !i.feito && !ehRotina(i))
    if (!pend.length) continue
    total += pend.length
    corpo += `\n*${rotuloData(b.data)}*\n${pend.map((i) => linhaItem(i, { mostrarNum: true, mostrarRecorrencia: true })).join('\n')}\n`
  }

  const rotina = blocoRotina(blocos)
  const faturas = faturasProximas(dias)

  if (!total && !rotina && !faturas.length) return txt + '\n🎉 Semana limpa, nada marcado.'

  txt += corpo + rotina
  if (faturas.length) {
    txt += '\n💳 *Faturas na semana*\n'
    txt += faturas.map((f) => `▸ *${f.card}* — ${money(f.aberto)} ${f.dias === 0 ? '*vence hoje*' : `em ${f.dias}d`}`).join('\n')
    txt += '\n'
  }
  txt += `\n_${total} compromisso(s) marcado(s) na semana._`
  return txt
}

/** Sexta de manhã: sábado e domingo */
export function montarFimDeSemana(deISO = hojeISO()) {
  // o sábado que vem (se hoje já for sábado, é hoje mesmo)
  const dow = diaDaSemana(deISO)
  const sabado = somarDias(deISO, (6 - dow + 7) % 7)
  const domingo = somarDias(sabado, 1)

  const blocos = periodo(sabado, domingo)
  const [, ms, ds] = sabado.split('-')
  const [, md, dd] = domingo.split('-')
  let txt = `🎈 *Seu fim de semana* — ${ds}/${ms} e ${dd}/${md}\n`

  let corpo = ''
  let total = 0
  for (const b of blocos) {
    const pend = b.itens.filter((i) => !i.feito && !ehRotina(i))
    if (!pend.length) continue
    total += pend.length
    const nome = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][diaDaSemana(b.data)]
    corpo += `\n*${nome}*\n${pend.map((i) => linhaItem(i, { mostrarNum: true, mostrarRecorrencia: true })).join('\n')}\n`
  }

  const rotina = blocoRotina(blocos)
  if (!total && !rotina) return txt + '\n😌 Nada marcado. Fim de semana livre!'
  return txt + corpo + rotina
}

// ---------- envio ----------

async function paraDono(texto) {
  const jid = getSettings().donoJid
  if (!jid) return { erro: 'sem-destino' }
  if (!isOnline()) return { erro: 'offline' }
  await sendText(jid, texto)
  return { ok: true }
}

/**
 * O pacote da manhã: resumo do dia sempre; na segunda vai junto a semana,
 * na sexta vai junto o fim de semana.
 */
export async function enviarResumoMatinal({ hoje = hojeISO(), forcar = false } = {}) {
  const enviados = []
  const dow = diaDaSemana(hoje)

  const pacote = [['dia', montarResumoDia(hoje)]]
  if (dow === 1) pacote.push(['semana', montarSemana(hoje)])
  if (dow === 5) pacote.push(['fim-de-semana', montarFimDeSemana(hoje)])

  for (const [tipo, texto] of pacote) {
    if (forcar) { enviados.push({ tipo, texto, status: 'previa' }); continue }
    const r = await paraDono(texto)
    enviados.push({ tipo, texto, status: r.ok ? 'enviado' : r.erro })
    await new Promise((res) => setTimeout(res, 1500))
  }

  if (enviados.length) console.log('📅 Resumo matinal:', enviados.map((e) => `${e.tipo}[${e.status}]`).join(', '))
  return enviados
}

/** Avisa os compromissos que chegaram na hora marcada */
export async function dispararDevidos() {
  const pendentes = devidos()
  if (!pendentes.length) return []

  const feitos = []
  for (const i of pendentes) {
    const txt = `⏰ *${i.hora}* — ${i.texto}${i.recorrencia ? `\n_${descreverRecorrencia(i.recorrencia)}_` : ''}\n\n_\`/feito ${i.num}\` para marcar como concluído._`
    const r = await paraDono(txt)
    if (r.ok) await marcarAvisado(i)
    feitos.push({ num: i.num, texto: i.texto, status: r.ok ? 'enviado' : r.erro })
  }
  console.log('⏰ Lembretes disparados:', feitos.map((f) => `#${f.num}[${f.status}]`).join(', '))
  return feitos
}

// ---------- agendador ----------

let timerResumo = null
let timerTick = null

export function iniciarAgendaScheduler() {
  if (!config.agenda.ativo) {
    console.log('🔕 Agenda desligada (config.agenda.ativo = false).')
    return
  }

  // 1) resumo da manhã, uma vez por dia
  const [hh, mm] = config.agenda.horarioResumo.split(':').map(Number)
  const agendar = () => {
    const agora = new Date()
    const alvo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), hh, mm, 0)
    if (alvo <= agora) alvo.setDate(alvo.getDate() + 1)
    timerResumo = setTimeout(async () => {
      try { await enviarResumoMatinal() } catch (e) { console.error('Erro no resumo matinal:', e.message) }
      agendar()
    }, alvo - agora)
    timerResumo.unref?.()
    console.log(`📅 Próximo resumo da agenda: ${alvo.toLocaleString('pt-BR')}`)
  }
  agendar()

  // 2) tique de minuto para os compromissos com hora marcada
  timerTick = setInterval(() => {
    dispararDevidos().catch((e) => console.error('Erro disparando lembrete:', e.message))
  }, 60_000)
  timerTick.unref?.()
}

export function pararAgendaScheduler() {
  if (timerResumo) clearTimeout(timerResumo)
  if (timerTick) clearInterval(timerTick)
}
