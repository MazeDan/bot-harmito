import * as pr from '../lib/producao.js'

const nomeCliente = (k) => pr.getCliente(k)?.name ?? k

function linhaItem(i) {
  if (i._tipo === 'tarefa') {
    return `▸ ${pr.ICONE_STATUS[i.status]} *#${i.num}* ${i.titulo} _(${nomeCliente(i.clienteKey)})_`
  }
  const hora = i.hora ? `*${i.hora}* ` : ''
  return `▸ ${pr.ICONE_STATUS[i.status]} ${hora}${pr.ICONE_TIPO[i.tipo]} *#${i.num}* ${i.titulo || i.tipo} _(${nomeCliente(i.clienteKey)})_`
}

export function montarDashboard() {
  const d = pr.dashboard()
  let t = '🎬 *Produção — o que fazer agora*\n\n'
  t += `HOJE\n🎬 ${d.hoje.editar} vídeo(s) para editar\n📱 ${d.hoje.publicar} publicação(ões)\n📋 ${d.hoje.tarefas} tarefa(s)\n`
  if (d.proximosDias.length) {
    t += '\nPRÓXIMOS DIAS\n'
    for (const p of d.proximosDias.filter((x) => x.qtd > 0).slice(0, 4)) t += `${pr.rotuloData(p.data)} — ${p.qtd} tarefa(s)\n`
  }
  t += '\nPENDÊNCIAS\n'
  if (d.atrasadas) t += `🔴 ${d.atrasadas} atrasada(s)\n`
  t += `🟡 ${d.naoPlanejados} conteúdo(s) sem data\n`
  t += `\n_\`/producao hoje\` · \`/producao semana\` · \`/producao pendencias\`_`
  return t
}

export function montarHoje() {
  const itens = pr.itensDoDia(pr.hojeISO())
  if (!itens.length) return '🎉 Nada marcado pra hoje na produção.'
  return `📅 *Hoje na produção*\n\n${itens.map(linhaItem).join('\n')}`
}

export function montarSemana() {
  const s = pr.semana()
  let t = `📅 *Planejamento semanal* — ${pr.rotuloData(s.inicio)} a ${pr.rotuloData(s.fim)}\n`
  if (s.fechada) t += '_✅ semana fechada_\n'
  let vazio = true
  for (const d of s.dias) {
    if (!d.itens.length) continue
    vazio = false
    t += `\n*${pr.DIAS[d.diaSemana]}, ${d.data.split('-').reverse().slice(0, 2).join('/')}*\n`
    t += d.itens.map(linhaItem).join('\n') + '\n'
  }
  if (vazio) t += '\n_Nada planejado ainda. Organize pelo painel._'
  return t
}

export function montarPendencias() {
  const naoPlanejados = pr.conteudosNaoPlanejados()
  const atrasadas = pr.tarefasAtrasadas()
  const pendentes = pr.tarefasPendentes().filter((t) => !atrasadas.includes(t))

  let t = '📋 *Pendências*\n'
  if (atrasadas.length) t += `\n🔴 *Atrasadas*\n${atrasadas.map((tsk) => `▸ *#${tsk.num}* ${tsk.titulo} _(${nomeCliente(tsk.clienteKey)})_`).join('\n')}\n`
  if (naoPlanejados.length) t += `\n🟡 *Sem data* (${naoPlanejados.length})\n${naoPlanejados.slice(0, 10).map((c) => `▸ ${pr.ICONE_TIPO[c.tipo]} *#${c.num}* ${c.titulo || c.tipo} _(${nomeCliente(c.clienteKey)})_`).join('\n')}\n`
  if (pendentes.length) t += `\n⏳ *Tarefas pendentes*\n${pendentes.slice(0, 10).map((tsk) => `▸ *#${tsk.num}* ${tsk.titulo} _(${nomeCliente(tsk.clienteKey)})_`).join('\n')}\n`
  if (!atrasadas.length && !naoPlanejados.length && !pendentes.length) t += '\n🎉 Tudo em dia!'
  return t
}

export function montarClientes() {
  const lista = pr.listClientes()
  if (!lista.length) return '👤 Nenhum cliente cadastrado ainda.\n\n_Cadastre pelo painel, em Produção → Clientes._'
  return `👤 *Clientes* (${lista.length})\n\n${lista.map((c) => `▸ ${c.active ? '🟢' : '⚪'} *${c.name}*${c.company ? ` — ${c.company}` : ''}`).join('\n')}`
}

export function montarCliente(nome) {
  const c = pr.getCliente(nome)
  if (!c) throw new Error(`Não achei o cliente *${nome}*.`)
  const r = pr.resumoCliente(c.key)
  let t = `👤 *${c.name}*${c.company ? `\n${c.company}` : ''}\n\n`
  t += `Conteúdos desta semana:\n🟢 ${r.publicados} publicados\n🟡 ${r.agendados} agendados\n🎨 ${r.emEdicao} em edição\n⚠️ ${r.pendentes} pendentes\n\n`
  t += `📋 ${r.tarefasAbertas} tarefa(s) aberta(s)`
  return t
}

export default {
  name: 'producao',
  aliases: ['prod', 'conteudos', 'conteúdos'],
  resumo: 'conteúdos, tarefas e planejamento semanal',
  description: 'Gestão de conteúdo: /producao hoje, semana, pendencias, clientes, cliente <nome>, fechar',
  categoria: 'agenda',
  dono: true,

  async run({ sock, msg, chatId, args }) {
    const acao = (args[0] || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

    if (!acao) return sock.sendMessage(chatId, { text: montarDashboard() }, { quoted: msg })
    if (acao === 'hoje') return sock.sendMessage(chatId, { text: montarHoje() }, { quoted: msg })
    if (acao === 'semana') return sock.sendMessage(chatId, { text: montarSemana() }, { quoted: msg })
    if (/^pend/.test(acao)) return sock.sendMessage(chatId, { text: montarPendencias() }, { quoted: msg })
    if (acao === 'clientes') return sock.sendMessage(chatId, { text: montarClientes() }, { quoted: msg })

    if (acao === 'cliente') {
      const nome = args.slice(1).join(' ')
      if (!nome) throw new Error('Use: */producao cliente Altamir*')
      return sock.sendMessage(chatId, { text: montarCliente(nome) }, { quoted: msg })
    }

    if (acao === 'fechar') {
      await pr.fecharSemana()
      return sock.sendMessage(chatId, { text: '✅ Planejamento da semana marcado como fechado.' }, { quoted: msg })
    }

    // permite tratar "/producao Altamir" direto, sem precisar digitar "cliente"
    if (pr.getCliente(args[0])) {
      return sock.sendMessage(chatId, { text: montarCliente(args[0]) }, { quoted: msg })
    }

    throw new Error(
      'Não entendi.\n\n' +
      '▸ `/producao` — visão geral\n' +
      '▸ `/producao hoje` · `/producao semana`\n' +
      '▸ `/producao pendencias` · `/producao clientes`\n' +
      '▸ `/producao cliente Altamir`\n' +
      '▸ `/producao fechar` — fecha o planejamento da semana\n\n' +
      '_Upload de arte/vídeo e arrastar no calendário é pelo painel — mande `/painel`._',
    )
  },
}
