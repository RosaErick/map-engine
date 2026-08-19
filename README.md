# Projection Mapping Engine

Ferramenta de *projection mapping* que roda no navegador. Você aponta um projetor para
uma superfície física qualquer — uma parede com quadros, uma pilha de caixas, uma
janela, um móvel —, desenha formas por cima da projeção que coincidem com os objetos
reais, e joga conteúdo dentro de cada forma: imagem, vídeo, GIF, cor sólida, captura de
tela, câmera ao vivo ou canvas generativo.

São duas metades com fronteira rígida: uma **engine** sem interface, que recebe um
estado serializável e renderiza; e um **editor**, que é só uma das formas possíveis de
produzir aquele estado. A engine roda sozinha, importada como biblioteca por qualquer
outro projeto.

> **Preto é transparente.** Todo pixel preto na saída é ausência de luz, e a superfície
> física aparece através dele. Fora das formas mapeadas, nada é desenhado — nem um
> cinza, nem uma borda, nem um pixel de interface.

---

## Começo rápido

```bash
npm install
npm run dev          # http://localhost:5173
```

Ou, para levar para o local da montagem, um arquivo só que abre sem servidor:

```bash
npm run build        # dist/index.html — ~100 KB, autocontido, abre por file://
```

Copie `dist/index.html` para um pendrive e dê dois cliques. Não precisa de servidor,
não precisa de rede.

### O fluxo de 60 segundos

1. **abrir pasta** — escolha (ou crie) a pasta do projeto. É lá que ficam o
   `project.json` e a mídia.
2. **casar resolução** — escolha a tela do projetor e clique para adotar a resolução
   nativa dela. Sem isso você alinha num canvas escalonado, e escalonar duas vezes
   borra exatamente o que você acabou de alinhar.
3. **+ superfície** — arraste os 4 cantos até cobrirem o objeto físico. Use as setas
   para os últimos pixels.
4. **arraste um vídeo** da pasta direto para cima da superfície.
5. **saída** — manda a projeção para a segunda tela; o editor fica no laptop.
6. **H** — esconde a interface.

---

## Teclado

| Tecla | O que faz |
|---|---|
| `↑ ↓ ← →` | Move o canto selecionado **1 px** — ou a superfície inteira, se nenhum canto estiver selecionado |
| `Shift` + setas | O mesmo, **10 px** |
| `Ctrl` (segurar) | Desliga o snap enquanto estiver pressionado |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Desfazer / refazer |
| `Ctrl+D` | Duplicar a superfície selecionada |
| `Delete` | Apagar a superfície selecionada |
| `H` | Esconder / mostrar a interface |
| `Esc` | Cancelar o traçado de polígono, largar a seleção de canto |
| Roda do mouse | Zoom no ponto do cursor |
| Botão do meio, ou `Alt` + arrastar | Pan |
| Duplo clique (modo polígono) | Fecha o polígono |

---

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento com HMR |
| `npm run build` | Gera `dist/index.html` autocontido |
| `npm test` | 22 testes de unidade da engine (`node:test`, zero dependências) |
| `npm run smoke` | Abre o build por `file://` em chromium headless e **lê pixels** da saída |
| `npm run verify` | Os três acima, em ordem |
| `npm run check` | `tsc --noEmit` + `svelte-check` |

O smoke test é o que prova as promessas difíceis: que o build abre sem servidor com o
console limpo, que fora das superfícies o preto é absoluto, e que uma borda reta
continua reta num quadrilátero deformado em perspectiva (desvio medido: 0,50 px).

---

## Tipos de conteúdo

| Tipo | Origem | Observação |
|---|---|---|
| `image` | arquivo na pasta | decodificado uma vez |
| `video` | arquivo na pasta | upload guiado por `requestVideoFrameCallback`; WebM com alfa funciona |
| `gif` | arquivo na pasta | quadros via `ImageDecoder` (WebCodecs), com relógio próprio |
| `color` | cor sólida | textura 1×1 |
| `capture` | `getDisplayMedia()` | **qualquer janela da máquina vira textura ao vivo** — jogo, player, outra aba |
| `camera` | `getUserMedia()` | câmera ao vivo |
| `canvas` | módulo JS seu | exporta `draw(ctx, t)`; ponto de extensão para conteúdo generativo |

Uma fonte alimenta várias superfícies: o cache é por fonte, não por superfície.

---

## Usar a engine sem o editor

A engine não importa framework nenhum, não toca no DOM fora do próprio canvas e não lê
nada global.

```ts
import { createEngine, parseProject } from './packages/engine/index.ts';

const engine = createEngine(canvas, parseProject(json), {
  // como caminhos relativos viram URLs carregáveis — o host decide
  resolveUrl: async (path) => new URL(path, base).href,
});

engine.setSurfaceFrame(id, [tl, tr, br, bl]);
engine.setSurfaceSource(id, sourceId);
engine.on('change', (state) => console.log(state.project.surfaces.length));
engine.start();
```

Toda mutação passa por métodos do store (`engine.store`), o que faz de uma ponte
OSC/MIDI futura um adaptador puro, sem tocar no renderer.

---

## Requisitos

**Chromium desktop (Chrome ou Edge).** Várias APIs necessárias existem só ali:
File System Access, Window Management, `ImageDecoder`, `requestVideoFrameCallback`.
A ausência de cada uma é detectada e avisada explicitamente — sem pasta de projeto o
app continua funcionando com a mídia em memória e o `project.json` no navegador, e
diz isso na tela.

---

## Documentação

| Documento | O que é |
|---|---|
| [`prompt-mapping-engine.md`](prompt-mapping-engine.md) | O brief original: a intenção, os princípios inegociáveis, o escopo da v1 |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | O que cada arquivo faz, o traço de um frame, as cinco armadilhas de renderização |
| [`docs/SPEC.md`](docs/SPEC.md) | Critérios de aceite numerados, ligados aos testes pelo id |
| [`docs/TASKS.md`](docs/TASKS.md) | O que falta, em ordem de quem bloqueia o teste físico |
| [`AGENTS.md`](AGENTS.md) | As decisões de arquitetura em formato ADR, e as regras para quem for mexer |

---

## O que este projeto **não** faz

Deliberadamente fora do escopo da v1: edge blending, múltiplos projetores, mapping 3D,
warp por malha para superfície curva, timeline e cues, cadeia de efeitos, reatividade a
áudio, OSC/MIDI/DMX, gravação de saída, colaboração, nuvem, autenticação, tema claro.

Uma ferramenta pequena que alinha perfeito vale mais que uma grande que alinha quase.
