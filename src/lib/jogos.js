/** Conteúdo dos jogos de grupo — tudo offline. */

/** Palavras da forca, por tema. Só letras A-Z, sem acento nem espaço. */
export const PALAVRAS = [
  ['ABACAXI', 'fruta'], ['MELANCIA', 'fruta'], ['MARACUJA', 'fruta'], ['JABUTICABA', 'fruta'],
  ['FEIJOADA', 'comida'], ['ACARAJE', 'comida baiana'], ['MOQUECA', 'comida baiana'], ['VATAPA', 'comida baiana'],
  ['BRIGADEIRO', 'doce'], ['COXINHA', 'salgado'], ['TAPIOCA', 'comida'],
  ['SALVADOR', 'cidade'], ['PELOURINHO', 'lugar de Salvador'], ['ITAPUA', 'bairro de Salvador'],
  ['PARALELA', 'avenida de Salvador'], ['FAROLDABARRA', 'cartão-postal de Salvador'],
  ['CARNAVAL', 'festa'], ['TRIOELETRICO', 'carnaval'], ['AXE', 'música'], ['SAMBA', 'música'],
  ['CAPOEIRA', 'cultura'], ['BERIMBAU', 'instrumento'], ['PANDEIRO', 'instrumento'],
  ['GELADEIRA', 'objeto de casa'], ['TRAVESSEIRO', 'objeto de casa'], ['CHUVEIRO', 'objeto de casa'],
  ['COMPUTADOR', 'tecnologia'], ['TECLADO', 'tecnologia'], ['CELULAR', 'tecnologia'],
  ['FUTEBOL', 'esporte'], ['VOLEIBOL', 'esporte'], ['NATACAO', 'esporte'],
  ['GIRASSOL', 'planta'], ['ELEFANTE', 'animal'], ['TARTARUGA', 'animal'], ['GOLFINHO', 'animal'],
  ['ARQUITETO', 'profissão'], ['DENTISTA', 'profissão'], ['ADVOGADO', 'profissão'],
  ['SAUDADE', 'sentimento'], ['ESPERANCA', 'sentimento'], ['PACIENCIA', 'virtude'],
  ['DOMINGO', 'dia da semana'], ['FEVEREIRO', 'mês'], ['TERMOMETRO', 'objeto'],
  ['BICICLETA', 'transporte'], ['HELICOPTERO', 'transporte'], ['SUBMARINO', 'transporte'],
]

/** Adivinhe pelo emoji: [emojis, resposta, dica] */
export const EMOJIS = [
  ['🦁👑', 'REI LEAO', 'filme'],
  ['🕷️👨', 'HOMEM ARANHA', 'filme'],
  ['🚢🧊💔', 'TITANIC', 'filme'],
  ['🤖🚀⭐', 'STAR WARS', 'filme'],
  ['🧙‍♂️💍🌋', 'SENHOR DOS ANEIS', 'filme'],
  ['🐠🔍', 'PROCURANDO NEMO', 'filme'],
  ['👻🚫', 'CACA FANTASMAS', 'filme'],
  ['🦖🏝️', 'JURASSIC PARK', 'filme'],
  ['❄️👸⛄', 'FROZEN', 'filme'],
  ['🍫🏭🎩', 'FANTASTICA FABRICA DE CHOCOLATE', 'filme'],
  ['🥋🐢🍕', 'TARTARUGAS NINJA', 'desenho'],
  ['🧽🍍🌊', 'BOB ESPONJA', 'desenho'],
  ['👨‍👩‍👦💛🍩', 'OS SIMPSONS', 'desenho'],
  ['⚡🧙🤓', 'HARRY POTTER', 'filme'],
  ['🦇🌃', 'BATMAN', 'herói'],
  ['🕶️💊🟢', 'MATRIX', 'filme'],
  ['🐝🍯', 'ABELHA', 'animal'],
  ['🌽🍿', 'PIPOCA', 'comida'],
  ['🎂🕯️🎈', 'ANIVERSARIO', 'data'],
  ['☕🥐', 'CAFE DA MANHA', 'refeição'],
]

/** "Eu nunca..." */
export const EU_NUNCA = [
  'fingi que estava sem sinal pra não responder alguém.',
  'comi algo que caiu no chão.',
  'menti a idade pra levar vantagem.',
  'dormi numa reunião ou aula online.',
  'stalkeei o ex de alguém.',
  'cantei no chuveiro achando que estava ótimo.',
  'inventei uma desculpa pra sair mais cedo do trabalho.',
  'mandei mensagem e me arrependi na hora.',
  'chorei assistindo desenho.',
  'fingi que conhecia uma música pra não passar vergonha.',
  'esqueci o aniversário de alguém muito próximo.',
  'comi o lanche de outra pessoa achando que era meu.',
  'passei o dia inteiro de pijama.',
  'dei "visto" e esqueci de responder por dias.',
  'fingi rir de uma piada que não entendi.',
  'saí de casa e voltei pra ver se tranquei a porta.',
  'usei o mesmo copo a semana inteira.',
  'falei mal do trânsito e depois fiz a mesma coisa.',
]

/** Veredictos do detector de mentiras */
export const DETECTOR = [
  ['VERDADE', '✅', 'Pode confiar. Dessa vez.'],
  ['VERDADE', '✅', 'Os sensores nem piscaram.'],
  ['MENTIRA', '❌', 'A agulha saiu do papel.'],
  ['MENTIRA', '❌', 'Nem você acreditou nisso.'],
  ['DUVIDOSO', '🤨', 'Tem alguma coisa aí, mas não sei o quê.'],
  ['MEIA VERDADE', '😐', 'Contou metade e escondeu a outra.'],
  ['MENTIRA DESCARADA', '🚨', 'Isso foi tão falso que quebrei o aparelho.'],
]

/** Frases do /roleta — o "sobreviveu" e o "explodiu" */
export const ROLETA = {
  salvo: [
    'clique. Câmara vazia. 😮‍💨',
    'clique. Passou raspando.',
    'clique. Sorte é uma habilidade, dizem.',
    'clique. Hoje não.',
  ],
  perdeu: [
    'BANG! 💥 Foi bom te conhecer.',
    'BANG! 💥 Alguém avisa a família.',
    'BANG! 💥 Era a sua vez mesmo.',
    'BANG! 💥 A estatística cobrou.',
  ],
}

export const sortear1 = (lista) => lista[Math.floor(Math.random() * lista.length)]

/** Embaralha as letras de uma palavra, garantindo que fique diferente */
export function embaralhar(palavra) {
  const letras = [...palavra]
  for (let tentativa = 0; tentativa < 20; tentativa++) {
    for (let i = letras.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[letras[i], letras[j]] = [letras[j], letras[i]]
    }
    const embaralhada = letras.join('')
    if (embaralhada !== palavra) return embaralhada
  }
  return letras.reverse().join('')
}

/** Tira acentos e deixa maiúsculo, para comparar respostas */
export const normalizar = (s) =>
  String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim()
