const RESPOSTAS = [
  'Sim, com certeza! ✅',
  'Pode apostar que sim 💯',
  'Tudo indica que sim 👍',
  'Acho que sim... 🤔',
  'Talvez, quem sabe 🤷',
  'Pergunte de novo mais tarde 🔮',
  'Melhor não te contar agora 🤫',
  'Não conte com isso 😬',
  'Minha resposta é não ❌',
  'Definitivamente não 💀',
]

export default {
  name: 'sorte',
  aliases: ['8ball', 'bola8'],
  resumo: 'bola 8 mágica responde qualquer pergunta',
  description: 'Bola 8 mágica: faça uma pergunta de sim ou não — /sorte vou ficar rico?',
  categoria: 'diversao',

  async run({ sock, msg, chatId, args }) {
    if (args.length === 0) {
      throw new Error('Faça uma pergunta: /sorte vou ficar rico?')
    }
    const resposta = RESPOSTAS[Math.floor(Math.random() * RESPOSTAS.length)]
    await sock.sendMessage(chatId, { text: `🎱 ${resposta}` }, { quoted: msg })
  },
}
