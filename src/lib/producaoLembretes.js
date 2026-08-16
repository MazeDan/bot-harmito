import { config } from '../config.js'
import { getSettings } from './finance.js'
import { isOnline, sendText } from './wa.js'
import * as pr from './producao.js'

const dataBR = (iso) => { const [a, m, d] = iso.split('-'); return `${d}/${m}` }

async function paraDono(texto) {
  const jid = getSettings().donoJid
  if (!jid) return { erro: 'sem-destino' }
  if (!isOnline()) return { erro: 'offline' }
  await sendText(jid, texto)
  return { ok: true }
}

// ---------- textos ----------

export function montarResumoDiario() {
  const d = pr.dashboard()
  const hojeItens = pr.itensDoDia(pr.hojeISO())
  const nomeCliente = (k) => pr.getCliente(k)?.name ?? k

  let t = '☀️ *Bom dia, Daniel!*\n\nAqui está seu dia:\n'
  t += `📱 ${d.hoje.publicar} publicação(ões)\n`
  t += `🎬 ${d.videosParaEditar} vídeo(s) para editar\n`
  t += `🎨 ${d.artesPendentes} arte(s) pendente(s)\n`
  t += `📋 ${d.hoje.tarefas} tarefa(s) hoje\n`

  const primeiro = hojeItens.find((i) => i._tipo === 'conteudo' && i.hora)
  if (primeiro) {
    t += `\nPrimeiro compromisso:\n*${primeiro.hora}* — ${nomeCliente(primeiro.clienteKey)}\n${pr.ICONE_TIPO[primeiro.tipo]} ${primeiro.titulo || primeiro.tipo}\n`
  }
  if (d.atrasadas) t += `\n⚠️ Você tem *${d.atrasadas}* tarefa(s) atrasada(s).`
  t += '\n\nBoa produção! 🚀'
  return t
}

export function montarResumoNoturno() {
  const hoje = pr.hojeISO()
  const conteudosHoje = pr.listConteudos({ dataISO: hoje })
  const tarefasHoje = pr.raw().tarefas.filter((tsk) => tsk.prazo === hoje)
  const publicados = conteudosHoje.filter((c) => c.status === 'publicado').length
  const concluidas = tarefasHoje.filter((tsk) => tsk.status === 'concluido').length
  const pendConteudo = conteudosHoje.filter((c) => c.status !== 'publicado' && c.status !== 'cancelado')
  const pendTarefa = tarefasHoje.filter((tsk) => tsk.status !== 'concluido')
  const amanha = pr.itensDoDia(pr.somarDias(hoje, 1))

  let t = '🌙 *Fechando o dia*\n\nConcluído:\n'
  t += `✅ ${concluidas} tarefa(s)\n✅ ${publicados} publicação(ões)\n`
  if (pendConteudo.length || pendTarefa.length) {
    t += '\nPendente:\n'
    pendConteudo.forEach((c) => { t += `⚠️ ${pr.ICONE_TIPO[c.tipo]} ${c.titulo || c.tipo} (${pr.getCliente(c.clienteKey)?.name})\n` })
    pendTarefa.forEach((tsk) => { t += `⚠️ ${tsk.titulo}\n` })
  }
  if (amanha.length) t += `\nAmanhã:\n📱 ${amanha.length} item(ns)`
  return t
}

export function montarLembretePlanejamento(diaSemana) {
  const proximaSemana = pr.somarDias(pr.hojeISO(), diaSemana === 6 ? 2 : 1)
  const clientesAtivos = pr.listClientes({ apenasAtivos: true }).length
  const naoPlanejados = pr.conteudosNaoPlanejados().length
  const videos = pr.raw().tarefas.filter((t) => t.tipo === 'editar_video' && t.status === 'pendente').length
  const agendadosProxSemana = pr.listConteudos({}).filter((c) => c.data >= pr.inicioDaSemana(proximaSemana) && c.data <= pr.somarDias(pr.inicioDaSemana(proximaSemana), 6)).length

  const cabecalho = diaSemana === 6
    ? '📅 *PLANEJAMENTO SEMANAL*\n\nDaniel, você já fechou o planejamento da próxima semana?'
    : '⚠️ *Daniel, amanhã começa uma nova semana.*\n\nSeu planejamento ainda não está completo.'

  return (
    `${cabecalho}\n\n` +
    `👤 ${clientesAtivos} clientes\n` +
    `📱 ${naoPlanejados} conteúdos pendentes\n` +
    `🎬 ${videos} vídeos para editar\n` +
    `📅 ${agendadosProxSemana} conteúdos agendados\n\n` +
    '_Organize no painel — o WhatsApp só avisa, quem arrasta é lá._'
  )
}

