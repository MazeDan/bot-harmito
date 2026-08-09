import { config } from '../config.js'
import {
  balanceOf, competenciaAtual, faturaOf, getCard, getPerson, getSettings, listCards,
  markReminder, money, reminderSent, souEu,
} from './finance.js'
import { sendText, isOnline } from './wa.js'
import { diasAteProximoBackup, enviarBackup, snapshotDiario } from './backup.js'

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
 * Mensagem consolidada de uma pessoa: tudo que ela deve, em todos os cartões,
 * agrupado por fatura. É o texto do botão "copiar" do painel.
 */
export function montarMensagemPessoa(personKey) {
  const b = balanceOf(personKey)
  if (!b) return null
  const s = getSettings()

  // agrupa os lançamentos por cartão + competência
  const grupos = new Map()
  for (const i of b.items) {
    const chave = `${i.card || ''}|${i.competencia}`
    if (!grupos.has(chave)) grupos.set(chave, { card: i.card, competencia: i.competencia, itens: [] })
    grupos.get(chave).itens.push(i)
  }

  let txt = `Oi, ${b.name}! 👋\n\nSegue o resumo do que ficou nos meus cartões:\n`
  for (const g of [...grupos.values()].sort((a, b2) => a.competencia.localeCompare(b2.competencia))) {
    const nome = g.card ? getCard(g.card)?.name ?? g.card : 'Sem cartão'
    const total = g.itens.reduce((sum, i) => sum + i.value, 0)
    txt += `\n*${nome}* — fatura de ${mesBR(g.competencia)}\n`
    txt += g.itens
      .sort((x, y) => x.at.localeCompare(y.at))
      .map((i) => `▸ ${dataBR(i.at)} — ${money(i.value)}${i.note ? ` (${i.note})` : ''}${i.parcela ? ` [${i.parcela.n}/${i.parcela.total}]` : ''}`)
      .join('\n')
    txt += `\n_subtotal: ${money(total)}_\n`
  }

  txt += `\n━━━━━━━━━━\nTotal lançado: ${money(b.totalItems)}\n`
  if (b.totalPaid > 0) txt += `Já recebi: ${money(b.totalPaid)}\n`
  txt += `💰 *Total a pagar: ${money(b.saldo)}*`
  if (s.pix) txt += `\n\n🔑 *PIX:* ${s.pix}${s.pixNome ? `\n_(${s.pixNome})_` : ''}`
  return txt
}

/**
 * Resumo de uma fatura inteira, com todo mundo e o total — para mandar num
 * grupo ou guardar para você.
 */
