import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { downloadMediaMessage } from 'baileys'
import PQueue from 'p-queue'
import { config } from './config.js'
import { getSettings, money, saveStatement, setSettings } from './lib/finance.js'
import { ehGrupo, permitido, registrarGrupo } from './lib/grupos.js'
import { metadados } from './lib/grupo.js'
import { parseExtrato } from './lib/pdfExtrato.js'
import { allow } from './lib/rateLimit.js'
import * as pr from './lib/producao.js'
import { montarCliente, montarHoje, montarPendencias, montarSemana } from './commands/producao.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const commands = new Map()
const mediaQueue = new PQueue({ concurrency: config.concurrency })

/**
 * Carrega todos os comandos da pasta src/commands.
 * Cada arquivo exporta default: { name, aliases, description, heavy, run }
 */
export async function loadCommands() {
  const dir = path.join(__dirname, 'commands')
  const files = (await readdir(dir)).filter((f) => f.endsWith('.js'))

  for (const file of files) {
    const mod = await import(pathToFileURL(path.join(dir, file)).href)
    const cmd = mod.default
    if (!cmd?.name || !cmd?.run) continue
    commands.set(cmd.name, cmd)
    for (const alias of cmd.aliases ?? []) commands.set(alias, cmd)
  }

  console.log(`✅ ${files.length} comandos carregados: ${files.map((f) => f.replace('.js', '')).join(', ')}`)
}

/**
 * Extrai o texto de qualquer tipo de mensagem (texto, legenda de imagem/vídeo).
 */
function getText(msg) {
  const m = msg.message
  return (
    m?.conversation ??
    m?.extendedTextMessage?.text ??
    m?.imageMessage?.caption ??
    m?.videoMessage?.caption ??
    ''
  )
}

/** Detecta um PDF anexado (com ou sem legenda) */
function getPdf(msg) {
  const m = msg.message
  const doc = m?.documentMessage || m?.documentWithCaptionMessage?.message?.documentMessage
  if (!doc) return null
  const isPdf = (doc.mimetype || '').includes('pdf') || (doc.fileName || '').toLowerCase().endsWith('.pdf')
  if (!isPdf) return null
  return { doc, caption: doc.caption || '', fileName: doc.fileName || 'extrato.pdf' }
}

/** Recebe o extrato em PDF, lê as saídas do mês e guarda na conta (nome = legenda) */
async function handlePdf(sock, msg, pdf) {
  const chatId = msg.key.remoteJid
  // nome da conta vem da legenda (aceita "/extrato Nubank" ou só "Nubank")
  let account = pdf.caption.replace(/^[/!.]?\s*extrato\s*/i, '').trim()
  if (!account) {
    await sock.sendMessage(
      chatId,
      { text: '📄 Recebi o PDF! Só me diga *de qual conta* ele é — reenvie o arquivo com o nome na *legenda* (ex.: `Nubank`).' },
      { quoted: msg },
    )
    return
  }

  await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } })
  const buffer = await downloadMediaMessage(
    { key: msg.key, message: { documentMessage: pdf.doc } },
    'buffer', {}, { reuploadRequest: sock.updateMediaMessage },
  )

  const r = await parseExtrato(buffer)
  if (!r.ok) {
    await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } })
    await sock.sendMessage(chatId, { text: `❌ ${r.error}` }, { quoted: msg })
    return
  }

  await saveStatement(account, r)
  await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } })

  const amostra = r.amostra.length
    ? '\n\n🔎 _Exemplos de saídas lidas:_\n' + r.amostra.map((a) => `▸ ${money(a.v)} — ${a.line}`).join('\n')
    : ''
  await sock.sendMessage(
    chatId,
    {
      text:
        `📄 *Extrato — ${account}*\n📅 Mês: *${r.month}*\n\n` +
        `💸 Saídas (gastos): *${money(r.saidas)}*  (${r.count} lançamentos)\n` +
        `💰 Entradas: ${money(r.entradas)}${amostra}\n\n` +
        `_Guardado! Veja o resumo geral com_ */contas*.\n` +
        `_Se algum valor ficou errado, me manda um print do extrato que eu ajusto a leitura pro seu banco._`,
    },
    { quoted: msg },
  )
}

const semAcento = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * Comandos de produção sem prefixo — "publicado 7", "concluí 12", frases como
 * "o que tenho hoje". Só roda no privado do dono, pra não confundir conversa
 * normal com comando. Devolve true se tratou a mensagem.
 */
