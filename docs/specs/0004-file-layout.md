# 0004 — Onde cada arquivo mora

O editor chegou a 25 arquivos numa pasta só. Não é mais um punhado de
componentes em volta de uma engine: é um aplicativo. Este documento decide onde
cada arquivo mora, e **por quê** — nenhuma pasta existe aqui por ser assim que
se faz.

Nada de lógica muda. Só caminho de arquivo e a linha de `import` que aponta para
ele.

---

## O que este projeto é, antes de escolher qualquer estrutura

Duas coisas diferentes dividem o mesmo repositório:

- **`packages/engine`** é uma **biblioteca**. Tem API pública (`index.ts`),
  domínio de verdade (o que é uma superfície, o que sempre tem que ser verdade
  sobre ela), e a regra mais dura do projeto: não conhece DOM, não conhece
  framework, não tem cópia de interface.
- **`packages/editor`** é **um aplicativo** em volta dela. E — isto é o ponto —
  **não tem domínio próprio**. O agregado mora na engine; o editor lê `$store`,
  chama métodos e desenha.

Por isso a tentação óbvia está errada: espelhar `domain / application /
adapters` dentro do editor criaria três pastas onde uma delas ficaria vazia de
verdade e as outras duas seriam nomes bonitos para "componentes". Seria aplicar
um padrão por ser um padrão.

As duas pastas recebem estruturas **diferentes**, porque são coisas diferentes.

---

## `packages/engine` — pela direção das dependências

A engine tem uma hierarquia real, e ela já é obedecida hoje sem estar escrita em
lugar nenhum. Verificada arquivo a arquivo antes de decidir:

```
math/     não importa nada da engine
  ↑
model/    importa math/
  ↑
render/   importa model/ e math/
  ↑
engine.ts importa render/, model/ e sources/
  ↑
index.ts  a superfície pública
```

Os nomes existem para tornar a regra **visível**: se um dia um arquivo em
`math/` importar de `render/`, está errado e dá para ver de relance, sem
precisar entender o que o arquivo faz.

| Pasta | O que é | Arquivos |
|---|---|---|
| `math/` | Funções puras que não sabem o que é um projeto: geometria projetiva, geometria de polígono, conversão de cor | `homography.ts`, `geometry.ts`, `color.ts` |
| `model/` | O domínio: o que existe, o que é sempre verdade, e o **único** caminho de mutação | `project.ts`, `store.ts`, `warp.ts`, `surface-math.ts` |
| `render/` | O que fala WebGL | `renderer.ts`, `shaders.ts` |
| `sources/` | Cada tipo de conteúdo virando textura | inalterada |
| raiz | O orquestrador e a porta de entrada | `engine.ts`, `index.ts` |

**`warp.ts` fica em `model/`, e não em `math/`,** apesar de ser quase todo
matemática: pelo ADR-0019 a malha é uma camada da superfície, um objeto de valor
do domínio. Ela não importa nada do modelo, então a regra continua valendo.

**`surface-math.ts` fica em `model/`** porque lê `Surface` e `Source` — não é
matemática pura, é geometria **derivada do modelo**. Foi o arquivo que provou
que uma pasta `math/` ingênua estaria mentindo.

Os testes continuam ao lado do arquivo que testam. Uma pasta `tests/` paralela
obrigaria a navegar dois lugares para entender uma coisa.

---

## `packages/editor` — pelas regiões da tela e pelo que fala com o navegador

O editor não tem camadas de domínio para separar. Tem **quatro regiões de tela**
e **dois eixos não visuais**, e é isso que a estrutura reflete — porque é assim
que alguém procura um arquivo aqui: "onde é a barra de cima", "onde é o painel
da direita", "onde é o salvamento".

| Pasta | O que é | Por que é uma fronteira de verdade |
|---|---|---|
| `stage/` | A área de trabalho e as ferramentas dela | É onde o ponteiro encosta na superfície. Todo gesto de mapeamento nasce aqui |
| `panels/` | Os painéis da lateral | Cada um é uma preocupação fechada: projeto, lista, inspetor, conteúdo |
| `pages/` | As páginas de texto que substituem o editor | Guia e sobre não são editor: quando estão na tela, o laço de render para |
| `platform/` | O que fala com API do navegador | **A fronteira mais dura do editor.** É o que a engine se recusa a conhecer: pasta, IndexedDB, `localStorage`, tema |
| `ui/` | Primitivas sem nenhum conhecimento de domínio | Se um arquivo aqui mencionar "superfície", está na pasta errada |
| `i18n/` | Catálogos e o guia | inalterada |

Na raiz ficam só as quatro coisas que **tudo** toca: `main.ts` (a única entrada),
`App.svelte` (a casca que decide o que aparece), `TopBar.svelte` (a barra que
aparece sempre), `state.svelte.ts` (o estado do editor), mais duas tabelas de
constantes de três e doze linhas.

`TopBar.svelte` fica na raiz junto de `App.svelte` de propósito: as duas são a
moldura do aplicativo — uma decide o que é mostrado, a outra está sempre
visível. Uma pasta com um arquivo só seria pior do que nenhuma.

---

## Como isto não apodrece

Uma estrutura sem guarda volta ao estado anterior em poucas semanas, um
`import` de cada vez. `scripts/check-layers.mjs` reprova a direção errada, e
entra no `npm run verify` junto com o resto.

### Critérios

- **AC-73** — Nenhum arquivo em `engine/math/` importa de `model/`, `render/`,
  `sources/` ou da raiz; nenhum arquivo em `model/` importa de `render/`; e
  nada em `editor/ui/` importa do estado ou do domínio.
