import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import ffmpeg from 'fluent-ffmpeg'
import webpmux from 'node-webpmux'
import sharp from 'sharp'
import { config } from '../config.js'

/**
 * Duas formas de recortar:
 *  - 'quadrada' → 512x512 preenchido, cortando o que sobra nas bordas
 *  - 'inteira'  → mantém a proporção original, maior lado em 512, sem cortar
 */
export const MODOS = ['quadrada', 'inteira']

/** Foto muito perto de um quadrado? Aí as duas versões dariam quase igual. */
export const quaseQuadrada = (largura, altura) => {
  if (!largura || !altura) return false
  const r = largura / altura
  return r > 0.95 && r < 1.05
}

/** Dimensões da imagem, para decidir se vale mandar as duas versões */
export async function dimensoesImagem(buffer) {
  const { width, height, pages } = await sharp(buffer).metadata()
  return { largura: width ?? 0, altura: height ?? 0, animada: (pages ?? 1) > 1 }
}

/**
 * Converte uma imagem (jpg/png/webp) em figurinha.
 */
export async function imageToSticker(buffer, { modo = 'quadrada' } = {}) {
  const img = sharp(buffer)

  const redimensionada = modo === 'inteira'
    // 'inside' encolhe até caber em 512, mantendo a proporção e sem preencher nada
    ? img.resize(512, 512, { fit: 'inside', withoutEnlargement: false })
    // 'cover' preenche o quadrado e corta o excedente, centralizado
    : img.resize(512, 512, { fit: 'cover', position: 'centre' })

  const webp = await redimensionada.webp({ quality: 90 }).toBuffer()
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
export async function videoToSticker(buffer, { modo = 'quadrada' } = {}) {
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
      const output = path.join(dir, `out-${modo}-${quality}.webp`)
      await convertToAnimatedWebp(input, output, quality, fps, modo)
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

/** Largura e altura do vídeo, sem depender de baixar tudo de novo */
export function dimensoesVideo(caminho) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(caminho, (err, dados) => {
      if (err) return resolve({ largura: 0, altura: 0 })
      const v = (dados?.streams ?? []).find((s) => s.codec_type === 'video')
      resolve({ largura: v?.width ?? 0, altura: v?.height ?? 0 })
    })
  })
}

/** Mesma escolha de recorte da imagem, agora em filtro do ffmpeg */
const filtroEscala = (modo) =>
  modo === 'inteira'
    // encolhe até caber em 512 no maior lado, sem preencher nem cortar
    ? 'scale=512:512:force_original_aspect_ratio=decrease'
    // aumenta até cobrir o quadrado e corta o excedente, centralizado
    : 'scale=512:512:force_original_aspect_ratio=increase,crop=512:512'

function convertToAnimatedWebp(input, output, quality, fps, modo = 'quadrada') {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .inputOptions(['-t', String(config.sticker.maxVideoSeconds)])
      .outputOptions([
        '-vcodec', 'libwebp',
        '-vf', `${filtroEscala(modo)},fps=${fps}`,
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
