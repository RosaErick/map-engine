# Contribuindo

Contribuição é bem-vinda de qualquer pessoa. Algumas coisas antes de abrir um PR.

## A licença é AGPL-3.0, e isso é de propósito

Ao enviar uma contribuição você concorda em licenciá-la sob a **AGPL-3.0**, a mesma
licença do projeto (*inbound = outbound*). Não há CLA e não há cessão de direitos: cada
pessoa continua dona do que escreveu.

A escolha é deliberada. O espaço de projection mapping grátis no navegador é dominado
por ferramentas de código fechado, e a AGPL é o que impede que este projeto vire uma
delas — inclusive quando alguém o hospeda como serviço, sem distribuir binário nenhum.
Se você modificar e publicar, o código modificado sai junto.

Consequência prática: embutir a engine dentro de um produto de código fechado **não é
permitido**. Se esse for o seu caso, abra uma issue antes de investir tempo.

## O que o PR precisa passar

```bash
npm run verify     # testes + camadas + idioma + build + smoke em navegador de verdade
npm run check      # tsc --noEmit + svelte-check
```

Os dois têm que estar limpos. O smoke abre o build por `file://` num chromium headless
e **lê pixels** — é o que garante que a saída continua correta, e é a parte que não dá
para conferir no olho.

O CI roda essa mesma sequência em todo pull request, com o mesmo rasterizador de
software que você tem na sua máquina, e anexa o `dist/index.html` gerado como artefato:
para revisar uma mudança visual basta baixar esse arquivo e abrir, sem construir nada.
O que cada script faz está na tabela de comandos do [README](README.md#comandos), e a
lista completa está no `package.json`.

## Como o commit e o PR são escritos

- **Mensagem em inglês, minúscula, no imperativo, uma linha**, dizendo o que a mudança
  faz para o usuário ou para o código — `remember the project folder between sessions`,
  `let the click reach the surface on top`. Sem prefixo de tipo, sem escopo entre
  parênteses, sem ponto final. `git log` é a referência.
- **Um branch por assunto**, e ele entra por pull request.
- **O corpo do PR explica o porquê**, não o quê: o diff já diz o quê. Se a mudança é
  visual, diga o que olhar no arquivo anexado pelo CI; se ela muda comportamento
  garantido, diga qual `AC-n` cobre.

## Regras de código

Estão em [`AGENTS.md`](AGENTS.md), com as decisões de arquitetura em formato ADR. As
que mais derrubam PR:

1. **A engine não conhece o editor.** `packages/engine/` não importa framework de UI,
   não toca no DOM fora do próprio canvas, não lê nada global.
2. **Svelte 5 com runes.** Nada de `export let`, `$:` ou `createEventDispatcher`.
3. **TypeScript strict, sem `any`.**
4. **Código e comentários em inglês; interface e documentação em português.**
5. **Comportamento novo vira um critério numerado.** Cada garantia do projeto tem um id
   `AC-n` que aparece no **nome do teste** que a prova — `test('AC-29: each GL context
   gets its own texture for the same source', …)`. É essa convenção que torna a ligação
   entre garantia e prova greppável, sem depender de ferramenta nenhuma. Os ids são
   permanentes: um critério que sai é substituído por um id novo, nunca renumerado nem
   reaproveitado. Para achar o próximo livre:

   ```bash
   grep -rho "AC-[0-9]\+" packages --include="*.test.ts" | sort -u -t- -k2 -n | tail -1
   ```

## Antes de propor uma feature

O escopo é pequeno de propósito. Várias coisas que parecem naturais estão fora dele por
decisão, não por esquecimento: edge blending, múltiplos projetores, mapping 3D com
modelo e câmera virtual, cadeia de efeitos, reatividade a áudio, OSC/MIDI/DMX, gravação
da saída, colaboração, nuvem e autenticação. Uma ferramenta pequena que alinha perfeito
vale mais que uma grande que alinha quase.

A lista não é sagrada — ela já encolheu. Warp por malha e a timeline de cenas estavam
nela e entraram, cada uma com um desenho que impede que ela transforme a ferramenta em
outro produto: a malha é opcional e um projeto salvo sem ela continua idêntico byte a
byte, e uma cena guarda apresentação, nunca geometria, para que dê para corrigir
alinhamento com o show rodando. O [changelog](docs/CHANGELOG.md) conta os dois casos.

O que faz uma reversão dessas acontecer é o argumento, não o entusiasmo. Abra uma issue
antes de escrever código, com o problema físico por trás — o que você não consegue fazer
hoje na frente de um projetor — e por que a solução precisa morar dentro da ferramenta.
Ideias registradas sem compromisso de fazer ficam em [`docs/FUTURO.md`](docs/FUTURO.md).
