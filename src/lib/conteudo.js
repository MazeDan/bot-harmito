/** Conteúdo fixo dos comandos de diversão — tudo offline, sem API. */

export const VERDADES = [
  'Qual foi a maior mentira que você já contou no grupo?',
  'Qual app você esconderia se alguém pegasse seu celular?',
  'Quanto tempo faz que você não lava aquela garrafa de água?',
  'Qual foi a coisa mais cara que você comprou e se arrependeu?',
  'Você já stalkeou alguém do grupo hoje?',
  'Qual música você escuta escondido?',
  'Quem do grupo você chamaria pra fugir do país?',
  'Qual foi a última vez que você chorou e por quê?',
  'Você já fingiu que a mensagem não tinha chegado? Pra quem?',
  'Qual é o seu maior mico dos últimos 12 meses?',
  'Quantas fotos da mesma pose tem na sua galeria?',
  'Qual comida você odeia mas finge que gosta pra não ofender?',
  'Já mandou mensagem pra pessoa errada? Conta.',
  'Qual série você disse que assistiu, mas não assistiu?',
  'Se pudesse apagar uma mensagem sua da vida, qual seria?',
]

export const DESAFIOS = [
  'Mande um áudio cantando o refrão da última música que você ouviu.',
  'Poste o print da sua última compra no cartão.',
  'Troque sua foto de perfil por um meme por 1 hora.',
  'Mande um áudio imitando alguém do grupo.',
  'Conte até 30 em outro idioma, por áudio.',
  'Mande a última foto da sua galeria (sem escolher).',
  'Escreva só em MAIÚSCULAS pelas próximas 10 mensagens.',
  'Mande um áudio de 10 segundos gargalhando.',
  'Ligue pra primeira pessoa da sua lista e diga "saudade".',
  'Poste o seu histórico de busca de hoje.',
  'Mande uma selfie sem filtro, agora.',
  'Escreva um poema de 4 linhas sobre a pessoa acima de você.',
  'Mande um áudio lendo a última mensagem do grupo com voz de narrador.',
  'Conte uma piada tão ruim que dê vergonha.',
  'Fale por 30 segundos sobre um assunto que você não domina, com confiança.',
]

export const QUIZ = [
  { p: 'Qual é o maior planeta do Sistema Solar?', o: ['Terra', 'Júpiter', 'Saturno', 'Netuno'], r: 1 },
  { p: 'Em que ano o Brasil foi pentacampeão mundial de futebol?', o: ['1994', '1998', '2002', '2006'], r: 2 },
  { p: 'Qual é a capital da Austrália?', o: ['Sydney', 'Melbourne', 'Camberra', 'Perth'], r: 2 },
  { p: 'Quantos ossos tem o corpo humano adulto?', o: ['186', '206', '226', '246'], r: 1 },
  { p: 'Qual é o rio mais extenso do mundo?', o: ['Nilo', 'Amazonas', 'Mississipi', 'Yangtzé'], r: 1 },
  { p: 'Quem pintou "A Noite Estrelada"?', o: ['Monet', 'Picasso', 'Van Gogh', 'Dalí'], r: 2 },
  { p: 'Qual é o menor país do mundo?', o: ['Mônaco', 'Vaticano', 'Nauru', 'San Marino'], r: 1 },
  { p: 'Qual estado brasileiro tem o maior litoral?', o: ['Bahia', 'Ceará', 'Maranhão', 'Rio de Janeiro'], r: 0 },
  { p: 'Qual elemento químico tem o símbolo "Fe"?', o: ['Flúor', 'Ferro', 'Fósforo', 'Frâncio'], r: 1 },
  { p: 'Em que ano caiu o Muro de Berlim?', o: ['1987', '1989', '1991', '1993'], r: 1 },
  { p: 'Qual é o oceano mais profundo?', o: ['Atlântico', 'Índico', 'Pacífico', 'Ártico'], r: 2 },
  { p: 'Quem escreveu "Dom Casmurro"?', o: ['José de Alencar', 'Machado de Assis', 'Eça de Queirós', 'Graciliano Ramos'], r: 1 },
  { p: 'Quantos minutos tem um jogo oficial de futebol (sem acréscimos)?', o: ['80', '90', '100', '120'], r: 1 },
  { p: 'Qual é a moeda oficial do Japão?', o: ['Won', 'Yuan', 'Iene', 'Dong'], r: 2 },
  { p: 'Qual é o maior deserto do mundo?', o: ['Saara', 'Gobi', 'Antártico', 'Atacama'], r: 2 },
]

/** Categorias do /ranking — o texto é o título do pódio */
export const RANKINGS = [
  'mais provável de dormir no grupo',
  'que mais usa figurinha',
  'que some e volta do nada',
  'mais provável de ficar rico primeiro',
  'que mais atrasa',
  'que responde "kkk" e não fala mais nada',
  'mais provável de virar influencer',
  'que mais fala e menos aparece',
  'que seria preso primeiro',
  'mais confiável do grupo',
  'que mais pede dinheiro emprestado',
  'que mais manda áudio de 5 minutos',
]

/** Frases do /vs, com {a} e {b} */
export const DUELOS = [
  '{a} chegou com tudo, mas {b} nem se abalou.',
  '{b} ganhou no grito. {a} ficou só olhando.',
  'Empate técnico… mas {a} levou no saldo de gols.',
  '{a} tropeçou no próprio pé. Vitória de {b}.',
  '{b} venceu, mas ninguém aplaudiu.',
  '{a} venceu por W.O. — {b} nem apareceu.',
  'Foi feio dos dois lados, mas {a} foi menos pior.',
]

export const sortear1 = (lista) => lista[Math.floor(Math.random() * lista.length)]
