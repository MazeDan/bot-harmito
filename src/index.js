// Precisa ser o PRIMEIRO import: acerta o fuso antes de qualquer Date existir.
import './tz.js'
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from 'baileys'
import pino from 'pino'
import qrcode from 'qrcode-terminal'
import { handleMessage, loadCommands } from './handler.js'
import { initAgenda } from './lib/agenda.js'
import { iniciarAgendador } from './lib/cobranca.js'
import { iniciarDonoAuth } from './lib/donoAuth.js'
import { initFinance } from './lib/finance.js'
import { arroba, limparCache, metadados } from './lib/grupo.js'
import { getGrupo, initGrupos, registrarGrupo } from './lib/grupos.js'
import { iniciarAgendaScheduler } from './lib/lembretes.js'
import { iniciarLiturgiaScheduler, initLiturgia } from './lib/liturgia.js'
import { iniciarProducaoScheduler } from './lib/producaoLembretes.js'
import { initProducao } from './lib/producao.js'
import { setSock } from './lib/wa.js'
import { iniciarPainel } from './web/server.js'

const logger = pino({ level: 'silent' })

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
  })

  setSock(sock)
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

  // Saudação a quem entra (ligada por grupo com /boasvindas)
  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    limparCache(id)
    if (action !== 'add') return

    const cfg = getGrupo(id)
    if (!cfg?.boasVindas) return

    try {
      const meta = await metadados(sock, id, { forcar: true })
      await registrarGrupo(id, meta?.subject)
      const nomes = participants.map((p) => arroba(p)).join(' ')
      let texto = `👋 Bem-vindo(a), ${nomes}!\n\nVocê entrou em *${meta?.subject ?? 'nosso grupo'}*.`
      if (cfg.regras) texto += `\n\n📜 *Regras*\n${cfg.regras}`
      texto += '\n\n_Digite_ `/menu` _para ver o que eu faço._'
      await sock.sendMessage(id, { text: texto, mentions: participants })
    } catch (err) {
      console.error('Erro nas boas-vindas:', err.message)
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
initAgenda()
initGrupos()
iniciarDonoAuth()
initLiturgia()
initProducao()
await loadCommands()
iniciarPainel()
iniciarAgendador()
iniciarAgendaScheduler()
iniciarLiturgiaScheduler()
iniciarProducaoScheduler()
await start()
