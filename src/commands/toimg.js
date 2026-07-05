import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import ffmpeg from 'fluent-ffmpeg'
import sharp from 'sharp'
import { downloadMedia, findMedia } from '../lib/media.js'

export default {
  name: 'toimg',
  aliases: ['togif', 'imagem'],
  description: 'Transforma figurinha de volta em imagem (ou gif, se for animada) — responda a uma figurinha',
  heavy: true,

  async run({ sock, msg, chatId }) {
    const media = findMedia(msg)
    if (!media || media.kind !== 'sticker') {
      throw new Error('Responda a uma *figurinha* com /toimg.')
    }

    const webp = await downloadMedia(media.sourceMsg, sock)
    const meta = await sharp(webp, { animated: true }).metadata()

    if ((meta.pages ?? 1) > 1) {
      // Animada: webp → gif (sharp) → mp4 (ffmpeg) e envia como gif
      const gif = await sharp(webp, { animated: true }).gif().toBuffer()
      const mp4 = await gifToMp4(gif)
      await sock.sendMessage(chatId, { video: mp4, gifPlayback: true }, { quoted: msg })
    } else {
      const png = await sharp(webp).png().toBuffer()
      await sock.sendMessage(chatId, { image: png }, { quoted: msg })
    }
  },
}

async function gifToMp4(gifBuffer) {
  const dir = await mkdtemp(path.join(tmpdir(), 'toimg-'))
  const input = path.join(dir, `${randomBytes(4).toString('hex')}.gif`)
  const output = path.join(dir, 'out.mp4')

  try {
    await writeFile(input, gifBuffer)
    await new Promise((resolve, reject) => {
      ffmpeg(input)
        .outputOptions([
          '-movflags', 'faststart',
          '-pix_fmt', 'yuv420p',
          // Dimensões precisam ser pares para o yuv420p
          '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        ])
        .output(output)
        .on('end', resolve)
        .on('error', reject)
        .run()
    })
    return await readFile(output)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