export function montarAvisoSegunda() {
  const porCliente = new Map()
  for (const c of pr.conteudosNaoPlanejados()) {
    const nome = pr.getCliente(c.clienteKey)?.name ?? c.clienteKey
    porCliente.set(nome, (porCliente.get(nome) || 0) + 1)
  }
  if (!porCliente.size) return null
  let t = '⚠️ *Semana começando!*\n\nVocê ainda possui conteúdos sem planejamento:\n\n'
  for (const [nome, qtd] of porCliente) t += `${nome} — ${qtd} conteúdo(s)\n`
  t += '\n_Organize no painel quando puder._'
  return t
}

export function montarAvisoPublicacao(c) {
  const cliente = pr.getCliente(c.clienteKey)
  return (
    '🚨 *HORA DE POSTAR*\n\n' +
    `Cliente:\n${cliente?.name ?? c.clienteKey}\n\n` +
    `Conteúdo:\n${pr.ICONE_TIPO[c.tipo]} ${c.titulo || c.tipo}\n\n` +
    `Horário:\n${c.hora}\n\n` +
    `Status:\n${pr.ICONE_STATUS[c.status]} ${c.status}\n\n` +
    `_Responda \`publicado ${c.num}\` quando sair do forno._`
  )
}

export function montarAvisoTarefa(t, { atrasada = false } = {}) {
  const cliente = pr.getCliente(t.clienteKey)
  const prazoTxt = t.prazo ? (t.prazo === pr.hojeISO() ? 'Hoje' : dataBR(t.prazo)) : 'sem prazo'
  const icone = atrasada ? '🔴' : t.prioridade === 'alta' ? '🔴' : t.prioridade === 'baixa' ? '🟢' : '🟡'
  return (
    `🎬 *TAREFA ${atrasada ? 'ATRASADA' : 'PENDENTE'}*\n\n` +
    `Daniel, você precisa:\n${pr.NOME_TIPO_TAREFA[t.tipo] ?? t.titulo}\n\n` +
    `Cliente:\n${cliente?.name ?? t.clienteKey}\n\n` +
    `Prazo:\n${prazoTxt}\n\n` +
    `Prioridade:\n${icone} ${t.prioridade}\n\n` +
    `_Responda \`concluí ${t.num}\` quando terminar._`
  )
}

// ---------- disparo ----------

/** Compromissos de conteúdo cuja hora chegou (janela de 30 min, como na agenda) */
async function dispararPublicacoes() {
  const s = pr.getLembretesConfig()
  if (!s.publicacaoAntecedenciaMin && s.publicacaoAntecedenciaMin !== 0) return
  const agora = new Date()
  const hoje = pr.hojeISO()
  const antecedencia = new Date(agora.getTime() + s.publicacaoAntecedenciaMin * 60000)
  const hhmmAlvo = antecedencia.toTimeString().slice(0, 5)
  const limiteInferior = new Date(agora.getTime() - 5 * 60000).toTimeString().slice(0, 5)

  for (const c of pr.listConteudos({ dataISO: hoje })) {
    if (!c.hora || c.status === 'publicado' || c.status === 'cancelado') continue
    if (c.hora < limiteInferior || c.hora > hhmmAlvo) continue
    const marca = `pub-${c.num}`
    if (pr.jaAvisado(hoje, marca)) continue
    const r = await paraDono(montarAvisoPublicacao(c))
    if (r.ok) await pr.marcarAvisado(hoje, marca)
  }
}

