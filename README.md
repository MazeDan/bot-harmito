# Bot de Figurinhas 🤖

Bot de WhatsApp que cria figurinhas estáticas e animadas, com sistema de comandos em plugins (fácil de adicionar jogos e novos comandos).

## Como rodar

```
npm start
```

Na primeira vez, vai aparecer um **QR code no terminal** — escaneie com o WhatsApp em *Configurações → Aparelhos conectados → Conectar aparelho*. A sessão fica salva na pasta `auth/` (não precisa escanear de novo).

> ⚠️ Use um número dedicado para o bot. Baileys é uma biblioteca não oficial e há um pequeno risco de banimento do número.

## Comandos

`/menu` lista o que está disponível **naquele chat**, agrupado por seção. `/menu diversão` detalha uma seção.

Prefixos aceitos: `/`, `!` e `.`

### 🎲 Diversão

| Comando | O que faz |
|---|---|
| `/dado` · `/moeda` · `/ppt pedra` | Dado (`/dado 20`), cara ou coroa, pedra-papel-tesoura |
| `/verdade` · `/desafio` | Verdade ou desafio (marque alguém para direcionar) |
| `/feio` · `/gado` · `/ship` · `/sorte` · `/escolher` | Os medidores de sempre |

### 🕹️ Jogos

| Comando | O que faz |
|---|---|
| `/forca` | Jogo da forca com boneco desenhado. `/forca a` chuta letra, `/forca abacaxi` arrisca a palavra. 6 vidas, 48 palavras com dica |
| `/emoji` | Adivinhe o que os emojis querem dizer. `/emoji rei leão` responde, `/emoji desisto` entrega |
| `/palavra` | Desembaralhe o anagrama, com dica e número de letras |
| `/adivinha` | Penso num número e você tenta — eu digo se é maior, menor, e quando está quente |
| `/quiz` | Pergunta de conhecimentos gerais; responda com `/quiz b` |
| `/casal` | Sorteia o casal do dia no grupo, com nota de compatibilidade (o mesmo até amanhã) |
| `/roleta` | Roleta russa de brincadeira: a chance sobe a cada clique até alguém "levar" |
| `/eununca` | Sorteia um "eu nunca" para o grupo reagir |
| `/detector` | Detector de mentiras — responda a uma mensagem ou escreva a afirmação |

### 👥 Grupo

| Comando | O que faz |
|---|---|
| `/enquete Vamos sair? \| sim \| não` | Cria uma **enquete nativa** do WhatsApp |
| `/sorteio [n]` | Sorteia n pessoas do grupo — ou `/sorteio pizza, sushi` sorteia entre opções |
| `/quem vai pagar a conta?` | Sorteia alguém para a pergunta |
| `/ranking [tema]` | Pódio do dia (a pontuação é fixa no dia, muda só amanhã) |
| `/vs @a @b` | Duelo narrado — sem marcar ninguém, sorteia dois |
| `/todos [recado]` | Marca todo mundo — **só admin** |
| `/admins` · `/infogrupo` | Lista os admins · dados do grupo e o que está liberado nele |
| `/link` | Link de convite — só admin, e o bot precisa ser admin |
| `/regras` · `/regras set ...` | Mostra as regras · define (só admin) |
| `/boasvindas on\|off` | Saúda quem entra, com as regras junto — só admin |

### 🖼️ Figurinhas e mídia

| Comando | O que faz |
|---|---|
| `/f` (ou `/fig`, `/s`) | Imagem/vídeo/gif com essa legenda, ou responda a uma mídia — vira figurinha. Manda **duas**: a *inteira* (proporção original, nada cortado) e a *quadrada* (512×512, recortada no centro). `/f i` ou `/f q` manda só uma |
| `/roubar` · `/toimg` | Figurinha com o pack do bot · figurinha vira imagem/gif |
| `/audio` | Responda a um vídeo — devolve o mp3. `/audio voz` manda como mensagem de voz; `/audio 0:10 0:35` corta o trecho |

### 🙏 Fé — liturgia diária

