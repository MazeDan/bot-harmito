export const config = {
  // Prefixos aceitos para comandos: /fig, !fig, .fig
  prefixes: ['/', '!', '.'],

  // Metadados que aparecem na figurinha (nome do pack e autor)
  sticker: {
    packname: 'Calciffer Fig',
    author: 'Calciffer',
    // Duração máxima de vídeo/gif convertido (segundos)
    maxVideoSeconds: 8,
    // Tamanho máximo do arquivo final (WhatsApp rejeita stickers animados grandes)
    maxBytes: 1_000_000,
  },

  // Limite de uso por usuário: N comandos por janela de tempo
  rateLimit: {
    max: 5,
    windowMs: 60_000,
  },

  // Quantas conversões de mídia rodam ao mesmo tempo
  concurrency: 2,

  // Painel web de controle financeiro
  web: {
    ativo: process.env.PAINEL_ATIVO !== '0',
    port: Number(process.env.PAINEL_PORT || 3333),
    // Token de acesso. Se vazio, um token aleatório é gerado a cada boot e
    // impresso no console. Defina PAINEL_TOKEN para ter um link fixo.
    token: process.env.PAINEL_TOKEN || '',
    // 127.0.0.1 = só a sua máquina. Use 0.0.0.0 por sua conta e risco.
    host: process.env.PAINEL_HOST || '127.0.0.1',
  },

  // Cobrança automática por WhatsApp
  cobranca: {
    ativo: process.env.COBRANCA_ATIVA !== '0',
    // ⚠️ dryRun = true apenas SIMULA os envios (mostra no console e no painel).
    // Só desligue quando tiver conferido as mensagens — disparo em massa para
    // números que nunca te escreveram é o jeito mais rápido de tomar ban.
    dryRun: process.env.COBRANCA_REAL !== '1',
    horario: process.env.COBRANCA_HORARIO || '09:00',
    // Teto de mensagens por rodada e intervalo aleatório entre envios (ms)
    maxPorRodada: Number(process.env.COBRANCA_MAX || 20),
    intervaloMs: [8_000, 20_000],
  },
}
