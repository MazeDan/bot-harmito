import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import ffmpeg from 'fluent-ffmpeg'
import { downloadMedia, findMedia } from '../lib/media.js'

const MAX_BYTES = 16 * 1024 * 1024 // o WhatsApp rejeita documentos de áudio muito grandes

export default {
  name: 'audio',
  aliases: ['mp3', 'som'],
  description: 'Tira o áudio de um vídeo (mp3) — responda a um vídeo ou mande com a legenda /audio',
  heavy: true,

  async run({ sock, msg, chatId, args }) {
    const media = findMedia(msg)
    if (!media || media.kind !== 'video') {
      throw new Error(
        'Responda a um *vídeo* com */audio* — ou mande o vídeo já com a legenda `/audio`.\n\n' +
        '▸ `/audio voz` manda como mensagem de voz\n' +
        '▸ `/audio 0:10 0:35` corta só esse trecho',
      )
    }

    // /audio voz  → envia como PTT (mensagem de voz) em vez de arquivo
    const comoVoz = args.some((a) => /^(voz|ptt)$/i.test(a))
    // /audio 0:10 0:35 → corta o trecho
    const tempos = args.filter((a) => /^\d{1,2}(:\d{1,2}){0,2}$/.test(a)).slice(0, 2)

    const video = await downloadMedia(media.sourceMsg, sock)
    const { buffer, segundos } = await extrairAudio(video, { comoVoz, tempos })

    if (buffer.length > MAX_BYTES) {
      throw new Error(
        `O áudio ficou com ${(buffer.length / 1048576).toFixed(1)} MB e o WhatsApp não aceita. ` +
        'Corte um trecho: `/audio 0:00 2:00`',
      )
    }

    const nome = `audio-${new Date().toISOString().slice(0, 10)}-${randomBytes(2).toString('hex')}`

    if (comoVoz) {
      await sock.sendMessage(chatId, { audio: buffer, mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted: msg })
      return
    }

    await sock.sendMessage(
      chatId,
      {
        document: buffer,
        mimetype: 'audio/mpeg',
        fileName: `${nome}.mp3`,
        caption: `🎵 Áudio extraído${segundos ? ` — ${formatarDuracao(segundos)}` : ''} · ${(buffer.length / 1048576).toFixed(1)} MB`,
      },
      { quoted: msg },
    )
  },
}

/** Roda o ffmpeg num diretório temporário e devolve o buffer do áudio */
export async function extrairAudio(videoBuffer, { comoVoz = false, tempos = [] } = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'audio-'))
  const input = path.join(dir, `${randomBytes(4).toString('hex')}.mp4`)
  const output = path.join(dir, comoVoz ? 'out.ogg' : 'out.mp3')

  try {
    await writeFile(input, videoBuffer)

    await new Promise((resolve, reject) => {
      const cmd = ffmpeg(input).noVideo()

      if (tempos[0]) cmd.setStartTime(tempos[0])
      if (tempos[1]) cmd.setDuration(paraSegundos(tempos[1]) - paraSegundos(tempos[0] ?? '0'))

      if (comoVoz) {
        // opus mono 48k é o formato que o WhatsApp usa em mensagem de voz
        cmd.audioCodec('libopus').audioChannels(1).audioFrequency(48000).audioBitrate('64k').format('ogg')
      } else {
        cmd.audioCodec('libmp3lame').audioBitrate('128k').format('mp3')
      }

      cmd.output(output)
        .on('end', resolve)
        .on('error', (err) => reject(new Error(`ffmpeg falhou: ${err.message}`)))
        .run()
    })

    const buffer = await readFile(output)
    const segundos = tempos[1] ? paraSegundos(tempos[1]) - paraSegundos(tempos[0] ?? '0') : null
    return { buffer, segundos }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/** "1:23" → 83 · "0:01:23" → 83 · "45" → 45 */
function paraSegundos(t) {
  const partes = String(t).split(':').map(Number).reverse()
  return (partes[0] || 0) + (partes[1] || 0) * 60 + (partes[2] || 0) * 3600
}

const formatarDuracao = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
