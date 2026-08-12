export default {
  name: 'escolher',
  aliases: ['escolha', 'pick'],
  resumo: 'escolhe uma opção por você',
  description: 'Escolhe uma opção por você: /escolher pizza, hambúrguer, sushi',
  categoria: 'diversao',

  async run({ sock, msg, chatId, args }) {
    const opcoes = args
      .join(' ')
      .split(/,|\bou\b/)
      .map((o) => o.trim())
      .filter(Boolean)

    if (opcoes.length < 2) {
      throw new Error('Dê pelo menos 2 opções separadas por vírgula: /escolher pizza, sushi')
    }

    const escolhida = opcoes[Math.floor(Math.random() * opcoes.length)]
    await sock.sendMessage(chatId, { text: `🤔 Eu escolho... *${escolhida}*!` }, { quoted: msg })
  },
}
