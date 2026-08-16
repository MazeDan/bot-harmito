import { randomBytes, timingSafeEqual } from 'node:crypto'
import { config } from '../config.js'

/**
 * Token pra trocar quem é o dono do bot. Sem isso, qualquer pessoa que
 * mandasse mensagem privada pro bot e digitasse "/dono trocar" viraria dona
 * e passaria a ver os dados financeiros e a agenda.
 *
 * Mesmo padrão do token do painel: fixo via env, ou aleatório por boot
 * (impresso no console, que só quem tem acesso ao servidor vê).
 */
let token = ''

export function iniciarDonoAuth() {
  token = config.dono.token || randomBytes(8).toString('hex')
  if (!config.dono.token) {
    console.log(`👑 Token para trocar o dono: ${token}`)
    console.log('   (defina DONO_TOKEN no ambiente para um token fixo)')
  }
}

export function tokenValido(dado) {
  const a = Buffer.from(String(dado || ''))
  const b = Buffer.from(token)
  return a.length === b.length && timingSafeEqual(a, b)
}

export const donoTokenAutomatico = () => (config.dono.token ? null : token)
