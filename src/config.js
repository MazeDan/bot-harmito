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
    // Senha de acesso ao painel. Se vazia, uma aleatória é gerada a cada boot
    // e impressa no log. Em servidor, defina PAINEL_TOKEN (senha longa!).
    token: process.env.PAINEL_TOKEN || '',
    // 127.0.0.1 = só a sua máquina. Em hospedagem (Square Cloud etc.) precisa
    // ser 0.0.0.0 para o proxy conseguir alcançar o processo.
    host: process.env.PAINEL_HOST || '127.0.0.1',
    // URL pública, quando atrás de proxy/HTTPS. Usada pelo comando /painel.
    urlPublica: process.env.PAINEL_URL || '',
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

  // Agenda: lembretes, tarefas e o resumo da manhã
  agenda: {
    ativo: process.env.AGENDA_ATIVA !== '0',
    // Bom-dia com o que tem no dia. Na segunda vai a semana junto; na sexta,
    // o fim de semana. Vai para o chat marcado com /relatorios.
    horarioResumo: process.env.AGENDA_HORARIO || '07:00',
  },

  // Backup dos dados financeiros
  backup: {
    ativo: process.env.BACKUP_ATIVO !== '0',
    // Cópia local todo dia; envio pelo WhatsApp a cada N dias
    intervaloDias: Number(process.env.BACKUP_DIAS || 15),
    // Quantas cópias locais guardar (data/backups/)
    manterDias: Number(process.env.BACKUP_MANTER || 30),
  },
}
