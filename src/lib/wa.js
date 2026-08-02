/** Guarda a conexão do WhatsApp para que o painel web também consiga enviar mensagens. */
let sock = null

export const setSock = (s) => { sock = s }
export const getSock = () => sock
export const isOnline = () => Boolean(sock?.user)

export async function sendText(jid, text) {
  if (!sock) throw new Error('Bot não está conectado ao WhatsApp.')
  return sock.sendMessage(jid, { text })
}
