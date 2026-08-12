/** Códigos WMO → texto e emoji */
const TEMPO = {
  0: ['☀️', 'céu limpo'], 1: ['🌤️', 'quase limpo'], 2: ['⛅', 'parcialmente nublado'], 3: ['☁️', 'nublado'],
  45: ['🌫️', 'neblina'], 48: ['🌫️', 'neblina com geada'],
  51: ['🌦️', 'garoa fraca'], 53: ['🌦️', 'garoa'], 55: ['🌧️', 'garoa forte'],
  61: ['🌦️', 'chuva fraca'], 63: ['🌧️', 'chuva'], 65: ['🌧️', 'chuva forte'],
  66: ['🌧️', 'chuva congelante'], 67: ['🌧️', 'chuva congelante forte'],
  71: ['🌨️', 'neve fraca'], 73: ['🌨️', 'neve'], 75: ['❄️', 'neve forte'],
  80: ['🌦️', 'pancadas fracas'], 81: ['🌧️', 'pancadas de chuva'], 82: ['⛈️', 'pancadas fortes'],
  95: ['⛈️', 'trovoada'], 96: ['⛈️', 'trovoada com granizo'], 99: ['⛈️', 'trovoada forte com granizo'],
}

const buscar = async (url) => {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 12000)
  const res = await fetch(url, { signal: ctrl.signal })
  clearTimeout(t)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export default {
  name: 'clima',
  aliases: ['tempo', 'previsao', 'previsão'],
  resumo: 'previsão do tempo',
  description: 'Previsão do tempo: /clima Salvador',
  categoria: 'utilidades',

  async run({ sock, msg, chatId, text }) {
    const cidade = text.replace(/^[/!.]\S+\s*/, '').trim() || 'Salvador'

    let local, previsao
    try {
      const geo = await buscar(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=1&language=pt`)
      local = geo?.results?.[0]
      if (!local) throw new Error('cidade não encontrada')

      previsao = await buscar(
        `https://api.open-meteo.com/v1/forecast?latitude=${local.latitude}&longitude=${local.longitude}` +
        '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m' +
        '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code' +
        `&timezone=auto&forecast_days=3`,
      )
    } catch (err) {
      if (err.message === 'cidade não encontrada') {
        throw new Error(`Não achei *${cidade}*. Tente escrever o nome completo, tipo */clima Feira de Santana*.`)
      }
      throw new Error('Não consegui buscar a previsão agora. Tente daqui a pouco.')
    }

    const a = previsao.current
    const [icone, descricao] = TEMPO[a.weather_code] ?? ['🌡️', 'tempo indefinido']
    const onde = [local.name, local.admin1, local.country].filter(Boolean).join(', ')

    const dias = ['hoje', 'amanhã', 'depois de amanhã']
    const proximos = previsao.daily.time.map((_, i) => {
      const [ic] = TEMPO[previsao.daily.weather_code[i]] ?? ['🌡️']
      const chuva = previsao.daily.precipitation_probability_max[i]
      return `${ic} *${dias[i] ?? ''}* — ${Math.round(previsao.daily.temperature_2m_min[i])}° a ${Math.round(previsao.daily.temperature_2m_max[i])}°` +
        (chuva != null ? ` · 💧 ${chuva}%` : '')
    })

    await sock.sendMessage(chatId, {
      text:
        `${icone} *${onde}*\n\n` +
        `🌡️ *${Math.round(a.temperature_2m)}°C* _(sensação ${Math.round(a.apparent_temperature)}°)_\n` +
        `${icone} ${descricao}\n` +
        `💧 Umidade ${a.relative_humidity_2m}% · 💨 Vento ${Math.round(a.wind_speed_10m)} km/h\n\n` +
        `📅 *Próximos dias*\n${proximos.join('\n')}`,
    }, { quoted: msg })
  },
}
