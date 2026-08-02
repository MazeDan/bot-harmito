# Bot de Figurinhas 🤖

Bot de WhatsApp que cria figurinhas estáticas e animadas, com sistema de comandos em plugins (fácil de adicionar jogos e novos comandos).

## Como rodar

```
npm start
```

Na primeira vez, vai aparecer um **QR code no terminal** — escaneie com o WhatsApp em *Configurações → Aparelhos conectados → Conectar aparelho*. A sessão fica salva na pasta `auth/` (não precisa escanear de novo).

> ⚠️ Use um número dedicado para o bot. Baileys é uma biblioteca não oficial e há um pequeno risco de banimento do número.

## Comandos

| Comando | O que faz |
|---|---|
| `/fig` (ou `/s`) | Envie uma imagem/vídeo/gif com essa legenda, ou responda a uma mídia — vira figurinha (estática ou animada) |
| `/roubar` | Responda a uma figurinha — ela volta com o pack do bot |
| `/toimg` | Responda a uma figurinha — vira imagem (ou gif, se animada) |
| `/dado` | Joga um dado (`/dado 20` para d20) |
| `/moeda` | Cara ou coroa |
| `/ppt pedra` | Pedra, papel e tesoura contra o bot |
| `/feio @fulano` | Mede o quanto a pessoa é feia 😄 |
| `/gado @fulano` | Gadômetro 🐂 |
| `/ship @a @b` | Shipômetro — % do casal 💘 |
| `/sorte pergunta?` | Bola 8 mágica 🎱 |
| `/escolher a, b, c` | Escolhe uma opção por você |
| `/ping` | Verifica se o bot está online |
| `/menu` | Lista todos os comandos |

Prefixos aceitos: `/`, `!` e `.`

## Financeiro (cartões, cobrança e painel web)

O bot controla **quem comprou em qual cartão**, calcula a **fatura certa** de cada compra, **cobra as pessoas** perto do vencimento e serve um **painel web** com tudo.

### Cartões

| Comando | O que faz |
|---|---|
| `/cartao add nubank fecha 3 vence 10 limite 5000` | Cadastra um cartão |
| `/cartao edit nubank vence 12` | Edita (só o que você informar) |
| `/cartao del nubank` | Remove (os gastos ficam sem cartão) |
| `/cartoes` | Lista os cartões com a fatura atual e dias até o vencimento |
| `/fatura nubank [2026-09]` | Detalha a fatura, quebrada por pessoa |

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
| `/cobrar nubank` | **Simula** a cobrança e te mostra as mensagens |
| `/cobrar nubank real` | Envia de verdade |

Todo dia às 09:00 o bot checa os vencimentos e dispara os lembretes em **D-5, D-2, D-0 e D+1** (cada um só uma vez por fatura). A mensagem sai com o extrato do que a pessoa comprou, o total, a data de vencimento e sua chave PIX.

> ⚠️ Por padrão a cobrança roda em **modo simulação** — nada é enviado. Confira as mensagens antes e só então suba com `COBRANCA_REAL=1`. Disparar mensagens para números que nunca te escreveram é o jeito mais rápido de tomar ban no WhatsApp. O bot já envia com intervalo aleatório e teto por rodada.

### Painel web

`/painel` devolve o link e a senha. O painel é **feito para o celular**: navegação embaixo (no alcance do polegar), botão flutuante `+` para lançar um gasto em poucos toques, bottom sheets em vez de modais, e listas em vez de tabelas. No desktop a barra vira menu lateral.

Dá para **instalar como app**: abra no Chrome/Safari do celular e use *Adicionar à tela de início* — ele abre em tela cheia, sem barra de navegador.

Tudo que dá pra fazer pelo WhatsApp dá pra fazer por lá — e mais:

- **Resumo** — faturas abertas, a receber, próximo vencimento, evolução de 12 meses, divisão por cartão, parcelas comprometidas nos meses à frente
- **Cartões** — fatura atual, uso do limite, quem deve o quê, cobrar, histórico de faturas
- **Pessoas** — saldos e telefone; toque numa pessoa para ver o extrato dela e registrar pagamento (com atalhos "Tudo" e "Metade")
- **Histórico** — lançamentos agrupados por dia; toque num item para ver detalhes ou excluir
- **Mais** — lote, extratos dos PDFs, chave PIX e disparo manual dos lembretes
- **Botão `+`** — valor, pessoa, cartão, parcelas e data selecionados por toque; mostra "3x de R$ 100,00" enquanto você digita

A senha vai só no `sessionStorage` do navegador — nunca na URL — e a API bloqueia o IP por 15 minutos depois de 8 senhas erradas.

Variáveis de ambiente (veja [.env.example](.env.example)): `PAINEL_PORT` (3333), `PAINEL_HOST` (127.0.0.1), `PAINEL_TOKEN` (senha fixa; se vazia gera uma aleatória a cada boot e imprime no log), `PAINEL_URL` (URL pública, para o `/painel`), `PAINEL_ATIVO=0` para desligar. Cobrança: `COBRANCA_REAL=1`, `COBRANCA_HORARIO`, `COBRANCA_MAX`, `COBRANCA_ATIVA=0`.

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
