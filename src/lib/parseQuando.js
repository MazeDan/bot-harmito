/**
 * Interpreta "quando" em português dentro de uma frase solta e devolve o que
 * sobrou como sendo a descrição.
 *
 *   18:30 treinar                    → hoje 18:30
 *   amanhã 09:00 pagar faculdade     → amanhã 09:00
 *   sexta 14h dentista               → próxima sexta 14:00
 *   dia 12/09 20h show               → 12/09 20:00
 *   em 30min tirar o bolo            → hoje, agora+30
 *   todo dia 7h academia             → recorrente diária
 *   toda segunda 19h inglês          → recorrente semanal
 *   dias úteis 6h30 correr           → recorrente seg-sex
 *   todo mês dia 10 pagar aluguel    → recorrente mensal
 *   comprar presente                 → hoje, sem hora (tarefa)
 */

import { iso, somarDias } from './agenda.js'

const SEM_ACENTO = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// domingo = 0, para bater com Date.getDay()
const SEMANA = {
  domingo: 0, dom: 0,
  segunda: 1, seg: 1, 'segunda-feira': 1,
  terca: 2, ter: 2, 'terca-feira': 2,
  quarta: 3, qua: 3, 'quarta-feira': 3,
  quinta: 4, qui: 4, 'quinta-feira': 4,
  sexta: 5, sex: 5, 'sexta-feira': 5,
  sabado: 6, sab: 6,
}

/** Próxima ocorrência daquele dia da semana (hoje não conta, a não ser que peça) */
function proximoDiaDaSemana(alvo, base = new Date(), incluirHoje = false) {
  const hoje = base.getDay()
  let delta = (alvo - hoje + 7) % 7
  if (delta === 0 && !incluirHoje) delta = 7
  return somarDias(iso(base), delta)
}

/** "18:30" "18h" "18h30" "6h30" "meio-dia" → "HH:MM" */
function lerHora(token, tokenSeguinte) {
  const t = SEM_ACENTO(token)
  if (/^meio-?dia$/.test(t)) return { hora: '12:00', consumidos: 1 }
  if (/^meia-?noite$/.test(t)) return { hora: '00:00', consumidos: 1 }

  let m = t.match(/^(\d{1,2})[:h](\d{2})$/)          // 18:30 · 18h30
  if (m) return { hora: fmt(m[1], m[2]), consumidos: 1 }

  m = t.match(/^(\d{1,2})h$/)                         // 18h
  if (m) return { hora: fmt(m[1], '00'), consumidos: 1 }

  m = t.match(/^(\d{1,2})h(\d{1,2})$/)                // 6h5
  if (m) return { hora: fmt(m[1], m[2].padStart(2, '0')), consumidos: 1 }

  // "18 horas" / "18 hrs"
  if (/^\d{1,2}$/.test(t) && tokenSeguinte && /^(horas?|hrs?)$/.test(SEM_ACENTO(tokenSeguinte))) {
    return { hora: fmt(t, '00'), consumidos: 2 }
  }
  return null
}

function fmt(h, m) {
  const hh = Number(h)
  const mm = Number(m)
  if (hh > 23 || mm > 59) return null
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/** "12/09" ou "12/09/2026" */
function lerData(token, base) {
  const m = SEM_ACENTO(token).match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)
  if (!m) return null
  const dia = Number(m[1])
  const mes = Number(m[2])
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null
  let ano = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : base.getFullYear()
  let d = new Date(ano, mes - 1, dia)
  // sem ano informado e a data já passou → assume o ano que vem
  if (!m[3] && iso(d) < iso(base)) d = new Date(ano + 1, mes - 1, dia)
  return iso(d)
}

