import { hojeISO, somarDias } from '../lib/agenda.js'
import {
  anotacaoDe, apagarAnotacao, buscarLeituras, listarAnotacoes,
  montarReferencias, salvarAnotacao, sequencia, substituirAnotacao,
} from '../lib/liturgia.js'

const dataBR = (iso) => { const [a, m, d] = iso.split('-'); return `${d}/${m}/${a}` }
const paraISO = (txt) => {
  const m = String(txt || '').match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/)
  return m ? `${m[3] || new Date().getFullYear()}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null
}

export default {
  name: 'ld',
  aliases: ['leituradodia', 'reflexao', 'reflexão'],
  description: 'Anota o que você entendeu da leitura do dia: /ld hoje entendi que...',
  categoria: 'fe',
  dono: true,

  async run({ sock, msg, chatId, args, text }) {
    const corpo = text.replace(/^[/!.]\S+\s*/, '').trim()
    const acao = (args[0] || '').toLowerCase()

    // /ld → mostra a anotação de hoje (ou cobra uma)
    if (!corpo) {
      const a = anotacaoDe()
      const l = await buscarLeituras()
      const refs = montarReferencias(l)

      if (!a) {
        return sock.sendMessage(chatId, {
          text:
            '🙏 *Leitura de hoje — ainda sem anotação*\n' +
            (l?.liturgia ? `\n✝️ _${l.liturgia}_\n` : '') +
            (refs ? `\n${refs}\n` : '') +
            '\n_Escreva o que você entendeu:_\n`/ld hoje entendi que...`',
        }, { quoted: msg })
      }

      const seq = sequencia()
      const hora = new Date(a.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      return sock.sendMessage(chatId, {
        text:
          `🙏 *O que você entendeu hoje*\n${refs ? `\n${refs}\n` : ''}\n${a.texto}\n\n` +
          `━━━━━━━━━━\n_Anotado às ${hora}${a.atualizadoEm ? ' · complementado depois' : ''}._` +
          (seq > 1 ? `\n🔥 _${seq} dias seguidos anotando._` : ''),
      }, { quoted: msg })
    }

    // /ld lista
    if (/^(lista|listar|historico|histórico)$/.test(acao)) {
      const todas = listarAnotacoes(15)
      if (!todas.length) throw new Error('Você ainda não anotou nenhuma leitura.')
      const linhas = todas.map((a) => {
        const resumo = a.texto.replace(/\n+/g, ' ')
        return `▸ *${dataBR(a.data)}* — ${resumo.slice(0, 70)}${resumo.length > 70 ? '…' : ''}`
      })
      return sock.sendMessage(chatId, {
        text: `🙏 *Suas últimas anotações* (${todas.length})\n\n${linhas.join('\n')}\n\n_Veja uma inteira com_ \`/ld ver 09/08\`_._`,
      }, { quoted: msg })
    }

    // /ld ver 09/08
    if (acao === 'ver') {
      const data = paraISO(args[1])
      if (!data) throw new Error('Use: */ld ver 09/08*')
      const a = anotacaoDe(data)
      if (!a) throw new Error(`Não tem anotação em ${dataBR(data)}.`)
      return sock.sendMessage(chatId, { text: `🙏 *${dataBR(data)}*\n\n${a.texto}` }, { quoted: msg })
    }

    // /ld apagar [09/08]
    if (/^(apagar|limpar|del)$/.test(acao)) {
      const data = paraISO(args[1]) ?? hojeISO()
      const ok = await apagarAnotacao(data)
      return sock.sendMessage(chatId, {
        text: ok ? `🗑️ Apaguei a anotação de ${dataBR(data)}.` : `Não tinha anotação em ${dataBR(data)}.`,
      }, { quoted: msg })
    }

    // /ld trocar <texto> — substitui em vez de somar
    if (/^(trocar|substituir|refazer)$/.test(acao)) {
      const novo = corpo.replace(/^\S+\s*/, '').trim()
      if (!novo) throw new Error('Escreva o novo texto: */ld trocar ...*')
      await substituirAnotacao(novo)
      return sock.sendMessage(chatId, { text: '✅ Troquei a anotação de hoje.' }, { quoted: msg })
    }

    // /ld [ontem] <texto>
    let data = hojeISO()
    let texto = corpo
    if (acao === 'ontem') {
      data = somarDias(data, -1)
      texto = corpo.replace(/^\S+\s*/, '').trim()
    }
    if (!texto) throw new Error('Escreva o que você entendeu: */ld hoje entendi que...*')

    const jaTinha = Boolean(anotacaoDe(data))
    await salvarAnotacao(texto, data)
    const seq = sequencia()

    await sock.sendMessage(chatId, {
      text:
        `🙏 *${jaTinha ? 'Somei à sua anotação' : 'Anotado'}${data !== hojeISO() ? ` de ${dataBR(data)}` : ''}.*\n\n` +
        `_"${texto.slice(0, 160)}${texto.length > 160 ? '…' : ''}"_` +
        (seq > 1 ? `\n\n🔥 *${seq} dias seguidos.* Continue.` : '') +
        (jaTinha ? '\n\n_Para trocar em vez de somar:_ `/ld trocar ...`' : ''),
    }, { quoted: msg })
  },
}
