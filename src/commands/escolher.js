export default {
  name: 'escolher',
  aliases: ['escolha', 'pick'],
  description: 'Escolhe uma opção por você: /escolher pizza, hambúrguer, sushi',

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
