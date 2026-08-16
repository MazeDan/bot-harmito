import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from '../config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', '..', 'data')
export const PRODUCAO_FILE = path.join(DATA_DIR, 'producao.json')
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')

export const TIPOS_CONTEUDO = ['post', 'story', 'reels', 'video', 'carrossel', 'arte', 'outro']
export const STATUS_CONTEUDO = ['rascunho', 'edicao', 'pronto', 'agendado', 'publicado', 'cancelado']
export const TIPOS_TAREFA = [
  'editar_video', 'criar_arte', 'criar_legenda', 'revisar', 'enviar_cliente',
  'aguardar_aprovacao', 'publicar', 'criar_roteiro', 'gravar_video', 'outro',
]
export const STATUS_TAREFA = ['pendente', 'andamento', 'concluido', 'cancelado']

export const ICONE_STATUS = {
  rascunho: '📥', edicao: '🎨', pronto: '🟡', agendado: '📅', publicado: '🚀', cancelado: '❌',
  pendente: '⏳', andamento: '🔧', concluido: '✅',
}
export const ICONE_TIPO = { post: '📱', story: '⭕', reels: '🎬', video: '🎥', carrossel: '🖼️', arte: '🎨', outro: '📎' }
export const NOME_TIPO_TAREFA = {
  editar_video: 'Editar vídeo', criar_arte: 'Criar arte', criar_legenda: 'Criar legenda',
  revisar: 'Revisar conteúdo', enviar_cliente: 'Enviar para cliente', aguardar_aprovacao: 'Aguardar aprovação',
  publicar: 'Publicar', criar_roteiro: 'Criar roteiro', gravar_video: 'Gravar vídeo', outro: 'Outro',
}

const vazio = () => ({
  version: 1,
  proximoNumConteudo: 1,
  proximoNumTarefa: 1,
  clientes: {},
  conteudos: [],
  tarefas: [],
  recorrencias: [],
  semanasFechadas: [],
  enviados: {},
  settings: { lembretes: { ...config.producao.padroes } },
})

let db = vazio()
let salvando = Promise.resolve()

export function initProducao() {
  mkdirSync(DATA_DIR, { recursive: true })
  mkdirSync(UPLOADS_DIR, { recursive: true })
  if (existsSync(PRODUCAO_FILE)) {
    const bruto = JSON.parse(readFileSync(PRODUCAO_FILE, 'utf-8'))
    db = { ...vazio(), ...bruto }
    db.settings = { lembretes: { ...config.producao.padroes, ...(bruto.settings?.lembretes || {}) } }
  }
  salvar()
}

function salvar() {
  const snapshot = JSON.stringify(db, null, 2)
  salvando = salvando.then(() => writeFile(PRODUCAO_FILE, snapshot)).catch((e) => console.error('Erro salvando producao.json:', e))
  return salvando
}

export const raw = () => db
export const key = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// ---------- datas ----------

export const hojeISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const somarDias = (dataISO, n) => {
  const [y, m, d] = dataISO.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}
export const diaDaSemana = (dataISO) => {
  const [y, m, d] = dataISO.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}
/** Segunda-feira da semana que contém essa data */
export function inicioDaSemana(dataISO = hojeISO()) {
  const dow = diaDaSemana(dataISO)
  const voltar = dow === 0 ? 6 : dow - 1
  return somarDias(dataISO, -voltar)
}
export const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export function rotuloData(dataISO) {
  const hoje = hojeISO()
  if (dataISO === hoje) return 'Hoje'
  if (dataISO === somarDias(hoje, 1)) return 'Amanhã'
  if (dataISO === somarDias(hoje, -1)) return 'Ontem'
  const [, m, d] = dataISO.split('-')
  return `${DIAS[diaDaSemana(dataISO)].slice(0, 3)}, ${d}/${MESES[Number(m) - 1]}`
}
/** Chave de semana ISO-ish só pra controlar "já fechei essa semana" */
export const chaveSemana = (dataISO = hojeISO()) => `semana-${inicioDaSemana(dataISO)}`

// ---------- clientes ----------

