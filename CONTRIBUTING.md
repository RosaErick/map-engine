# Contribuindo

Contribuição é bem-vinda de qualquer pessoa. Duas coisas antes de abrir um PR.

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
npm run verify     # testes + build + smoke em navegador de verdade
npm run check      # tsc --noEmit + svelte-check
```

Os dois têm que estar limpos. O smoke abre o build por `file://` num chromium headless
e **lê pixels** — é o que garante que a saída continua correta, e é a parte que não dá
para conferir no olho.

## Regras de código

Estão em [`AGENTS.md`](AGENTS.md), com as decisões de arquitetura em formato ADR. As
que mais derrubam PR:

1. **A engine não conhece o editor.** `packages/engine/` não importa framework de UI,
   não toca no DOM fora do próprio canvas, não lê nada global.
2. **Svelte 5 com runes.** Nada de `export let`, `$:` ou `createEventDispatcher`.
3. **TypeScript strict, sem `any`.**
4. **Código e comentários em inglês; interface e documentação em português.**
5. **Comportamento novo vira um `AC-n` em [`docs/SPEC.md`](docs/SPEC.md)**, com o id no
   nome do teste.

## Antes de propor uma feature

Leia [`docs/TASKS.md`](docs/TASKS.md) e a seção "Fora de escopo" do
[brief](prompt-mapping-engine.md). Várias coisas que parecem naturais — timeline, edge
blending, cadeia de efeitos, reatividade a áudio — estão fora de propósito, não por
esquecimento. Uma ferramenta pequena que alinha perfeito vale mais que uma grande que
alinha quase.
