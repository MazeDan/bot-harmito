/**
 * Parser de linhas de lançamento, usado tanto pelos comandos do WhatsApp
 * quanto pelo painel web.
 *
 * Gramática (ordem livre):
 *   <valor>          22 | 35,90 | 1.250,00 | R$ 22
 *   <pessoa>         primeira palavra que sobrar
 *   #cartao          #nubank  (ou o cartão padrão do lote)
 *   Nx               3x       (parcelamento — valor informado é o TOTAL)
 *   dd/mm[/aaaa]     data da compra (padrão: hoje)
 *   resto            observação
 *
 * Exemplos:
 *   22 danilo lanche
 *   danilo 35,90 uber #inter
 *   300 joao 3x tênis 12/07
 */

const RE_VALOR = /^r?\$?\s*-?(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/i
const RE_PARCELA = /^(\d{1,2})x$/i
const RE_DATA = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/

const toNumber = (t) => Number(String(t).replace(/[r$\s]/gi, '').replace(/\./g, '').replace(',', '.'))

export function parseLinha(linha, { cartaoPadrao = null, hoje = new Date() } = {}) {
  const texto = String(linha || '').trim()
  if (!texto) return null

  const tokens = texto.split(/\s+/)
  let valor = null
  let cartao = cartaoPadrao
  let parcelas = 1
  let data = null
  const resto = []

  for (const t of tokens) {
    if (valor === null && RE_VALOR.test(t)) { valor = toNumber(t); continue }
    if (t.startsWith('#') && t.length > 1) { cartao = t.slice(1); continue }
    const mp = t.match(RE_PARCELA)
    if (mp && Number(mp[1]) > 1) { parcelas = Number(mp[1]); continue }
    const md = t.match(RE_DATA)
    if (md && !data) {
      const ano = md[3] ? (md[3].length === 2 ? 2000 + Number(md[3]) : Number(md[3])) : hoje.getFullYear()
      data = new Date(ano, Number(md[2]) - 1, Number(md[1]))
      continue
    }
    resto.push(t)
  }

  if (valor === null || !valor) return { erro: 'sem valor', linha: texto }
  if (!resto.length) return { erro: 'sem nome da pessoa', linha: texto }

  const [pessoa, ...obs] = resto
  return {
    pessoa,
    value: valor,
    card: cartao || null,
    parcelas,
    note: obs.join(' '),
    at: (data || hoje).toISOString(),
    linha: texto,
  }
}

/**
 * Parseia um bloco de várias linhas.
 * A primeira linha pode ser só o nome do cartão padrão (ex.: "nubank" ou "#nubank").
 * Retorna { cartaoPadrao, ok: [...], erros: [...], total }
 */
export function parseLote(texto, { cartaoPadrao = null, hoje = new Date() } = {}) {
  const linhas = String(texto || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//'))

  let padrao = cartaoPadrao
  // primeira linha sem valor = nome do cartão padrão
  if (linhas.length && !/\d/.test(linhas[0]) && linhas[0].split(/\s+/).length === 1) {
    padrao = linhas.shift().replace(/^#/, '')
  }

  const ok = []
  const erros = []
  for (const l of linhas) {
    const r = parseLinha(l, { cartaoPadrao: padrao, hoje })
    if (!r) continue
    if (r.erro) erros.push(r)
    else ok.push(r)
  }

  return { cartaoPadrao: padrao, ok, erros, total: ok.reduce((s, r) => s + r.value, 0) }
}
