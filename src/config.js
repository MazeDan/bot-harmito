export const config = {
  // Prefixos aceitos para comandos: /fig, !fig, .fig
  prefixes: ['/', '!', '.'],

  // Metadados que aparecem na figurinha (nome do pack e autor)
  sticker: {
    packname: 'Harmito Figs',
    author: 'Harmito',
    // Duração máxima de vídeo/gif convertido (segundos)
    maxVideoSeconds: 8,
    // Tamanho máximo do arquivo final (WhatsApp rejeita stickers animados grandes)
    maxBytes: 1_000_000,
    // Manda duas figurinhas: a inteira (proporção original) e a quadrada.
    // Se a mídia já for quadrada, sai só uma — seriam idênticas.
    duasVersoes: process.env.FIG_DUAS !== '0',
  },

  // Limite de uso por usuário: N comandos por janela de tempo
  rateLimit: {
    max: 5,
    windowMs: 60_000,
  },

  // Quantas conversões de mídia rodam ao mesmo tempo
  concurrency: 2,

  // Quem pode usar os comandos de financeiro e agenda
  dono: {
    // Token exigido em "/dono trocar" — sem ele, qualquer um que mandasse
    // mensagem privada pro bot poderia assumir e ver seus dados.
    token: process.env.DONO_TOKEN || '',
  },

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

  // Liturgia diária católica
  liturgia: {
    ativo: process.env.LITURGIA_ATIVA !== '0',
    // Envio das leituras nos grupos escolhidos
    horario: process.env.LITURGIA_HORARIO || '06:00',
    // Cobranças do /ld, na ordem. Só disparam se você ainda não anotou.
    lembretes: (process.env.LITURGIA_LEMBRETES || '12:00,18:00,21:00').split(',').map((h) => h.trim()),
    // true = tudo numa mensagem só; false = uma por leitura (lê melhor)
    mensagemUnica: process.env.LITURGIA_UNICA === '1',
    api: process.env.LITURGIA_API || 'https://liturgia.up.railway.app/v2/',
  },

  // Agenda: lembretes, tarefas e o resumo da manhã
  agenda: {
    ativo: process.env.AGENDA_ATIVA !== '0',
    // Bom-dia com o que tem no dia. Na segunda vai a semana junto; na sexta,
    // o fim de semana. Vai para o chat marcado com /relatorios.
    horarioResumo: process.env.AGENDA_HORARIO || '07:00',
  },

  // Produção de conteúdo: clientes, artes/vídeos e planejamento semanal
  producao: {
    ativo: process.env.PRODUCAO_ATIVA !== '0',
    // Extensões aceitas no upload pelo painel
    extensoes: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.mov', '.pdf'],
    // Tamanho máximo por arquivo e por lote de upload
    maxArquivoBytes: 200 * 1024 * 1024,
    maxLoteBytes: 400 * 1024 * 1024,
    // Horários padrão dos lembretes (o dono ajusta pelo painel depois)
    padroes: {
      planejamentoSabado: true, planejamentoSabadoHora: '18:00',
      planejamentoDomingo: true, planejamentoDomingoHora: '18:00',
      segundaNaoPlanejado: true, segundaNaoPlanejadoHora: '08:00',
      publicacaoAntecedenciaMin: 30,
      tarefaManha: true, tarefaManhaHora: '08:00',
      tarefaAntesPrazoHoras: 2,
      resumoDiario: true, resumoDiarioHora: '08:00',
      resumoNoturno: false, resumoNoturnoHora: '20:00',
    },
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