export async function upsertCliente(nome, dados = {}) {
  const k = key(nome)
  if (!k) return null
  const c = (db.clientes[k] ??= {
    key: k, name: String(nome).trim(), company: '', phone: '', whatsapp: '',
    instagram: '', notes: '', color: '#7c5cff', active: true, criadoEm: new Date().toISOString(),
  })
  if (dados.name) c.name = String(dados.name).trim()
  for (const campo of ['company', 'phone', 'whatsapp', 'instagram', 'notes', 'color']) {
    if (dados[campo] !== undefined) c[campo] = String(dados[campo] || '')
  }
  if (dados.active !== undefined) c.active = Boolean(dados.active)
  await salvar()
  return c
}

export async function deleteCliente(nomeOuKey) {
  const k = key(nomeOuKey)
  if (!db.clientes[k]) return false
  delete db.clientes[k]
  db.conteudos = db.conteudos.filter((c) => c.clienteKey !== k)
  db.tarefas = db.tarefas.filter((t) => t.clienteKey !== k)
  db.recorrencias = db.recorrencias.filter((r) => r.clienteKey !== k)
  await salvar()
  return true
}

/**
 * Acha o cliente pela chave exata primeiro; se não bater (comum quando o
 * nome tem "Sr.", pontuação etc. e a pessoa digita só o essencial no
 * WhatsApp, tipo "altamir"), cai pra busca por "contém" no nome.
 */
export function getCliente(nomeOuKey) {
  const k = key(nomeOuKey)
  if (!k) return null
  if (db.clientes[k]) return db.clientes[k]
  const termo = k.replace(/[^a-z0-9 ]/g, '').trim()
  if (!termo) return null
  const achado = Object.values(db.clientes).find((c) => key(c.name).replace(/[^a-z0-9 ]/g, '').includes(termo))
  return achado || null
}
export const listClientes = ({ apenasAtivos = false } = {}) =>
  Object.values(db.clientes)
    .filter((c) => !apenasAtivos || c.active)
    .sort((a, b) => a.name.localeCompare(b.name))

// ---------- arquivos ----------

function extensaoValida(nomeArquivo) {
  const ext = path.extname(nomeArquivo || '').toLowerCase()
  return config.producao.extensoes.includes(ext)
}

function nomeArquivoSeguro(original) {
  const ext = path.extname(original || '').toLowerCase()
  const base = path.basename(original || 'arquivo', ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)
  return `${base || 'arquivo'}${ext}`
}

/** Grava o buffer de um arquivo recebido no upload dentro da pasta do cliente */
export function guardarArquivo(clienteKey, numConteudo, buffer, nomeOriginal, mime = 'application/octet-stream') {
  if (!extensaoValida(nomeOriginal)) throw new Error(`Extensão não aceita: ${path.extname(nomeOriginal) || '(nenhuma)'}`)
  const pastaCliente = path.join(UPLOADS_DIR, clienteKey)
  mkdirSync(pastaCliente, { recursive: true })
  const nomeFinal = `${numConteudo}-${Date.now().toString(36)}-${nomeArquivoSeguro(nomeOriginal)}`
  writeFileSync(path.join(pastaCliente, nomeFinal), buffer)
  return { nome: nomeOriginal, arquivo: `${clienteKey}/${nomeFinal}`, mime, tamanho: buffer.length }
}

export const caminhoAbsoluto = (arquivoRelativo) => path.join(UPLOADS_DIR, arquivoRelativo)

export function removerArquivos(conteudo) {
  for (const a of conteudo.arquivos || []) {
    try { unlinkSync(caminhoAbsoluto(a.arquivo)) } catch { /* já não existe, tudo bem */ }
  }
}

// ---------- conteúdos ----------

export async function addConteudo({ clienteKey, tipo = 'outro', titulo = '', legenda = '', obs = '', plataforma = '', prioridade = 'normal', responsavel = '', arquivos = [] }) {
  const c = getCliente(clienteKey)
  if (!c) return null
  const item = {
    num: db.proximoNumConteudo++,
    clienteKey: c.key,
    tipo: TIPOS_CONTEUDO.includes(tipo) ? tipo : 'outro',
    titulo: String(titulo || '').trim(),
    legenda: String(legenda || '').trim(),
    obs: String(obs || '').trim(),
    plataforma: String(plataforma || '').trim(),
    prioridade: ['baixa', 'normal', 'alta'].includes(prioridade) ? prioridade : 'normal',
    responsavel: String(responsavel || '').trim(),
    status: 'rascunho',
    data: null,
    hora: null,
    arquivos,
    recorrenciaId: null,
    criadoEm: new Date().toISOString(),
    publicadoEm: null,
    ultimoAviso: null,
  }
  db.conteudos.push(item)
  await salvar()
  return item
}

