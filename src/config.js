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
}
