import { painelSenhaAutomatica, painelURL } from '../web/server.js'

export default {
  name: 'painel',
  aliases: ['dashboard', 'web'],
  description: 'Mostra o link do painel web de controle financeiro',

  async run({ sock, msg, chatId }) {
    const url = painelURL()
    if (!url) throw new Error('O painel web está desligado (config.web.ativo = false).')

    const senha = painelSenhaAutomatica()
    let texto = `🖥️ *Painel financeiro*\n\n${url}\n`
    texto += senha
      ? `\n🔑 Senha desta sessão: *${senha}*\n_(ela muda a cada reinício — defina PAINEL_TOKEN para fixar)_`
      : '\n_Entre com a senha que você configurou em PAINEL_TOKEN._'

    await sock.sendMessage(chatId, { text: texto }, { quoted: msg })
  },
}
