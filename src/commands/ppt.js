const OPCOES = {
  pedra: '🪨',
  papel: '📄',
  tesoura: '✂️',
}

const GANHA_DE = {
  pedra: 'tesoura',
  papel: 'pedra',
  tesoura: 'papel',
}

export default {
  name: 'ppt',
  aliases: ['jokenpo'],
  description: 'Pedra, papel e tesoura contra o bot: /ppt pedra',

  async run({ sock, msg, chatId, args }) {
    const jogada = args[0]?.toLowerCase()
    if (!OPCOES[jogada]) {
      throw new Error('Escolha: /ppt *pedra*, *papel* ou *tesoura*')
    }

    const nomes = Object.keys(OPCOES)
    const bot = nomes[Math.floor(Math.random() * nomes.length)]

    let resultado
    if (jogada === bot) resultado = '🤝 Empate!'
    else if (GANHA_DE[jogada] === bot) resultado = '🎉 Você ganhou!'
    else resultado = '😈 Eu ganhei!'

    await sock.sendMessage(
      chatId,
      { text: `Você: ${OPCOES[jogada]}  vs  Bot: ${OPCOES[bot]}\n\n${resultado}` },
      { quoted: msg },
    )
  },
}