async function dispararTarefas() {
  const s = pr.getLembretesConfig()
  const hoje = pr.hojeISO()
  const agora = new Date()
  const hhmm = agora.toTimeString().slice(0, 5)

  // resumo da manhã com as tarefas do dia
  if (s.tarefaManha && hhmm === s.tarefaManhaHora) {
    for (const t of pr.raw().tarefas.filter((x) => x.prazo === hoje && x.status === 'pendente')) {
      const marca = `tarefa-manha-${t.num}`
      if (pr.jaAvisado(hoje, marca)) continue
      const r = await paraDono(montarAvisoTarefa(t))
      if (r.ok) await pr.marcarAvisado(hoje, marca)
    }
  }

  // atrasadas e perto do prazo, uma vez ao dia por tarefa (checagem de hora exata evita repetir o minuto inteiro)
  if (hhmm === '09:00') {
    for (const t of pr.tarefasAtrasadas()) {
      const marca = `tarefa-atrasada-${t.num}-${hoje}`
      if (pr.jaAvisado(hoje, marca)) continue
      const r = await paraDono(montarAvisoTarefa(t, { atrasada: true }))
      if (r.ok) await pr.marcarAvisado(hoje, marca)
    }
  }
}

async function dispararPlanejamento() {
  const s = pr.getLembretesConfig()
  const agora = new Date()
  const hhmm = agora.toTimeString().slice(0, 5)
  const dow = agora.getDay()
  const hoje = pr.hojeISO()

  if (dow === 6 && s.planejamentoSabado && hhmm === s.planejamentoSabadoHora) {
    if (!pr.semanaFechada(pr.somarDias(hoje, 2)) && !pr.jaAvisado(hoje, 'planej-sabado')) {
      const r = await paraDono(montarLembretePlanejamento(6))
      if (r.ok) await pr.marcarAvisado(hoje, 'planej-sabado')
    }
  }
  if (dow === 0 && s.planejamentoDomingo && hhmm === s.planejamentoDomingoHora) {
    if (!pr.semanaFechada(pr.somarDias(hoje, 1)) && !pr.jaAvisado(hoje, 'planej-domingo')) {
      const r = await paraDono(montarLembretePlanejamento(0))
      if (r.ok) await pr.marcarAvisado(hoje, 'planej-domingo')
    }
  }
  if (dow === 1 && s.segundaNaoPlanejado && hhmm === s.segundaNaoPlanejadoHora) {
    if (!pr.jaAvisado(hoje, 'segunda-naoplanejado')) {
      const texto = montarAvisoSegunda()
      if (texto) {
        const r = await paraDono(texto)
        if (r.ok) await pr.marcarAvisado(hoje, 'segunda-naoplanejado')
      }
    }
  }
}

async function dispararResumos() {
  const s = pr.getLembretesConfig()
  const hhmm = new Date().toTimeString().slice(0, 5)
  const hoje = pr.hojeISO()

  if (s.resumoDiario && hhmm === s.resumoDiarioHora && !pr.jaAvisado(hoje, 'resumo-diario')) {
    const r = await paraDono(montarResumoDiario())
    if (r.ok) await pr.marcarAvisado(hoje, 'resumo-diario')
  }
  if (s.resumoNoturno && hhmm === s.resumoNoturnoHora && !pr.jaAvisado(hoje, 'resumo-noturno')) {
    const r = await paraDono(montarResumoNoturno())
    if (r.ok) await pr.marcarAvisado(hoje, 'resumo-noturno')
  }
}

// ---------- agendador ----------

let tique = null
let ultimaGeracaoRecorrencia = ''

export function iniciarProducaoScheduler() {
  if (!config.producao.ativo) {
    console.log('🔕 Produção de conteúdo desligada (config.producao.ativo = false).')
    return
  }
  tique = setInterval(async () => {
    try {
      const hoje = pr.hojeISO()
      if (ultimaGeracaoRecorrencia !== hoje) {
        ultimaGeracaoRecorrencia = hoje
        await pr.gerarConteudosRecorrentes().catch((e) => console.error('Erro gerando recorrências:', e.message))
      }
      await dispararPublicacoes()
      await dispararTarefas()
      await dispararPlanejamento()
      await dispararResumos()
    } catch (e) {
      console.error('Erro na rotina de produção:', e.message)
    }
  }, 60_000)
  tique.unref?.()
  console.log('🎬 Produção de conteúdo: lembretes ligados (ajuste os horários no painel).')
}

export const pararProducaoScheduler = () => tique && clearInterval(tique)
