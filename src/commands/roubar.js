import { downloadMedia, findMedia } from '../lib/media.js'
import { rebrandSticker } from '../lib/sticker.js'

export default {
  name: 'roubar',
  aliases: ['steal', 'rename'],
  description: 'Rouba uma figurinha: responda a uma figurinha e ela volta com o pack do bot',
  heavy: true,

  async run({ sock, msg, chatId }) {
    const media = findMedia(msg)
    if (!media || media.kind !== 'sticker') {
      throw new Error('Responda a uma *figurinha* com /roubar.')
    }

    const webp = await downloadMedia(media.sourceMsg, sock)
    const sticker = await rebrandSticker(webp)
    await sock.sendMessage(chatId, { sticker }, { quoted: msg })
  },
}
