import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import ffmpeg from 'fluent-ffmpeg'
import webpmux from 'node-webpmux'
import sharp from 'sharp'
import { config } from '../config.js'

/**
 * Converte uma imagem (jpg/png/webp) em figurinha estática 512x512 com fundo transparente.
 */
export async function imageToSticker(buffer) {
  const webp = await sharp(buffer)
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 90 })
    .toBuffer()

  return addExif(webp)
}

/**
 * Reaplica os metadados (pack/autor) em um webp de figurinha já existente.
 * Funciona para estáticas e animadas — não reprocessa os frames.
 */
export async function rebrandSticker(webpBuffer) {
  return addExif(webpBuffer)
}

/**
 * Converte vídeo/gif em figurinha animada (webp animado 512x512).
 * Tenta com qualidade alta e vai reduzindo até caber no limite de tamanho.
 */
export async function videoToSticker(buffer) {
  const dir = await mkdtemp(path.join(tmpdir(), 'sticker-'))
  const input = path.join(dir, `in-${randomBytes(4).toString('hex')}`)

  try {
    await writeFile(input, buffer)

    // Tentativas: [qualidade, fps] — reduz até o arquivo caber em maxBytes
    const attempts = [
      [60, 15],
      [40, 12],
      [25, 10],
      [12, 8],
    ]

    for (const [quality, fps] of attempts) {
      const output = path.join(dir, `out-${quality}.webp`)
      await convertToAnimatedWebp(input, output, quality, fps)
      const webp = await readFile(output)
      if (webp.length <= config.sticker.maxBytes) {
        return addExif(webp)
      }
    }

    throw new Error('Não consegui reduzir o vídeo para o tamanho aceito pelo WhatsApp. Tente um vídeo mais curto.')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

function convertToAnimatedWebp(input, output, quality, fps) {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .inputOptions(['-t', String(config.sticker.maxVideoSeconds)])
      .outputOptions([
        '-vcodec', 'libwebp',
        '-vf',
        `scale=512:512:force_original_aspect_ratio=decrease,fps=${fps},pad=512:512:-1:-1:color=0x00000000`,
        '-loop', '0',
        '-an',
        '-q:v', String(quality),
        '-compression_level', '6',
      ])
      .output(output)
      .on('end', resolve)
      .on('error', reject)
      .run()
  })
}

/**
 * Embute os metadados EXIF (nome do pack e autor) no webp.
 */
async function addExif(webpBuffer) {
  const img = new webpmux.Image()
  await img.load(webpBuffer)

  const json = {
    'sticker-pack-id': `bot-figurinhas-${randomBytes(8).toString('hex')}`,
    'sticker-pack-name': config.sticker.packname,
    'sticker-pack-publisher': config.sticker.author,
  }

  const exifAttr = Buffer.from([
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
    0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
  ])
  const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf-8')
  const exif = Buffer.concat([exifAttr, jsonBuffer])
  exif.writeUIntLE(jsonBuffer.length, 14, 4)

  img.exif = exif
  return img.save(null)
}