| Comando | O que faz |
|---|---|
| `/liturgia` | Leituras católicas de hoje: 1ª leitura, salmo, 2ª leitura (quando tem) e evangelho. Aceita `/liturgia ontem`, `/liturgia amanhã`, `/liturgia 12/09` |
| `/liturgia aqui` | Liga o envio diário **neste grupo** — dono do bot ou admin |
| `/liturgia off` · `/liturgia grupos` | Desliga aqui · lista onde está ligado |
| `/ld <texto>` | Anota o que você entendeu da leitura de hoje. Mandar de novo **soma** ao que já estava |
| `/ld` | Mostra a anotação de hoje (ou as referências, se ainda não anotou) |
| `/ld lista` · `/ld ver 09/08` | Últimas anotações · abre uma inteira |
| `/ld trocar ...` · `/ld apagar` · `/ld ontem ...` | Substitui em vez de somar · apaga · anota em outro dia |

**Todo dia às 06:00** o bot manda as leituras nos grupos que você escolher (no painel ou com `/liturgia aqui`). Cada leitura vai numa mensagem separada, que lê melhor no WhatsApp.

**Se você não mandar o `/ld`**, ele cobra às **12:00**, às **18:00** e às **21:00** — sempre com as referências do dia junto. Assim que você anota, as cobranças seguintes param. O bot conta a sua sequência de dias seguidos.

