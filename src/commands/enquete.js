export default {
  name: 'enquete',
  aliases: ['votacao', 'votação', 'poll'],
  description: 'Cria uma enquete: /enquete Vamos sair? | sim | não | talvez',
  categoria: 'grupo',

  async run({ sock, msg, chatId, text }) {
    // tudo depois do comando, separado por |
    const corpo = text.replace(/^[/!.]\S+\s*/, '')
    const partes = corpo.split('|').map((p) => p.trim()).filter(Boolean)

    if (partes.length < 3) {
      throw new Error(
        'Use assim: */enquete Vamos sair? | sim | não | talvez*\n\n' +
        '_Separe a pergunta e as opções por barra vertical (|). Mínimo 2 opções._',
      )
    }

    const [pergunta, ...opcoes] = partes
    if (opcoes.length > 12) throw new Error('O WhatsApp aceita no máximo 12 opções.')

    await sock.sendMessage(chatId, {
      poll: { name: pergunta, values: opcoes, selectableCount: 1 },
    })
  },
}
