import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { downloadMediaMessage } from 'baileys'
import PQueue from 'p-queue'
import { config } from './config.js'
import { money, saveStatement } from './lib/finance.js'
import { parseExtrato } from './lib/pdfExtrato.js'
import { allow } from './lib/rateLimit.js'

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
  if (!prefix) return

  const [rawName, ...args] = text.slice(prefix.length).trim().split(/\s+/)
  const cmd = commands.get(rawName.toLowerCase())
  if (!cmd) return

  const chatId = msg.key.remoteJid
  const userId = msg.key.participant ?? msg.key.remoteJid

  if (!allow(userId)) {
    await sock.sendMessage(chatId, {
      react: { text: '🕒', key: msg.key },
    })
    return
  }

  const ctx = { sock, msg, chatId, userId, args, text }

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