export const getConteudo = (num) => db.conteudos.find((c) => c.num === Number(num)) || null

/** Anexa um arquivo já gravado (via guardarArquivo) ao conteúdo */
export async function anexarArquivo(num, arquivoInfo) {
  const c = getConteudo(num)
  if (!c) return null
  c.arquivos = [...(c.arquivos || []), arquivoInfo]
  await salvar()
  return c
}

export async function updateConteudo(num, patch = {}) {
  const c = getConteudo(num)
  if (!c) return null
  for (const campo of ['titulo', 'legenda', 'obs', 'plataforma', 'responsavel']) {
    if (patch[campo] !== undefined) c[campo] = String(patch[campo] || '').trim()
  }
  if (patch.tipo && TIPOS_CONTEUDO.includes(patch.tipo)) c.tipo = patch.tipo
  if (patch.prioridade && ['baixa', 'normal', 'alta'].includes(patch.prioridade)) c.prioridade = patch.prioridade
  if (patch.status && STATUS_CONTEUDO.includes(patch.status)) {
    c.status = patch.status
    c.publicadoEm = patch.status === 'publicado' ? new Date().toISOString() : (patch.status === 'agendado' ? c.publicadoEm : null)
  }
  if (patch.data !== undefined) c.data = patch.data || null
  if (patch.hora !== undefined) c.hora = patch.hora || null
  if (patch.clienteKey && getCliente(patch.clienteKey)) c.clienteKey = getCliente(patch.clienteKey).key
  await salvar()
  return c
}

/**
 * Agenda (ou desagenda, se data=null) um conteúdo — usado pelo arrastar-e-soltar.
 * Definir a data move o status para "agendado" (a não ser que já esteja
 * publicado ou cancelado, que não voltam sozinhos).
 */
export async function agendarConteudo(num, data, hora = null) {
  const c = getConteudo(num)
  if (!c) return null
  c.data = data || null
  c.hora = hora || null
  if (data && c.status !== 'publicado' && c.status !== 'cancelado') c.status = 'agendado'
  await salvar()
  return c
}

export async function deleteConteudo(num) {
  const c = getConteudo(num)
  if (!c) return false
  removerArquivos(c)
  db.conteudos = db.conteudos.filter((x) => x.num !== Number(num))
  await salvar()
  return true
}

export function listConteudos({ clienteKey, status, semData, dataISO } = {}) {
  return db.conteudos
    .filter((c) => !clienteKey || c.clienteKey === clienteKey)
    .filter((c) => !status || c.status === status)
    .filter((c) => semData === undefined || (semData ? !c.data : Boolean(c.data)))
    .filter((c) => !dataISO || c.data === dataISO)
    .sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99') || a.num - b.num)
}

// ---------- tarefas ----------

export async function addTarefa({ clienteKey, tipo = 'outro', titulo = '', prazo = null, prioridade = 'normal', obs = '', conteudoNum = null }) {
  const c = getCliente(clienteKey)
  if (!c) return null
  const item = {
    num: db.proximoNumTarefa++,
    clienteKey: c.key,
    tipo: TIPOS_TAREFA.includes(tipo) ? tipo : 'outro',
    titulo: String(titulo || '').trim() || NOME_TIPO_TAREFA[tipo] || 'Tarefa',
    prazo: prazo || null,
    prioridade: ['baixa', 'normal', 'alta'].includes(prioridade) ? prioridade : 'normal',
    obs: String(obs || '').trim(),
    status: 'pendente',
    conteudoNum: conteudoNum ? Number(conteudoNum) : null,
    criadoEm: new Date().toISOString(),
    concluidoEm: null,
    ultimoAviso: null,
  }
  db.tarefas.push(item)
  await salvar()
  return item
}

export const getTarefa = (num) => db.tarefas.find((t) => t.num === Number(num)) || null