Fonte das leituras: [liturgia.up.railway.app](https://liturgia.up.railway.app/v2/). O resultado fica em cache por dia, então a API é consultada uma vez só; se ela falhar, tenta 3 vezes antes de desistir.

Ajuste com `LITURGIA_HORARIO` (padrão `06:00`), `LITURGIA_LEMBRETES` (padrão `12:00,18:00,21:00`), `LITURGIA_UNICA=1` (tudo numa mensagem só) e `LITURGIA_ATIVA=0`.

### 🔧 Utilidades

| Comando | O que faz |
|---|---|
| `/calc 1500*0,13` | Calculadora: parênteses, `%`, potência `^`, `raiz()`, `pi`. Sem `eval` — parser próprio |
| `/racha 180 4` | Divide a conta. `/racha 180 4 10%` inclui a gorjeta; `/racha 180 @a @b` divide entre os marcados |
| `/cotacao` | Dólar, euro e bitcoin com a variação do dia. `/cotacao libra` para uma só |
| `/clima Salvador` | Tempo agora e previsão de 3 dias |
| `/cep 40010-000` | Endereço completo do CEP |
| `/horario` | Hora do bot, fuso e quando cada rotina automática dispara |
| `/menu` · `/ping` | Menu e teste de conexão |

Todas as consultas usam APIs públicas gratuitas, sem cadastro nem chave.

## Fuso horário

O bot roda tudo pelo relógio de **America/Bahia**. Isso importa porque servidor de hospedagem quase sempre roda em UTC — sem ajustar, as leituras das 06:00 chegariam às 03:00, o resumo das 07:00 às 04:00, e depois das 21:00 o "hoje" já viraria o dia seguinte, bagunçando agenda, liturgia e a competência dos gastos.

O ajuste é a variável `TZ` no `.env`:

```
TZ=America/Bahia
```

`src/tz.js` é o **primeiro import** do `index.js`, de propósito: ele precisa rodar antes de qualquer `Date` existir no processo. Confira com `/horario` depois de subir.

## Quem pode usar o quê

Os comandos de **financeiro** e **agenda** são só do dono, e **nunca funcionam em grupo**. O primeiro que usar um deles vira o dono — depois disso o bot ignora qualquer outra pessoa que tente.

O resto é configurado **por grupo**, no painel (aba *Mais* → **Grupos**). Os grupos aparecem sozinhos assim que alguém usa um comando neles. Para cada um dá para:

- ligar/desligar **categorias inteiras** (diversão, grupo, mídia, utilidades);
- abrir **exceções por comando** — liberar um de uma categoria desligada, ou bloquear um de uma categoria ligada;
- **silenciar** o bot no grupo por completo;
- definir as **regras** e ligar as **boas-vindas**.

Grupo novo já entra liberado para diversão, grupo, mídia e utilidades — dá para mudar esse padrão no mesmo lugar. `/menu` nunca é bloqueado, senão ninguém descobriria o que está ligado.

## Financeiro (cartões, cobrança e painel web)

O bot controla **quem comprou em qual cartão**, calcula a **fatura certa** de cada compra, **cobra as pessoas** perto do vencimento e serve um **painel web** com tudo.

### Cartões

| Comando | O que faz |
|---|---|
| `/cartao add nubank fecha 3 vence 10 limite 5000` | Cadastra um cartão |
| `/cartao edit nubank vence 12` | Edita (só o que você informar) |
| `/cartao del nubank` | Remove (os gastos ficam sem cartão) |
| `/cartoes` | Lista os cartões com a fatura atual e dias até o vencimento |
| `/fatura nubank [2026-09]` (ou `/fat`) | Detalha a fatura, quebrada por pessoa |

O **dia de fechamento** é o que faz a mágica: compra feita **depois** dele já entra na fatura do mês seguinte, automaticamente.

### Lançamentos

| Comando | O que faz |
|---|---|
| `/gasto 22 danilo nubank lanche` | Lança um gasto |
| `/gasto 300 danilo nubank 3x tênis` | Parcelado — cria 3 lançamentos de R$100 em faturas seguidas |
| `/gasto 45 maria nubank 12/07 uber` | Com data retroativa |
| `/pagou 50 danilo [nubank]` | Registra um pagamento recebido |
| `/conta danilo` · `/contas` | Extrato de uma pessoa · resumo geral |

**Em lote** — mande uma mensagem de várias linhas (a primeira linha define o cartão padrão):

```
/lote nubank
22 danilo lanche
35,90 maria uber
300 joao 3x tenis
18 ana #inter 12/07
```

O bot mostra a prévia com o total e só grava depois do `/confirmar` (ou `/cancelar`). A ordem dos campos é livre: **valor**, **pessoa**, `#cartao`, `3x`, `12/07`, e o resto vira observação.

### Cobrança automática

| Comando | O que faz |
|---|---|
| `/pessoa danilo 11999998888` | Vincula o telefone (necessário para cobrar) |
| `/pessoa` | Lista as pessoas e seus números |
| `/eu danilo` | Marca quem é **você** — seus gastos saem de "a receber" e você nunca é cobrado |
| `/eu` | Mostra quanto da fatura de cada cartão é seu, item a item |
| `/cobrar nubank` | **Simula** a cobrança e te mostra as mensagens |
| `/cobrar nubank real` | Envia de verdade |
| `/relatorios` | Marca **este chat** para receber os avisos automáticos |
| `/fechamento nubank` | Prévia do aviso de fatura fechada |
| `/backup` | Manda o backup agora (.json e .csv) |

Todo dia às 09:00 o bot checa os vencimentos e dispara os lembretes em **D-5, D-2, D-0 e D+1** (cada um só uma vez por fatura). A mensagem sai com o extrato do que a pessoa comprou, o total, a data de vencimento e sua chave PIX.

### Fechamento da fatura e backup

Mande **`/relatorios`** no chat onde você quer ser avisado (o seu próprio, por exemplo). A partir daí, na mesma rotina diária:

- **No dia do fechamento de cada cartão**, você recebe a fatura que acabou de fechar: total, quanto é a sua parte, quanto é dos outros pessoa a pessoa, e o quanto do limite foi usado. Uma vez por fatura.
- **A cada 15 dias**, o backup dos seus dados chega no WhatsApp em dois arquivos: o `.json` (para restaurar) e o `.csv` (para abrir no Excel).

Independente disso, **uma cópia local é feita todo dia** em `data/backups/`, guardando os últimos 30 dias. No painel, aba *Mais*, dá para baixar o CSV na hora ou forçar o envio.

Ajuste com `BACKUP_DIAS` (padrão 15), `BACKUP_MANTER` (padrão 30) e `BACKUP_ATIVO=0`.

> ⚠️ Por padrão a cobrança roda em **modo simulação** — nada é enviado. Confira as mensagens antes e só então suba com `COBRANCA_REAL=1`. Disparar mensagens para números que nunca te escreveram é o jeito mais rápido de tomar ban no WhatsApp. O bot já envia com intervalo aleatório e teto por rodada.

### Painel web

`/painel` devolve o link e a senha. O painel é **feito para o celular**: navegação embaixo (no alcance do polegar), botão flutuante `+` para lançar um gasto em poucos toques, bottom sheets em vez de modais, e listas em vez de tabelas. No desktop a barra vira menu lateral.

Dá para **instalar como app**: abra no Chrome/Safari do celular e use *Adicionar à tela de início* — ele abre em tela cheia, sem barra de navegador.

Tudo que dá pra fazer pelo WhatsApp dá pra fazer por lá — e mais:

- **Resumo** — faturas abertas, a receber, próximo vencimento, evolução de 12 meses, divisão por cartão, parcelas comprometidas nos meses à frente
- **Minha parte** — bloco em destaque com quanto da fatura é seu, quebrado por cartão e item a item. Marque quem é você tocando numa pessoa → *Sou eu* (ou na aba Mais). Seus gastos somem de "a receber", você nunca entra na cobrança, mas continuam contando no total da fatura
- **Botões 📋 Copiar** — em toda tela onde faz sentido: a cobrança pronta de uma pessoa (com todos os cartões, o total e o PIX), o resumo de uma fatura inteira, a lista de quem está devendo com o total geral, e a sua parte. É só colar no WhatsApp
- **Cartões** — fatura atual, uso do limite, quem deve o quê, cobrar, histórico de faturas
- **Pessoas** — saldos e telefone; toque numa pessoa para ver o extrato dela e registrar pagamento (com atalhos "Tudo" e "Metade")
- **Histórico** — agrupe por **dia**, **cartão** ou **pessoa**, e filtre por qualquer cartão e/ou pessoa (os dois combinam). O cabeçalho mostra a contagem e o total do filtro. Toque num item para **editar**: trocar o cartão, a pessoa, o valor, a data e a observação — ao trocar o cartão ele já mostra em que fatura o lançamento vai cair com o fechamento do cartão novo. Nos pagamentos dá para trocar de qual cartão eles abatem. Os botões *📜 Histórico* (no cartão) e *📜 Ver tudo* (na pessoa) já abrem filtrado
- **Mais** — lote, extratos dos PDFs, chave PIX e disparo manual dos lembretes
- **Botão `+`** — valor, pessoa, cartão, parcelas e data selecionados por toque; mostra "3x de R$ 100,00" enquanto você digita

A senha vai só no `sessionStorage` do navegador — nunca na URL — e a API bloqueia o IP por 15 minutos depois de 8 senhas erradas.

Variáveis de ambiente (veja [.env.example](.env.example)): `PAINEL_PORT` (3333), `PAINEL_HOST` (127.0.0.1), `PAINEL_TOKEN` (senha fixa; se vazia gera uma aleatória a cada boot e imprime no log), `PAINEL_URL` (URL pública, para o `/painel`), `PAINEL_ATIVO=0` para desligar. Cobrança: `COBRANCA_REAL=1`, `COBRANCA_HORARIO`, `COBRANCA_MAX`, `COBRANCA_ATIVA=0`.

## Agenda: compromissos e tarefas

Anote falando normal — o bot entende o "quando" dentro da frase.

| Comando | O que faz |
|---|---|
| `/lembrete 18:30 treinar` | Compromisso de hoje às 18:30 |
| `/lembrete amanhã 09:00 pagar faculdade` | Aceita `hoje`, `amanhã`, `depois de amanhã`, dias da semana, `12/09`, `em 30min`, `em 2h` |
| `/lembrete comprar presente` | Sem hora vira **tarefa**: não toca alarme, só aparece no resumo do dia |
| `/lembrete todo dia 7h academia` | Repete: `todo dia`, `dias úteis`, `toda segunda`, `todo mês dia 10` |
| `/lembretes` | Lista os próximos, agrupados por dia, com o número de cada um |
| `/hoje` (ou `/agenda`) | Tudo do dia: compromissos, tarefas, atrasados e faturas vencendo |
| `/amanha` · `/semana` · `/semana fds` | Amanhã · próximos 7 dias · fim de semana |
| `/feito 3` | Conclui (aceita vários: `/feito 3 5 7`) |
| `/cancelarlembrete 3` | Apaga |

### O que chega sozinho

Marque o chat com **`/relatorios`** (o mesmo do fechamento e do backup) e, às 07:00:

- **Todo dia** — bom-dia com os compromissos e tarefas do dia, o que ficou atrasado e as faturas que vencem nos próximos 3 dias
- **Segunda** — junto vai a visão dos 7 dias
- **Sexta** — junto vai o fim de semana

Além disso, **cada compromisso com hora marcada dispara um aviso na hora**. Itens que se repetem todo dia aparecem num bloco "🔁 Rotina" nas visões semanais, em vez de repetir sete vezes.

Ajuste com `AGENDA_HORARIO` (padrão `07:00`) e `AGENDA_ATIVA=0`.

No painel, a aba **Agenda** mostra tudo agrupado por dia com um círculo para concluir, e o botão flutuante vira 📝 com a mesma escrita livre do WhatsApp — com prévia ao vivo de como o bot entendeu. O Resumo ganha um bloco "Hoje" no topo, e a aba mostra uma bolinha com o número de pendências.

## Deploy na Square Cloud

O [squarecloud.app](squarecloud.app) já está configurado (`SUBDOMAIN=harmito`, `MAIN=src/index.js`). A Square Cloud só alcança o processo em **`0.0.0.0:80`** — por isso o `.env` precisa ir junto no zip:

```
PAINEL_HOST=0.0.0.0
PAINEL_PORT=80
PAINEL_TOKEN=uma-senha-longa-e-aleatoria
PAINEL_URL=https://harmito.squareweb.app
```

Três coisas que **não** estão no git e precisam entrar no zip do deploy:

- **`.env`** — copie de `.env.example` e troque a senha
- **`auth/`** — a sessão do WhatsApp já pareada (senão o bot vai pedir QR code no log a cada deploy)
- **`data/`** — seus lançamentos, se já tiver algum

> 🔓 Com o subdomínio ativo o painel fica **acessível por qualquer um na internet** — a senha é a única barreira. Use algo longo e aleatório, e não a repita de outro serviço. Se preferir manter tudo privado, deixe `PAINEL_HOST=127.0.0.1` e acesse por túnel SSH.

### Extrato bancário (PDF)

Mande o **PDF do extrato** para o bot com o **nome da conta na legenda** (ex.: `Nubank`). Ele lê as **saídas do mês** e guarda separado por conta — aparece em `/contas` e na aba Extratos.

> A leitura do PDF é genérica e pode precisar de ajuste ao layout do seu banco. Os dados ficam em `data/finance.json` (fora do git); a migração do formato antigo é automática e gera um `.v1.bak.json` antes de mexer.

## Como adicionar um comando novo (jogo, etc.)

Crie um arquivo em `src/commands/`, por exemplo `src/commands/moeda.js`:

```js
export default {
  name: 'moeda',
  aliases: ['coin'],
  description: 'Cara ou coroa',
  // heavy: true  → use para comandos que processam mídia (entram na fila)

  async run({ sock, msg, chatId, userId, args }) {
    const lado = Math.random() < 0.5 ? 'Cara' : 'Coroa'
    await sock.sendMessage(chatId, { text: `🪙 ${lado}!` }, { quoted: msg })
  },
}
```

Reinicie o bot e pronto — ele carrega automaticamente e já aparece no `/menu`.

## Configurações

Edite [src/config.js](src/config.js):
- Nome do pack e autor da figurinha
- Duração máxima do vídeo (padrão 8s)
- Limite de uso por usuário (padrão 5 comandos/minuto)
- Prefixos de comando

## Estrutura

```
src/
  index.js        → conexão com WhatsApp (Baileys) + reconexão automática
  handler.js      → roteador de comandos, fila e rate limit
  config.js       → configurações
  commands/       → um arquivo por comando (plugins)
  lib/
    sticker.js          → conversão imagem/vídeo → webp + metadados EXIF
    media.js            → download de mídia (direta ou respondida)
    rateLimit.js        → limite de uso por usuário
    finance.js          → base financeira (cartões, pessoas, gastos, faturas)
    parseLancamento.js  → parser das linhas de lançamento (WhatsApp e painel)
    cobranca.js         → montagem das mensagens, envio e agendador diário
    pdfExtrato.js       → leitura do PDF de extrato bancário
    wa.js               → conexão do WhatsApp compartilhada com o painel
  web/
    server.js           → API + servidor do painel (node:http, sem deps)
    public/             → painel (HTML/CSS/JS puro, gráficos em SVG)
```

## Requisitos

- Node.js 20+ ✅ (instalado: v24)
- FFmpeg no PATH ✅ (instalado via winget)
