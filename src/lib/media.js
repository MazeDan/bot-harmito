import { downloadMediaMessage } from 'baileys'

/**
 * Encontra a mídia relevante para o comando: na própria mensagem
 * ou na mensagem citada (reply). Retorna { kind: 'image' | 'video', message }
 * ou null se não houver mídia.
 */
export function findMedia(msg) {
  const content = msg.message
  if (!content) return null

  const direct = pickMedia(content)
  if (direct) return { ...direct, sourceMsg: msg }

  const quoted =
    content.extendedTextMessage?.contextInfo?.quotedMessage ??
    content.imageMessage?.contextInfo?.quotedMessage ??
    content.videoMessage?.contextInfo?.quotedMessage
  if (quoted) {
    const found = pickMedia(quoted)
    if (found) {
      // Monta um "msg" mínimo para o downloadMediaMessage funcionar com a citada
      const fakeMsg = { key: msg.key, message: quoted }
      return { ...found, sourceMsg: fakeMsg }
    }
  }

  return null
}

function pickMedia(content) {
  if (content.imageMessage) return { kind: 'image' }
  if (content.videoMessage) return { kind: 'video' }
  if (content.stickerMessage) {
    return { kind: 'sticker', animated: Boolean(content.stickerMessage.isAnimated) }
  }
  return null
}

export async function downloadMedia(sourceMsg, sock) {
  return downloadMediaMessage(sourceMsg, 'buffer', {}, {
    logger: undefined,
    reuploadRequest: sock.updateMediaMessage,
  })
}
