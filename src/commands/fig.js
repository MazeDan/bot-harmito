import { downloadMedia, findMedia } from '../lib/media.js'
import { imageToSticker, videoToSticker } from '../lib/sticker.js'

export default {
  name: 'fig',
  aliases: ['s', 'sticker', 'figurinha'],
  description: 'Cria figurinha de uma imagem, vídeo ou gif (envie com a legenda ou responda a mídia)',
  heavy: true,

  async run({ sock, msg, chatId }) {
    const media = findMedia(msg)
    if (!media) {
      throw new Error('Envie uma *imagem/vídeo* com a legenda /fig, ou responda a uma mídia com /fig.')
    }

    const buffer = await downloadMedia(media.sourceMsg, sock)

    const sticker =
      media.kind === 'video'
        ? await videoToSticker(buffer)
        : await imageToSticker(buffer)

    await sock.sendMessage(chatId, { sticker }, { quoted: msg })
  },
}
