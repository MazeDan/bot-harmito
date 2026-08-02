import { painelURL } from '../web/server.js'

export default {
  name: 'painel',
  aliases: ['dashboard', 'web'],
  description: 'Mostra o link do painel web de controle financeiro',

  async run({ sock, msg, chatId }) {
    const url = painelURL()
    if (!url) throw new Error('O painel web está desligado (config.web.ativo = false).')
    await sock.sendMessage(
      chatId,
      { text: `🖥️ *Painel financeiro*\n\n${url}\n\n_Abra no navegador da máquina onde o bot está rodando. O link já vem com o token de acesso — não repasse._` },
      { quoted: msg },
    )
  },
}