export async function updateTarefa(num, patch = {}) {
  const t = getTarefa(num)
  if (!t) return null
  if (patch.titulo !== undefined) t.titulo = String(patch.titulo || '').trim()
  if (patch.obs !== undefined) t.obs = String(patch.obs || '').trim()
  if (patch.prazo !== undefined) t.prazo = patch.prazo || null
  if (patch.tipo && TIPOS_TAREFA.includes(patch.tipo)) t.tipo = patch.tipo
  if (patch.prioridade && ['baixa', 'normal', 'alta'].includes(patch.prioridade)) t.prioridade = patch.prioridade
  if (patch.status && STATUS_TAREFA.includes(patch.status)) {
    t.status = patch.status
    t.concluidoEm = patch.status === 'concluido' ? new Date().toISOString() : null
  }
  await salvar()
  return t
}

export async function deleteTarefa(num) {
  const antes = db.tarefas.length
  db.tarefas = db.tarefas.filter((t) => t.num !== Number(num))
  if (db.tarefas.length === antes) return false
  await salvar()
  return true
}

export function listTarefas({ clienteKey, status, atrasadas } = {}) {
  const hoje = hojeISO()
  return db.tarefas
    .filter((t) => !clienteKey || t.clienteKey === clienteKey)
    .filter((t) => !status || t.status === status)
    .filter((t) => !atrasadas || (t.status === 'pendente' && t.prazo && t.prazo < hoje))
    .sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999') || a.num - b.num)
}

// ---------- recorrências ----------

export async function addRecorrencia({ clienteKey, tipo = 'outro', diaSemana, hora = null, titulo = '' }) {
  const c = getCliente(clienteKey)
  if (!c) return null
  const r = {
    id: `${c.key}-${diaSemana}-${Date.now()}`,
    clienteKey: c.key,
    tipo: TIPOS_CONTEUDO.includes(tipo) ? tipo : 'outro',
    diaSemana: Number(diaSemana),
    hora: hora || null,
    titulo: String(titulo || '').trim(),
    ativa: true,
    ultimaGeracao: null,
  }
  db.recorrencias.push(r)
  await salvar()
  return r
}

export async function removerRecorrencia(id) {
  const antes = db.recorrencias.length
  db.recorrencias = db.recorrencias.filter((r) => r.id !== id)
  if (db.recorrencias.length === antes) return false
  await salvar()
  return true
}

export const listRecorrencias = (clienteKey) => db.recorrencias.filter((r) => !clienteKey || r.clienteKey === clienteKey)

/** Garante que cada recorrência ativa tenha um conteúdo gerado pra próxima ocorrência dela */
export async function gerarConteudosRecorrentes({ semanasAFrente = 2 } = {}) {
  const gerados = []
  const hoje = hojeISO()
  for (const r of db.recorrencias.filter((x) => x.ativa)) {
    for (let s = 0; s < semanasAFrente; s++) {
      const inicioSemana = somarDias(inicioDaSemana(hoje), s * 7)
      const data = somarDias(inicioSemana, r.diaSemana === 0 ? 6 : r.diaSemana - 1)
      if (data < hoje) continue
      const jaExiste = db.conteudos.some((c) => c.recorrenciaId === r.id && c.data === data)
      if (jaExiste) continue
      const item = await addConteudo({
        clienteKey: r.clienteKey, tipo: r.tipo,
        titulo: r.titulo || `${NOME_TIPO_TAREFA[r.tipo] ?? r.tipo}`,
      })
      item.data = data
      item.hora = r.hora
      item.status = 'agendado'
      item.recorrenciaId = r.id
      gerados.push(item)
    }
  }
  if (gerados.length) await salvar()
  return gerados
}

// ---------- visões agregadas ----------

/** Tudo (conteúdos + tarefas) marcado pra um dia específico */
export function itensDoDia(dataISO) {
  const conteudos = listConteudos({ dataISO }).map((c) => ({ ...c, _tipo: 'conteudo' }))
  const tarefas = db.tarefas.filter((t) => t.prazo === dataISO && t.status !== 'concluido').map((t) => ({ ...t, _tipo: 'tarefa' }))
  return [...conteudos, ...tarefas].sort((a, b) => (a.hora || a.prazo || '99:99').localeCompare(b.hora || '00:00'))
}

