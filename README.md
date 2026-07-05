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
    sticker.js    → conversão imagem/vídeo → webp + metadados EXIF
    media.js      → download de mídia (direta ou respondida)
    rateLimit.js  → limite de uso por usuário
```

## Requisitos

- Node.js 20+ ✅ (instalado: v24)
- FFmpeg no PATH ✅ (instalado via winget)