export function montarResumoFatura(cardName, comp = null) {
  const f = faturaOf(cardName, comp)
  if (!f) return null
  const s = getSettings()
  const venc = f.vencimento ? new Date(f.vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : null

  let txt = `💳 *${f.card}* — fatura de ${mesBR(f.competencia)}\n`
  if (venc) txt += `📅 Vence em ${venc}\n`
  txt += '\n'

  for (const p of f.pessoas) {
    const eu = souEu(p.person)
    txt += `*${p.name}${eu ? ' (eu)' : ''}* — ${money(p.aberto)}${p.pago ? ` _(pagou ${money(p.pago)})_` : ''}\n`
    txt += p.items
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((i) => `  ▸ ${dataBR(i.at)} ${money(i.value)}${i.note ? ` — ${i.note}` : ''}${i.parcela ? ` [${i.parcela.n}/${i.parcela.total}]` : ''}`)
      .join('\n')
    txt += '\n\n'
  }

  txt += `━━━━━━━━━━\n💸 *Total da fatura: ${money(f.total)}*`
  if (f.pago > 0) txt += `\n💵 Já recebi: ${money(f.pago)}\n🟠 Em aberto: *${money(f.aberto)}*`
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
    if (souEu(pessoa.person)) { resultados.push({ ...base(pessoa), status: 'sou-eu' }); continue }
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

/**
 * No dia do fechamento de cada cartão, manda para você a fatura que acabou
 * de fechar — com o total, quem deve o quê e a sua parte.
 */
export async function rodarFechamentos({ hoje = new Date(), forcarCartao = null } = {}) {
  const s = getSettings()
  const enviados = []

  for (const card of listCards()) {
    if (!card.fechamento) continue
    const ehHoje = hoje.getDate() === card.fechamento
    if (!ehHoje && forcarCartao !== card.key) continue

    // compras até o dia do fechamento caem na fatura do mês corrente
    const comp = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
    if (!forcarCartao && reminderSent(card.key, '__fechamento', comp, 'fechamento')) continue

    const f = faturaOf(card.key, comp)
    if (!f) continue

    const minha = f.pessoas.find((p) => souEu(p.person))
    const venc = f.vencimento ? new Date(f.vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : null

    let txt = `🔒 *Fechou a fatura do ${card.name}*\n📅 ${mesBR(comp)}`
    if (venc) txt += ` · vence em *${venc}*`
    txt += `\n\n💸 Total: *${money(f.total)}*\n`
    if (minha) txt += `🫵 Sua parte: *${money(minha.aberto)}*\n`
    const outros = f.pessoas.filter((p) => !souEu(p.person))
    if (outros.length) {
      txt += `👥 Dos outros: *${money(outros.reduce((sum, p) => sum + p.aberto, 0))}*\n\n`
      txt += outros.map((p) => `▸ ${p.name}: ${money(p.aberto)}${p.pago ? ` _(pagou ${money(p.pago)})_` : ''}`).join('\n')
    }
    if (card.limite) txt += `\n\n💳 Usou ${Math.round((f.total / card.limite) * 100)}% do limite de ${money(card.limite)}`
    txt += `\n\n_Cobre o pessoal com_ \`/cobrar ${card.key}\`_._`

    if (!s.donoJid) { enviados.push({ card: card.name, status: 'sem-destino', texto: txt }); continue }
    if (!isOnline()) { enviados.push({ card: card.name, status: 'offline', texto: txt }); continue }

    try {
      await sendText(s.donoJid, txt)
      if (!forcarCartao) await markReminder(card.key, '__fechamento', comp, 'fechamento')
      enviados.push({ card: card.name, status: 'enviado', total: f.total, texto: txt })
    } catch (err) {
      enviados.push({ card: card.name, status: 'erro', erro: err.message, texto: txt })
    }
  }

  if (enviados.length) console.log('🔒 Fechamentos:', enviados.map((e) => `${e.card}[${e.status}]`).join(', '))
  return enviados
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
      if (pessoa.aberto <= 0.009 || souEu(pessoa.person)) continue
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

/**
 * A rotina diária: backup local, fatura que fechou, backup por WhatsApp
 * quando vence o intervalo, e por fim os lembretes de cobrança.
 */
export async function rotinaDiaria() {
  const passos = [
    ['backup local', () => snapshotDiario()],
    ['fechamentos', () => rodarFechamentos()],
    ['backup por WhatsApp', async () => {
      if (!config.backup.ativo || diasAteProximoBackup() > 0) return null
      return enviarBackup()
    }],
    ['lembretes', () => rodarLembretes()],
  ]

  for (const [nome, fn] of passos) {
    try { await fn() } catch (e) { console.error(`Erro na rotina diária (${nome}):`, e.message) }
  }
}

/** Agenda a rotina diária no horário configurado */
export function iniciarAgendador() {
  if (!config.cobranca.ativo) {
    console.log('🔕 Agendador desligado (config.cobranca.ativo = false).')
    return
  }
  const [hh, mm] = config.cobranca.horario.split(':').map(Number)

  const agendar = () => {
    const agora = new Date()
    const alvo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), hh, mm, 0)
    if (alvo <= agora) alvo.setDate(alvo.getDate() + 1)
    timer = setTimeout(async () => {
      await rotinaDiaria()
      agendar()
    }, alvo - agora)
    timer.unref?.()
    console.log(`⏰ Próxima rotina diária: ${alvo.toLocaleString('pt-BR')}${config.cobranca.dryRun ? ' (cobrança em simulação)' : ''}`)
  }
  agendar()
}

export const pararAgendador = () => timer && clearTimeout(timer)
