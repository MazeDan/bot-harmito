import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import PQueue from 'p-queue'
import { config } from './config.js'
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

export async function handleMessage(sock, msg) {
  if (!msg.message || msg.key.fromMe) return

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