async function tentarComandoLivreProducao(sock, msg, chatId, textoOriginal) {
  const t = semAcento(textoOriginal).replace(/[?!.]+$/, '')

  let m = t.match(/^(publicado|publiquei)\s*#?(\d+)$/)
  if (m) {
    const c = pr.getConteudo(m[2])
    if (!c) throw new Error(`Não achei o conteúdo #${m[2]}.`)
    await pr.updateConteudo(c.num, { status: 'publicado' })
    await sock.sendMessage(chatId, { text: `🚀 *${c.titulo || c.tipo}* marcado como publicado.` }, { quoted: msg })
    return true
  }

  m = t.match(/^(conclui|concluido|concluída|concluida|feito)\s*#?(\d+)$/)
  if (m) {
    const tarefa = pr.getTarefa(m[2])
    if (!tarefa) throw new Error(`Não achei a tarefa #${m[2]}.`)
    await pr.updateTarefa(tarefa.num, { status: 'concluido' })
    await sock.sendMessage(chatId, { text: `✅ *${tarefa.titulo}* concluída.` }, { quoted: msg })
    return true
  }

  m = t.match(/^adiar\s*#?(\d+)(?:\s+(?:para\s+)?(amanha|\d{1,2}\/\d{1,2}))?$/)
  if (m) {
    const num = m[1]
    const alvo = m[2]
    const conteudo = pr.getConteudo(num)
    const tarefa = conteudo ? null : pr.getTarefa(num)
    if (!conteudo && !tarefa) throw new Error(`Não achei #${num} (nem conteúdo, nem tarefa).`)

    const base = conteudo ? (conteudo.data || pr.hojeISO()) : (tarefa.prazo || pr.hojeISO())
    let novaData
    if (!alvo || alvo === 'amanha') novaData = pr.somarDias(base, 1)
    else {
      const [d, mo] = alvo.split('/').map(Number)
      novaData = `${new Date().getFullYear()}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }

    if (conteudo) await pr.agendarConteudo(conteudo.num, novaData, conteudo.hora)
    else await pr.updateTarefa(tarefa.num, { prazo: novaData })
    await sock.sendMessage(chatId, { text: `📅 Adiado para *${pr.rotuloData(novaData)}*.` }, { quoted: msg })
    return true
  }

  const FRASES = [
    [/^o que tenho hoje$/, () => montarHoje()],
    [/^(minhas pendencias|pendencias)$/, () => montarPendencias()],
    [/^o que preciso postar$/, () => montarHoje()],
    [/^planejamento da semana$/, () => montarSemana()],
    [/^o que esta atrasado$/, () => montarPendencias()],
    [/^hoje$/, () => montarHoje()],
    [/^semana$/, () => montarSemana()],
  ]
  for (const [re, gerar] of FRASES) {
    if (re.test(t)) { await sock.sendMessage(chatId, { text: gerar() }, { quoted: msg }); return true }
  }

  m = t.match(/^mostrar\s+(.+)$/)
  if (m && pr.getCliente(m[1])) {
    await sock.sendMessage(chatId, { text: montarCliente(m[1]) }, { quoted: msg })
    return true
  }

  return false
}

export async function handleMessage(sock, msg) {
  if (!msg.message || msg.key.fromMe) return

  // PDF de extrato bancário
  const pdf = getPdf(msg)
  if (pdf) {
    const userId = msg.key.participant ?? msg.key.remoteJid
    if (!allow(userId)) return
    try {
      await handlePdf(sock, msg, pdf)
    } catch (err) {
      console.error('Erro ao processar PDF:', err)
      await sock.sendMessage(msg.key.remoteJid, { text: `❌ Não consegui processar o PDF: ${err.message}` }, { quoted: msg })
    }
    return
  }

  const text = getText(msg).trim()
  if (!text) return

  const prefix = config.prefixes.find((p) => text.startsWith(p))
  if (!prefix) {
    // Sem barra: só tenta interpretar como comando de produção no privado do dono
    const chatIdLivre = msg.key.remoteJid
    const userIdLivre = msg.key.participant ?? msg.key.remoteJid
    if (!ehGrupo(chatIdLivre) && getSettings().donoUser && userIdLivre === getSettings().donoUser) {
      try {
        await tentarComandoLivreProducao(sock, msg, chatIdLivre, text)
      } catch (err) {
        await sock.sendMessage(chatIdLivre, { text: `❌ ${err.message}` }, { quoted: msg }).catch(() => {})
      }
    }
    return
  }

  const [rawName, ...args] = text.slice(prefix.length).trim().split(/\s+/)
  const cmd = commands.get(rawName.toLowerCase())
  if (!cmd) return

  const chatId = msg.key.remoteJid
  const userId = msg.key.participant ?? msg.key.remoteJid

  // registra o grupo (para ele aparecer no painel) sem travar o comando
  if (ehGrupo(chatId)) {
    metadados(sock, chatId)
      .then((meta) => registrarGrupo(chatId, meta?.subject))
      .catch(() => registrarGrupo(chatId))
  }

  // comandos do dono: financeiro, agenda e configuração
  if (cmd.dono) {
    const dono = getSettings().donoUser
    if (!dono) {
      // primeiro a usar vira o dono — evita ficar trancado do lado de fora
      await setSettings({ donoUser: userId })
      console.log(`👑 Dono definido: ${userId}`)
      await sock.sendMessage(chatId, {
        text: '👑 Você agora é o dono do bot.\n\n_Só você usa os comandos de financeiro e agenda. Veja como transferir com_ */dono*_._',
      }, { quoted: msg })
    } else if (userId !== dono) {
      return // silencioso de propósito: ninguém precisa saber que o comando existe
    }
  } else {
    // demais comandos respeitam o que está liberado para aquele grupo
    const r = permitido(cmd, chatId)
    if (!r.ok) {
      if (r.motivo !== 'silenciado') {
        await sock.sendMessage(chatId, { react: { text: '🚫', key: msg.key } })
      }
      return
    }
  }

  if (!allow(userId)) {
    await sock.sendMessage(chatId, {
      react: { text: '🕒', key: msg.key },
    })
    return
  }

  const ctx = { sock, msg, chatId, userId, args, text, ehGrupo: ehGrupo(chatId) }

  try {
    // Comandos pesados (conversão de mídia) passam pela fila; os leves rodam direto
    if (cmd.heavy) {
      await sock.sendMessage(chatId, { react: { text: '⏳', key: msg.key } })
      await mediaQueue.add(() => cmd.run(ctx))
      await sock.sendMessage(chatId, { react: { text: '✅', key: msg.key } })
    } else {
      await cmd.run(ctx)
    }
  } catch (err) {
    console.error(`Erro no comando ${cmd.name}:`, err)
    await sock.sendMessage(chatId, { react: { text: '❌', key: msg.key } })
    await sock.sendMessage(
      chatId,
      { text: `❌ ${err.message ?? 'Deu erro aqui, tenta de novo.'}` },
      { quoted: msg },
    )
  }
}
