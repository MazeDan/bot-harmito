/**
 * Calculadora. Avalia a expressão com um parser próprio — nada de eval,
 * que abriria a porta para rodar código qualquer vindo do WhatsApp.
 */

const FUNCOES = {
  raiz: Math.sqrt, sqrt: Math.sqrt, abs: Math.abs,
  arredondar: Math.round, round: Math.round, teto: Math.ceil, piso: Math.floor,
  sen: Math.sin, cos: Math.cos, tan: Math.tan, log: Math.log10, ln: Math.log,
}
const CONSTANTES = { pi: Math.PI, e: Math.E }

/** Converte a expressão em tokens: números, operadores, parênteses e nomes */
function tokenizar(entrada) {
  const t = []
  const s = entrada.replace(/\s+/g, '').replace(/,/g, '.').replace(/[x×]/gi, '*').replace(/÷/g, '/').replace(/\^/g, '**')
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (/[0-9.]/.test(c)) {
      let n = ''
      while (i < s.length && /[0-9.]/.test(s[i])) n += s[i++]
      if ((n.match(/\./g) || []).length > 1) throw new Error(`número inválido: ${n}`)
      t.push({ tipo: 'num', v: Number(n) })
      continue
    }
    if (/[a-zA-Z]/.test(c)) {
      let nome = ''
      while (i < s.length && /[a-zA-Z]/.test(s[i])) nome += s[i++]
      t.push({ tipo: 'nome', v: nome.toLowerCase() })
      continue
    }
    if (s.startsWith('**', i)) { t.push({ tipo: 'op', v: '**' }); i += 2; continue }
    if ('+-*/%()'.includes(c)) { t.push({ tipo: c === '(' || c === ')' ? c : 'op', v: c }); i++; continue }
    throw new Error(`não entendi "${c}"`)
  }
  return t
}

/** Descida recursiva: soma → produto → potência → unário → átomo */
function analisar(tokens) {
  let p = 0
  const olhar = () => tokens[p]
  const consumir = () => tokens[p++]

  function soma() {
    let v = produto()
    while (olhar()?.tipo === 'op' && ['+', '-'].includes(olhar().v)) {
      const op = consumir().v
      const d = produto()
      v = op === '+' ? v + d : v - d
    }
    return v
  }

  function produto() {
    let v = potencia()
    while (olhar()?.tipo === 'op' && ['*', '/', '%'].includes(olhar().v)) {
      const op = consumir().v
      const d = potencia()
      if ((op === '/' || op === '%') && d === 0) throw new Error('divisão por zero')
      v = op === '*' ? v * d : op === '/' ? v / d : v % d
    }
    return v
  }

  function potencia() {
    const base = unario()
    if (olhar()?.tipo === 'op' && olhar().v === '**') {
      consumir()
      return base ** potencia() // potência associa à direita
    }
    return base
  }

  function unario() {
    if (olhar()?.tipo === 'op' && ['-', '+'].includes(olhar().v)) {
      const op = consumir().v
      const v = unario()
      return op === '-' ? -v : v
    }
    return atomo()
  }

  function atomo() {
    const t = consumir()
    if (!t) throw new Error('a expressão terminou no meio')
    if (t.tipo === 'num') return t.v
    if (t.tipo === '(') {
      const v = soma()
      if (consumir()?.tipo !== ')') throw new Error('faltou fechar um parêntese')
      return v
    }
    if (t.tipo === 'nome') {
      if (t.v in CONSTANTES) return CONSTANTES[t.v]
      const fn = FUNCOES[t.v]
      if (!fn) throw new Error(`não conheço "${t.v}"`)
      if (olhar()?.tipo !== '(') throw new Error(`use ${t.v}(...)`)
      consumir()
      const arg = soma()
      if (consumir()?.tipo !== ')') throw new Error('faltou fechar um parêntese')
      return fn(arg)
    }
    throw new Error(`não esperava "${t.v}"`)
  }

  const resultado = soma()
  if (p < tokens.length) throw new Error(`sobrou "${tokens[p].v}" no fim`)
  return resultado
}

const formatar = (n) =>
  Number.isInteger(n) ? n.toLocaleString('pt-BR') : n.toLocaleString('pt-BR', { maximumFractionDigits: 6 })

export default {
  name: 'calc',
  aliases: ['calcular', 'conta-de', 'matematica'],
  resumo: 'faz a conta pra você',
  description: 'Faz a conta: /calc 1500*0,13 (aceita %, parênteses, raiz(), potência ^)',
  categoria: 'utilidades',

  async run({ sock, msg, chatId, text }) {
    const expressao = text.replace(/^[/!.]\S+\s*/, '').trim()
    if (!expressao) {
      throw new Error(
        'O que eu calculo?\n\n' +
        '▸ `/calc 1500*0,13`\n' +
        '▸ `/calc (250+90)/3`\n' +
        '▸ `/calc 2^10`\n' +
        '▸ `/calc raiz(144)`\n\n' +
        '_Também entende % , pi e e._',
      )
    }
    if (expressao.length > 200) throw new Error('Essa conta é grande demais. 😅')

    let resultado
    try {
      resultado = analisar(tokenizar(expressao))
    } catch (err) {
      throw new Error(`Não consegui calcular: _${err.message}_.\n\nExemplo: */calc (250+90)/3*`)
    }

    if (!Number.isFinite(resultado)) throw new Error('O resultado não é um número válido (deu infinito ou indefinido).')

    await sock.sendMessage(chatId, {
      text: `🧮 \`${expressao}\`\n\n= *${formatar(resultado)}*`,
    }, { quoted: msg })
  },
}
