import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from 'baileys'
import pino from 'pino'
import qrcode from 'qrcode-terminal'
import { handleMessage, loadCommands } from './handler.js'
import { initFinance } from './lib/finance.js'

const logger = pino({ level: 'silent' })

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\n📱 Escaneie o QR code abaixo com o WhatsApp (Aparelhos conectados):\n')
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'open') {
      console.log('🟢 Bot conectado!')
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode
      if (statusCode === DisconnectReason.loggedOut) {
        console.log('🔴 Sessão deslogada. Apague a pasta "auth" e escaneie o QR de novo.')
        process.exit(1)
      }
      console.log('🟡 Conexão caiu, reconectando...')
      start()
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      handleMessage(sock, msg).catch((err) => console.error('Erro no handler:', err))
    }
  })
}

initFinance()
await loadCommands()
await start()
