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

## Instalar

**Não é programador?** As instruções com passo a passo estão em
**[`INSTALAR.md`](INSTALAR.md)**. Em resumo, dois caminhos:

- **Instalar como aplicativo** — abra o endereço no Chrome ou Edge e clique no ícone
  de instalar na barra de endereço. Ganha ícone próprio, janela sem barra de endereço
  e passa a funcionar sem internet.
- **Baixar um arquivo** — pegue `projection-mapping.html` nos
  [Releases](../../releases) e dê dois cliques. Um arquivo só, ~100 KB, sem instalação
  e sem servidor.

## Começo rápido (desenvolvimento)

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # dist/ — index.html autocontido + manifest, ícones e service worker
```

`dist/index.html` funciona sozinho: os outros arquivos só existem para a instalação como
aplicativo, e a ausência deles não impede nada.

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

## Interface

Tema **claro**, **escuro** ou seguindo o sistema — o seletor fica no topo à direita, e a
escolha é lembrada. A **área de trabalho é sempre preta**, nos dois temas: ela não é
fundo de interface, é pré-visualização do que sai do projetor, e clarear isso faria a
ferramenta mentir sobre o que vai aparecer na parede.

O botão **sobre** abre uma página curta explicando a ferramenta, e o ícone do GitHub leva
ao código.

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
| `npm test` | 22 testes de unidade da engine (`node:test`, zero dependências) |
| `npm run smoke` | Abre o build por `file://` em chromium headless e **lê pixels** da saída |
| `npm run verify` | Os três acima, em ordem |
| `npm run check` | `tsc --noEmit` + `svelte-check` |

O smoke test é o que prova as promessas difíceis: que o build abre sem servidor com o
console limpo, que fora das superfícies o preto é absoluto, e que uma borda reta
continua reta num quadrilátero deformado em perspectiva (desvio medido: 0,50 px).

---

## Publicar

O build é um arquivo só, com tudo embutido e caminhos relativos — ele funciona igual
num subcaminho de GitHub Pages, num domínio próprio, ou aberto do disco.

**GitHub Pages.** O workflow em [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
roda os testes, builda e publica a cada push na `main`. Ligue uma vez em
*Settings → Pages → Source: GitHub Actions*. Servido por `https`, o app vira instalável:
o service worker cacheia tudo e ele passa a abrir offline, com permissões de câmera e
captura lembradas — coisa que `file://` não consegue fazer.

**Release com o arquivo avulso.** `git tag v0.1.0 && git push origin v0.1.0` dispara
[`.github/workflows/release.yml`](.github/workflows/release.yml), que testa, builda e
anexa `projection-mapping.html` ao Release.

**Netlify.** [`netlify.toml`](netlify.toml) já traz comando e diretório. Conecte o
repositório e não há mais nada a configurar — ou arraste a pasta `dist/` para o
Netlify Drop, sem repositório nenhum.

Nos dois casos o site sai em `https`, que é o que `getDisplayMedia`, a câmera e o
File System Access exigem. Para o local da montagem, **baixe o `index.html` publicado
e leve no pendrive**: sem rede, ele continua abrindo e funcionando igual.

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

## Licença

**AGPL-3.0-only** ([`LICENSE`](LICENSE)). Qualquer um pode usar, estudar, modificar e
contribuir. O que a AGPL impede é o único cenário que este projeto não quer: alguém
pegar o código, fechar e publicar como produto próprio — inclusive hospedando como
serviço, sem distribuir binário nenhum. Modificou e publicou, o código modificado sai
junto.

Como contribuir está em [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## O que este projeto **não** faz

Deliberadamente fora do escopo da v1: edge blending, múltiplos projetores, mapping 3D,
warp por malha para superfície curva, timeline e cues, cadeia de efeitos, reatividade a
áudio, OSC/MIDI/DMX, gravação de saída, colaboração, nuvem, autenticação, tema claro.

Uma ferramenta pequena que alinha perfeito vale mais que uma grande que alinha quase.
