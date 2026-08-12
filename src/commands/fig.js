import { randomBytes } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { config } from '../config.js'
import { downloadMedia, findMedia } from '../lib/media.js'
import {
  dimensoesImagem, dimensoesVideo, imageToSticker, quaseQuadrada, videoToSticker,
} from '../lib/sticker.js'

/** /fig quadrada · /fig inteira — sem nada, manda as duas */
function lerModo(args) {
  const a = (args[0] || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (/^(q|quadrada|quadrado|corte|cortada|crop)$/.test(a)) return 'quadrada'
  if (/^(i|inteira|inteiro|original|completa|full|toda)$/.test(a)) return 'inteira'
  return null
}

export default {
  name: 'fig',
  aliases: ['f', 's', 'sticker', 'figurinha'],
  resumo: 'imagem ou vídeo vira figurinha',
  description: 'Cria figurinha de imagem, vídeo ou gif. Manda a quadrada e a inteira (ou /fig q, /fig i)',
  categoria: 'midia',
  heavy: true,

  async run({ sock, msg, chatId, args }) {
    const media = findMedia(msg)
    if (!media) {
      throw new Error(
        'Envie uma *imagem/vídeo* com a legenda */f*, ou responda a uma mídia com */f*.\n\n' +
        '▸ `/f` manda a versão *quadrada* e a *inteira*\n' +
        '▸ `/f q` só a quadrada · `/f i` só a inteira',
      )
    }

    const buffer = await downloadMedia(media.sourceMsg, sock)
    const pedido = lerModo(args)
    const ehVideo = media.kind === 'video'

    // se a mídia já é quadrada, as duas versões sairiam iguais
    let dimensoes = { largura: 0, altura: 0 }
    let temp = null
    try {
      if (ehVideo) {
        temp = await mkdtemp(path.join(tmpdir(), 'fig-'))
        const arquivo = path.join(temp, `v-${randomBytes(3).toString('hex')}`)
        await writeFile(arquivo, buffer)
        dimensoes = await dimensoesVideo(arquivo)
      } else {
        dimensoes = await dimensoesImagem(buffer)
      }
    } catch { /* sem dimensões: seguimos com o padrão */ }
    finally {
      if (temp) await rm(temp, { recursive: true, force: true })
    }

    const jaEhQuadrada = quaseQuadrada(dimensoes.largura, dimensoes.altura)

    const modos = pedido ? [pedido]
      : (!config.sticker.duasVersoes || jaEhQuadrada) ? ['quadrada']
      : ['inteira', 'quadrada'] // a inteira primeiro: é a que costuma ser a certa

    for (const modo of modos) {
      const sticker = ehVideo
        ? await videoToSticker(buffer, { modo })
        : await imageToSticker(buffer, { modo })
      await sock.sendMessage(chatId, { sticker }, { quoted: msg })
    }
  },
}