/** A semana inteira a partir de uma data (default: semana atual), seg→dom */
export function semana(dataISO = hojeISO()) {
  const inicio = inicioDaSemana(dataISO)
  const dias = []
  for (let i = 0; i < 7; i++) {
    const d = somarDias(inicio, i)
    dias.push({ data: d, diaSemana: diaDaSemana(d), itens: itensDoDia(d) })
  }
  return { inicio, fim: somarDias(inicio, 6), dias, fechada: db.semanasFechadas.includes(chaveSemana(dataISO)) }
}

export async function fecharSemana(dataISO = hojeISO()) {
  const chave = chaveSemana(dataISO)
  if (!db.semanasFechadas.includes(chave)) db.semanasFechadas.push(chave)
  await salvar()
  return chave
}

export const semanaFechada = (dataISO = hojeISO()) => db.semanasFechadas.includes(chaveSemana(dataISO))

export const conteudosNaoPlanejados = () => listConteudos({ semData: true }).filter((c) => c.status !== 'cancelado')
export const tarefasPendentes = () => listTarefas({ status: 'pendente' })
export const tarefasAtrasadas = () => listTarefas({ atrasadas: true })
export const conteudosProntosNaoPublicados = () => db.conteudos.filter((c) => c.status === 'pronto' && c.data && c.data <= hojeISO())

/** Painel "hoje" / "minha semana" */
export function dashboard() {
  const hoje = hojeISO()
  const hojeItens = itensDoDia(hoje)
  const semanaAtual = semana(hoje)
  const proximosDias = semanaAtual.dias.filter((d) => d.data > hoje).map((d) => ({ data: d.data, qtd: d.itens.length }))

  return {
    hoje: {
      publicar: hojeItens.filter((i) => i._tipo === 'conteudo' && i.status !== 'publicado' && i.status !== 'cancelado').length,
      editar: hojeItens.filter((i) => i._tipo === 'tarefa' && i.tipo === 'editar_video').length,
      tarefas: hojeItens.filter((i) => i._tipo === 'tarefa').length,
    },
    proximosDias,
    atrasadas: tarefasAtrasadas().length,
    naoPlanejados: conteudosNaoPlanejados().length,
    videosParaEditar: listTarefas({ status: 'pendente' }).filter((t) => t.tipo === 'editar_video').length,
    artesPendentes: listTarefas({ status: 'pendente' }).filter((t) => t.tipo === 'criar_arte').length,
    postsSemData: conteudosNaoPlanejados().length,
    semanaFechada: semanaFechada(hoje),
  }
}

/** Resumo por cliente, pra dentro da tela do cliente */
export function resumoCliente(clienteKey) {
  const hoje = hojeISO()
  const inicio = inicioDaSemana(hoje)
  const fim = somarDias(inicio, 6)
  const doCliente = listConteudos({ clienteKey })
  const daSemana = doCliente.filter((c) => c.data && c.data >= inicio && c.data <= fim)
  return {
    publicados: daSemana.filter((c) => c.status === 'publicado').length,
    agendados: daSemana.filter((c) => c.status === 'agendado').length,
    emEdicao: daSemana.filter((c) => c.status === 'edicao').length,
    pendentes: doCliente.filter((c) => !c.data && c.status !== 'cancelado').length,
    totalConteudos: doCliente.length,
    tarefasAbertas: listTarefas({ clienteKey, status: 'pendente' }).length,
  }
}

// ---------- controle de "já enviei esse aviso" ----------

export const jaAvisado = (dataISO, marca) => (db.enviados[dataISO] ?? []).includes(marca)
export async function marcarAvisado(dataISO, marca) {
  db.enviados[dataISO] ??= []
  if (!db.enviados[dataISO].includes(marca)) db.enviados[dataISO].push(marca)
  const chaves = Object.keys(db.enviados).sort()
  if (chaves.length > 60) for (const k of chaves.slice(0, chaves.length - 60)) delete db.enviados[k]
  await salvar()
}

// ---------- configurações ----------

export const getLembretesConfig = () => ({ ...db.settings.lembretes })
export async function setLembretesConfig(patch = {}) {
  db.settings.lembretes = { ...db.settings.lembretes, ...patch }
  await salvar()
  return db.settings.lembretes
}
