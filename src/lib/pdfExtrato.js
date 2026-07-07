// Importa direto o lib para evitar o "debug mode" do pdf-parse em ESM
import pdfParse from 'pdf-parse/lib/pdf-parse.js'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** "1.234,56" | "-45,90" | "45,90-" → número (negativo = saída) */
function parseValor(token) {
  const t = token.trim()
  const neg = t.startsWith('-') || t.endsWith('-') || /\bD\b\s*$/.test(t)
  const num = Number(t.replace(/[^\d,]/g, '').replace('.', '').replace(',', '.'))
  if (!Number.isFinite(num) || num === 0) return null
  return neg ? -Math.abs(num) : Math.abs(num)
}

const DEBITO_KW = /(compra|pagamento|pagto|pag\.|débito|debito|saída|saida|transfer[eê]ncia enviada|pix enviado|enviado|tarifa|saque|boleto|d[eé]bito autom)/i
const CREDITO_KW = /(recebido|crédito|credito|dep[oó]sito|entrada|pix recebido|transfer[eê]ncia recebida|estorno|rendimento|salário|salario)/i

/**
 * Lê um extrato bancário em PDF (Buffer) e estima as SAÍDAS do mês.
 * Genérico — funciona melhor depois de ajustado ao layout do banco real.
 * Retorna { ok, month, saidas, entradas, count, amostra[] , texto }.
 */
export async function parseExtrato(buffer) {
  let text = ''
  try {
    const data = await pdfParse(buffer)
    text = data.text || ''
  } catch (err) {
    return { ok: false, error: 'Não consegui ler o PDF: ' + err.message }
  }
  if (!text.trim()) return { ok: false, error: 'O PDF parece estar vazio ou é uma imagem escaneada (sem texto).' }
  return parseExtratoText(text)
}

/** Lógica de extração a partir do TEXTO já extraído do PDF (testável). */
export function parseExtratoText(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)

  const monthCount = {}
  const bumpMonth = (mm, yyyy) => {
    const kmes = `${yyyy}-${String(mm).padStart(2, '0')}`
    monthCount[kmes] = (monthCount[kmes] || 0) + 1
  }

  let saidas = 0
  let entradas = 0
  let count = 0
  const amostra = []
  const anoAtual = new Date().getFullYear()

  const valorRe = /-?\s?R?\$?\s?\d{1,3}(?:\.\d{3})*,\d{2}\s?-?/g

  for (const line of lines) {
    // datas dd/mm[/yyyy] para descobrir o mês
    const d = line.match(/\b(\d{2})\/(\d{2})(?:\/(\d{2,4}))?\b/)
    if (d) {
      const mm = parseInt(d[2], 10)
      let yyyy = d[3] ? parseInt(d[3].length === 2 ? '20' + d[3] : d[3], 10) : anoAtual
      if (mm >= 1 && mm <= 12) bumpMonth(mm, yyyy)
    }

    const tokens = line.match(valorRe)
    if (!tokens) continue
    // pega o último valor da linha (normalmente é o valor da transação)
    const raw = tokens[tokens.length - 1]
    const v = parseValor(raw)
    if (v === null) continue

    // sinal: primeiro pelo próprio token, senão por palavra-chave da linha
    let saida = v < 0
    if (v > 0) {
      if (DEBITO_KW.test(line)) saida = true
      else if (CREDITO_KW.test(line)) saida = false
      else saida = null // indefinido
    }

    if (saida === true) { saidas += Math.abs(v); count++; if (amostra.length < 8) amostra.push({ line: line.slice(0, 60), v: -Math.abs(v) }) }
    else if (saida === false) { entradas += Math.abs(v) }
  }

  // mês predominante
  let month = Object.entries(monthCount).sort((a, b) => b[1] - a[1])[0]?.[0]
  if (!month) {
    // tenta achar "julho de 2026" no texto
    const nome = MESES.findIndex((m) => new RegExp(m, 'i').test(text))
    if (nome >= 0) month = `${anoAtual}-${String(nome + 1).padStart(2, '0')}`
  }

  return {
    ok: true,
    month: month || 'desconhecido',
    saidas: Math.round(saidas * 100) / 100,
    entradas: Math.round(entradas * 100) / 100,
    count,
    amostra,
  }
}