export function parseQuando(frase, { agora = new Date() } = {}) {
  const tokens = String(frase || '').trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return { erro: 'frase vazia' }

  let data = null
  let hora = null
  let recorrencia = null
  const resto = []

  for (let i = 0; i < tokens.length; i++) {
    const bruto = tokens[i]
    const t = SEM_ACENTO(bruto).replace(/[,;]$/, '')
    const prox = tokens[i + 1] ? SEM_ACENTO(tokens[i + 1]).replace(/[,;]$/, '') : ''
    const prox2 = tokens[i + 2] ? SEM_ACENTO(tokens[i + 2]).replace(/[,;]$/, '') : ''

    // ---- recorrência ----
    if (!recorrencia && /^(todo|todos|toda|todas)$/.test(t)) {
      // todo mês dia 10 · todo dia 10 → mensal
      const mensal = (prox === 'mes' && prox2 === 'dia') ? tokens[i + 3] : (prox === 'dia' && /^\d{1,2}$/.test(prox2) ? tokens[i + 2] : null)
      if (mensal && /^\d{1,2}$/.test(SEM_ACENTO(mensal))) {
        recorrencia = { tipo: 'mensal', dia: Number(SEM_ACENTO(mensal)) }
        i += (prox === 'mes' ? 3 : 2)
        continue
      }
      // todo dia · todos os dias · diariamente
      if (prox === 'dia' || prox === 'os' || prox === 'dias') {
        const salto = prox === 'os' ? 2 : 1
        if (prox !== 'dias' || prox2 !== 'uteis') {
          recorrencia = { tipo: 'diaria' }
          i += salto
          continue
        }
      }
      // toda segunda · todo sábado
      if (SEMANA[prox] !== undefined) {
        recorrencia = { tipo: 'semanal', dia: SEMANA[prox] }
        i += 1
        continue
      }
    }
    if (!recorrencia && /^(diariamente|diario)$/.test(t)) { recorrencia = { tipo: 'diaria' }; continue }
    if (!recorrencia && t === 'dias' && /^uteis$/.test(prox)) { recorrencia = { tipo: 'uteis' }; i += 1; continue }
    if (!recorrencia && /^(seg|segunda)$/.test(t) && prox === 'a' && /^(sex|sexta)$/.test(prox2)) {
      recorrencia = { tipo: 'uteis' }; i += 2; continue
    }

    // ---- "em 30min" / "em 2h" / "em 1h30" ----
    if (!hora && t === 'em' && prox) {
      const m = prox.match(/^(\d{1,3})(min|m|h)(\d{1,2})?$/)
      if (m) {
        const minutos = m[2] === 'h' ? Number(m[1]) * 60 + Number(m[3] || 0) : Number(m[1])
        const alvo = new Date(agora.getTime() + minutos * 60000)
        data = iso(alvo)
        hora = alvo.toTimeString().slice(0, 5)
        i += 1
        continue
      }
      // "em 30 minutos"
      if (/^\d{1,3}$/.test(prox) && /^(min|mins|minutos?|h|horas?)$/.test(prox2)) {
        const minutos = /^h|hora/.test(prox2) ? Number(prox) * 60 : Number(prox)
        const alvo = new Date(agora.getTime() + minutos * 60000)
        data = iso(alvo)
        hora = alvo.toTimeString().slice(0, 5)
        i += 2
        continue
      }
    }

    // ---- data relativa ----
    if (!data && !recorrencia) {
      if (t === 'hoje') { data = iso(agora); continue }
      if (t === 'amanha') { data = somarDias(iso(agora), 1); continue }
      if (t === 'depois' && prox === 'de' && prox2 === 'amanha') { data = somarDias(iso(agora), 2); i += 2; continue }
      if (t === 'hj') { data = iso(agora); continue }

      // "sexta" · "na sexta" · "próxima sexta"
      if (SEMANA[t] !== undefined) { data = proximoDiaDaSemana(SEMANA[t], agora); continue }
      if ((t === 'na' || t === 'no' || t === 'proxima' || t === 'proximo') && SEMANA[prox] !== undefined) {
        data = proximoDiaDaSemana(SEMANA[prox], agora); i += 1; continue
      }

      // "dia 12/09" · "12/09"
      if (t === 'dia' && tokens[i + 1]) {
        const d = lerData(tokens[i + 1], agora)
        if (d) { data = d; i += 1; continue }
      }
      const d = lerData(bruto, agora)
      if (d) { data = d; continue }
    }

    // ---- hora ----
    if (!hora) {
      const h = lerHora(bruto, tokens[i + 1])
      if (h?.hora) { hora = h.hora; i += h.consumidos - 1; continue }
    }

    // preposições soltas que sobraram antes de uma data/hora já lida
    if ((t === 'as' || t === 'a' || t === 'ao') && !resto.length) continue

    resto.push(bruto)
  }

  const texto = resto.join(' ').replace(/^(de|da|do|para|pra|a|as)\s+/i, '').trim()
  if (!texto) return { erro: 'sem descrição', data, hora, recorrencia }

  return {
    texto,
    data: recorrencia ? null : (data ?? iso(agora)),
    hora,
    recorrencia,
    // avisa quem chamou que a data veio do padrão, não do usuário
    dataImplicita: !recorrencia && !data,
  }
}

/** "toda segunda às 19:00" — descrição legível de uma recorrência */
export function descreverRecorrencia(r) {
  if (!r) return ''
  const nomes = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
  if (r.tipo === 'diaria') return 'todo dia'
  if (r.tipo === 'uteis') return 'de segunda a sexta'
  if (r.tipo === 'semanal') return `toda ${nomes[Number(r.dia)]}`
  if (r.tipo === 'mensal') return `todo dia ${r.dia} do mês`
  return ''
}
