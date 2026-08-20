# Projection Mapping Engine

Minha própria ferramenta de *projection mapping* que roda no navegador, desenvolvida
do zero com apoio de ferramentas de IA generativa. Você aponta um projetor para um
objeto físico — uma parede com quadros, uma pilha de caixas, um móvel —, desenha formas
por cima da projeção que coincidem com ele, e joga conteúdo dentro de cada forma:
imagem, vídeo, GIF, cor, captura de tela, câmera ao vivo ou canvas generativo.

São duas metades com fronteira rígida: uma **engine** sem interface, que recebe um
estado serializável e renderiza; e um **editor**, que é só uma das formas possíveis de
produzir aquele estado. A engine roda sozinha, importada como biblioteca por qualquer
outro projeto.

> **Preto é transparente.** Todo pixel preto na saída é ausência de luz, e a superfície
> física aparece através dele. Fora das formas mapeadas, nada é desenhado — nem um
> cinza, nem uma borda, nem um pixel de interface.

**Gratuita e de código aberto, hoje e sempre.** Sem versão paga, sem plano, sem conta,
sem marca d'água, sem limite de projetos e sem nuvem. A licença
[AGPL-3.0](#licença) é o que garante isso: qualquer um pode usar, estudar e contribuir,
e ninguém pode fechar o código e revender.

Todo conteúdo gerado por LLMs foi revisado, editado e selecionado pelo desenvolvedor
antes de ser inserido no projeto.

---

## Instalar

**Não é programador?** O passo a passo está em
**[`docs/INSTALL.pt.md`](docs/INSTALL.pt.md)** — também em
[inglês](docs/INSTALL.en.md) e [espanhol](docs/INSTALL.es.md). Em resumo, dois caminhos:

- **Instalar como aplicativo** — abra o endereço no Chrome ou Edge e clique no ícone
  de instalar na barra de endereço. Ganha ícone próprio, janela sem barra de endereço
  e passa a funcionar sem internet.
- **Baixar um arquivo** — pegue `projection-mapping.html` nos
  [Releases](../../releases) e dê dois cliques. Um arquivo só, ~285 KB, sem instalação
  e sem servidor.

---

## Começo rápido (desenvolvimento)

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # dist/ — index.html autocontido + manifest, ícones e service worker
```

`dist/index.html` funciona sozinho: os outros arquivos só existem para a instalação como
aplicativo, e a ausência deles não impede nada.

---

## Teclado

| Tecla | O que faz |
|---|---|
| `↑ ↓ ← →` | Move o canto selecionado **1 px** — ou a superfície inteira, se nenhum canto estiver selecionado |
| `Shift` + setas | O mesmo, **10 px** |
| `Ctrl` (segurar) | Desliga o ímã enquanto estiver pressionado |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Desfazer / refazer |
| `Ctrl+D` | Duplicar a superfície selecionada |
| `Delete` | Apagar a superfície selecionada |
| `H` | Esconder / mostrar a interface |
| `Esc` | Cancelar o traçado de polígono, largar a seleção de canto |
| Roda do mouse | Zoom no ponto do cursor |
| Botão do meio, ou `Alt` + arrastar | Pan |
| Duplo clique (modo polígono) | Fecha o polígono |

---

## Encaixe do conteúdo

Dentro de cada superfície o conteúdo tem quatro controles independentes, no painel
da direita:

| Controle | O que faz |
|---|---|
| **encaixe** | `esticar` ignora a proporção · `caber` mostra tudo e deixa preto na sobra · `preencher` cobre a forma e corta o excesso |
| **rotação** | Gira o conteúdo em torno do centro do frame, 0–359°, com atalhos de 0/90/180/270. O **frame não se mexe**, então girar é seguro numa superfície já travada e alinhada |
| **opacidade** | 0–100% |
| **mistura** | `normal` · `soma` · `screen` · `multiply` |

Um quarto de volta troca a proporção usada por `caber` e `preencher`, para um vídeo
deitado continuar encaixando. Rotação livre é para corrigir projetor torto, não para
reenquadrar.

---

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento com HMR |
| `npm run build` | Gera `dist/index.html` autocontido |
| `npm test` | 44 testes de unidade (`node:test`, zero dependências) |
| `npm run smoke` | Abre o build por `file://` em chromium headless e **lê pixels** da saída |
| `npm run i18n` | Reprova string fixa no editor e tradução que perdeu placeholder |
| `npm run verify` | Os quatro acima, em ordem |
| `npm run check` | `tsc --noEmit` + `svelte-check` |
| `npm run build:lib` | Gera `dist-lib/` — a engine como biblioteca, com tipos |
| `npm run example` | Roda [`examples/embed/`](examples/embed), que consome essa biblioteca |

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
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | O que mudou a cada versão |
| [`docs/INSTALL.pt.md`](docs/INSTALL.pt.md) | Instalação passo a passo, em três idiomas |

---

## Licença

**AGPL-3.0-only** ([`LICENSE`](LICENSE)). Qualquer um pode usar, estudar, modificar e
contribuir. O que a AGPL impede é o único cenário que este projeto não quer: alguém
pegar o código, fechar e publicar como produto próprio — inclusive hospedando como
serviço, sem distribuir binário nenhum. Modificou e publicou, o código modificado sai
junto.

Como contribuir está em [`CONTRIBUTING.md`](CONTRIBUTING.md).

