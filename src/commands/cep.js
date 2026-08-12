export default {
  name: 'cep',
  aliases: ['endereco', 'endereço'],
  resumo: 'endereço de um CEP',
  description: 'Consulta um CEP: /cep 40010-000',
  categoria: 'utilidades',

  async run({ sock, msg, chatId, args }) {
    const cep = (args[0] || '').replace(/\D/g, '')
    if (cep.length !== 8) throw new Error('Me dê um CEP com 8 dígitos: */cep 40010-000*')

    let d
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 12000)
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: ctrl.signal })
      clearTimeout(t)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      d = await res.json()
    } catch {
      throw new Error('Não consegui consultar o CEP agora. Tente daqui a pouco.')
    }

    if (d.erro) throw new Error(`CEP *${cep.replace(/(\d{5})(\d{3})/, '$1-$2')}* não existe.`)

    const linhas = [
      d.logradouro && `📍 ${d.logradouro}`,
      d.complemento && `   _${d.complemento}_`,
      d.bairro && `🏘️ ${d.bairro}`,
      `🏙️ ${d.localidade} — ${d.uf}${d.estado && d.estado !== d.uf ? ` _(${d.estado})_` : ''}`,
      d.ddd && `📞 DDD ${d.ddd}`,
    ].filter(Boolean)

    await sock.sendMessage(chatId, {
      text: `📮 *CEP ${d.cep}*\n\n${linhas.join('\n')}`,
    }, { quoted: msg })
  },
}
