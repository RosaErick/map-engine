# Backlog — Projection Mapping Engine

Base: `prompt-mapping-engine.md`. Este documento descreve o que **está no código hoje**
(24 testes de unidade + 12 checagens de smoke passando, `tsc --noEmit` e `svelte-check`
limpos, `dist/index.html` de ~100 KB gerado como arquivo único) e o que falta. Os ids
`AC-n` citados aqui são os de [`SPEC.md`](SPEC.md).

**Última atualização:** 19/08/2026, depois da rodada de correções que fechou os itens
marcados `[x]` abaixo. Nada aqui é feature nova: tudo sai do brief,
de um critério de aceite não cumprido, ou de um comentário `ponytail:` / `DECISION:`
deixado no código.

---

## Estado atual

| # | Critério de aceite | Status | Justificativa |
|---|---|---|---|
| 1 | Build abre por `file://`, sem servidor, sem rede, console limpo | ✅ implementado | Provado por `scripts/smoke.mjs` (AC-14): chromium headless abre `dist/index.html` por `file://`, a engine monta e o console fica limpo. Ressalva que continua valendo para quem usar a engine como biblioteca: o `resolveUrl` padrão devolve o caminho cru e `fetch()` em URL `file://` é bloqueado — o editor não é afetado porque passa blob URLs vindas do `showDirectoryPicker`. |
| 2 | Três superfícies alinhadas na parede dentro de 1px | 🟡 parcial | Arrastar canto e superfície existe (`packages/editor/Overlay.svelte`, `packages/editor/actions.ts`, `Store.setCorner`). A resolução de saída agora é ajustável na toolbar, com botão "casar resolução" que adota `width × devicePixelRatio` da tela escolhida — o bloqueio de pixel nativo saiu. Falta o teste físico. |
| 3 | Setas movem 1px, Shift 10px | ✅ implementado | `packages/editor/App.svelte:55-65` → `Store.nudgeCorner`, com coalescing de histórico e `endGesture()` no `keyup`. Sem canto selecionado as setas movem a superfície inteira. |
| 4 | Imagem + vídeo em loop + GIF tocando juntos sem engasgo | 🟡 parcial | As três fontes existem e o cache é por id de fonte (`packages/engine/sources/index.ts`, `SourcePool`). Porém cada janela cria sua própria `Engine` e seu próprio `SourcePool` (`packages/output/output.ts:251`), então com a saída aberta todo vídeo é decodificado **duas vezes**. A meta de 30 superfícies com 4 vídeos 1080p nunca foi medida. |
| 5 | Elipse com feather sobre objeto redondo | ✅ implementado | Máscara radial em espaço de frame com `smoothstep` no fragment shader (`packages/engine/renderer.ts:111-118`); botão e slider em `packages/editor/Inspector.svelte:233-245`. |
| 6 | Polígono livre recorta corretamente | ✅ implementado | Traçado em `packages/editor/Stage.svelte:188-208` (bbox vira frame, pontos passam pela homografia inversa), triangulação por ear clipping em `packages/engine/geometry.ts:46`, geometria como máscara em `renderer.ts:286-292`. Depois de traçado os pontos não podem mais ser editados (ver backlog). |
| 7 | Grade sem dobra diagonal | ✅ implementado | `gl_Position = vec4(clip * w, 0.0, w)` em `packages/engine/renderer.ts` deixa o rasterizador interpolar `vUV` projetivamente. Medido, não olhado: AC-20 ajusta uma reta à borda entre barras num quadrilátero fortemente deformado e mede **0,50 px** de desvio máximo em 414 amostras (limite 1,5 px). |
| 8 | `capture` mapeando a janela de outro programa, ao vivo | 🟡 parcial | `CaptureSource` usa `getDisplayMedia`. Fim de track agora vira `status: 'error'` e cai no padrão de mídia faltando em vez de congelar. Continua pendente: abrir a saída dispara um **segundo** prompt de captura, porque cada janela tem seu próprio pool. |
| 9 | Superfície travada não se move | ✅ implementado | Guard `#editable` em `packages/engine/store.ts:167` cobre `setCorner`/`nudgeCorner`/`moveSurface`/`setSurfaceFrame`; `disabled` na action de drag (`Overlay.svelte:151`); coberto por teste (`store.test.ts:103`). |
| 10 | Saída na segunda tela, editor no laptop | 🟡 parcial | `openOutput` posiciona a janela pelos bounds da tela e chama `requestFullscreen({ screen })`. Agora é totalmente síncrona: as telas são enumeradas na montagem da toolbar, não no clique, então nada é `await`-ado antes de `window.open` e a ativação transitória sobrevive (Fullscreen Companion Window). `hasWindowManagement()` checa `screen.isExtended` e escolhe a mensagem de degradação. Falta a verificação com duas telas físicas. |
| 11 | Saída limpa: só as superfícies acesas, resto preto absoluto | ✅ implementado | Janela de saída sem UI, `cursor:none`, body `#000` (`output.ts:245-248`); `clearColor(0,0,0,1)`, `alpha:false`, sem gama nem tone mapping (`renderer.ts:157-198`); superfície sem fonte faz `discard` em vez de pintar preto (`renderer.ts:99-102`). Falta a verificação física da mão em frente ao projetor. |
| 12 | Fechar, reabrir a pasta e tudo voltar | 🟡 parcial | `showDirectoryPicker` + `project.json` com caminhos relativos + autosave com debounce de 400 ms, e `parseProject` derruba lixo em vez de deixar NaN chegar no renderer. Os dois furos do autosave foram fechados: escrita concorrente agora enfileira uma passada extra em vez de descartar o estado novo, e falha de escrita avisa na tela. Continua pendente: o handle da pasta não é persistido entre sessões. |

Legenda: ✅ implementado · 🟡 parcial · ⬜ não feito.
Nenhum critério está em ⬜. O que falta agora é quase todo **precisão física**: o que
sobrou de código está listado abaixo, e o que sobrou de verificação precisa de um
projetor apontado para uma parede.

---

## Backlog

### 1. Saída e telas — o que bloqueia testar com projetor

- [x] ~~**Resolução de saída ajustável, adotando a nativa da tela escolhida**~~ — feito
  Campos largura×altura e botão "casar resolução" na toolbar, que adota
  `width × devicePixelRatio` da tela escolhida. Era o que bloqueava alinhar em pixel
  nativo em vez de num canvas escalonado.
  Onde: `packages/editor/Toolbar.svelte`, `Store.setOutputSize`.

- [x] ~~**Abrir a saída dentro de um único gesto de usuário**~~ — feito
  `openOutput` virou síncrona: as telas são enumeradas na montagem da toolbar, e o
  clique faz `window.open` e `requestFullscreen` sem nenhum `await` antes. É assim que
  o Fullscreen Companion Window sobrevive.
  Onde: `packages/output/output.ts`, `packages/editor/Toolbar.svelte`.

- [x] ~~**Usar `requestFullscreen({ screen })` e checar `screen.isExtended`**~~ — feito
  `hasWindowManagement()` agora exige `screen.isExtended` e escolhe a mensagem de
  degradação; o fullscreen é fixado na tela do projetor pela opção `{ screen }`.
  Onde: `packages/output/output.ts`.

- [ ] **Uma fonte, um decode: compartilhar o `SourcePool` entre editor e saída** — `M`
  Cada janela instancia sua própria `Engine`, logo seu próprio pool: um vídeo 1080p é
  decodificado duas vezes, e `capture`/`camera` pedem permissão duas vezes. A regra do
  brief é cache por fonte, não por superfície — nem por janela. O contexto GL não
  atravessa janela, mas o `<video>`/`ImageDecoder` atravessa.
  Onde: `packages/engine/engine.ts:41-57` (aceitar um pool injetado),
  `packages/output/output.ts:251`, `packages/engine/sources/index.ts`.

### 2. Fontes de conteúdo

- [x] ~~**Tratar fim de track em `capture` e `camera`**~~ — feito
  `setSrcObject` assina `ended` em todas as tracks e vira `status: 'error'`, caindo no
  padrão de mídia faltando em vez de deixar luz parada em cima do objeto físico.
  Onde: `packages/engine/sources/video.ts`.

- [ ] **Religar mídia faltante** — `M`
  O brief pede: "se um arquivo sumiu, mostre a superfície com padrão de mídia faltando
  bem visível **e ofereça religar**". A primeira metade existe (listras magenta,
  `renderer.ts:50-54`, e status na lista de fontes); a segunda não — não há como
  apontar a fonte para outro arquivo sem apagar e recriar.
  Onde: `packages/editor/SourcePanel.svelte`, `packages/editor/project-folder.ts:161`.

- [ ] **`ponytail:` upload de vídeo sem `requestVideoFrameCallback`** — `P`
  Fallback marca dirty todo frame de render. Correto, só desperdiça. Verificar se o
  alvo (Chromium desktop) alguma vez cai nesse caminho; se não cair, trocar o fallback
  por um aviso claro em vez de manter o caminho lento.
  Onde: `packages/engine/sources/video.ts:47-59`.

### 3. Projeto em disco

- [x] ~~**Autosave não pode perder gravação nem falhar em silêncio**~~ — feito
  Escrita concorrente enfileira uma passada extra (`saveAgain`) em vez de descartar o
  estado novo, e falha de escrita chama `onError`, que o `App.svelte` liga no aviso de
  tela.
  Onde: `packages/editor/project-folder.ts`, `packages/editor/App.svelte`.

- [ ] **Persistir o handle da pasta entre sessões** — `M`
  O brief diz "abrir usa `showDirectoryPicker()` **e guarda o handle**". Hoje o handle
  só vive na memória do módulo: toda abertura do app exige re-selecionar a pasta antes
  de qualquer coisa aparecer. Guardar em IndexedDB e pedir `queryPermission` na volta.
  Onde: `packages/editor/project-folder.ts:113-133`.

### 4. Editor

- [x] ~~**`patchSurface` ignora o lock**~~ — feito
  `patchSurface` remove `frame` do patch quando a superfície está travada; nome,
  visibilidade e o próprio `locked` continuam passando, senão a trava viraria armadilha.
  Coberto por teste (`AC-9`, segundo caso).
  Onde: `packages/engine/store.ts`.

- [ ] **Editar pontos de um polígono já traçado, e acertar o hit-test** — `M`
  Depois do duplo clique os pontos ficam congelados: um erro de traçado obriga a apagar
  e refazer. E `surfaceAt` testa o retângulo unitário do frame, não o polígono, então
  cliques no canto vazio da bbox selecionam a superfície.
  Onde: `packages/editor/state.svelte.ts:71-81` (usar `pointInPolygon`, já exportado e
  hoje sem nenhum uso fora dos testes), `packages/editor/Overlay.svelte`.

- [ ] **`DECISION:` snap só de canto** — `P`
  Decisão registrada em `packages/editor/state.svelte.ts:49-54`: canto a canto, sem
  aresta, porque aresta em quad com perspectiva é ambígua. O brief pede "cantos **e**
  arestas". Reavaliar depois do primeiro teste físico — se nunca fizer falta na parede,
  fechar como não-fazer em vez de deixar em aberto.

- [x] ~~**Padrão "número" usa a ordem do array, não a da lista**~~ — feito
  `surfaceNumber()` numera por `z` decrescente, a mesma ordem da lista do editor, com
  teste (`AC-11`, segundo caso).
  Onde: `packages/engine/renderer.ts`.

- [x] ~~**`duplicateSurface` gera id fora do `newId`**~~ — feito
  Usa `newId('surf')` como todo o resto.
  Onde: `packages/engine/store.ts`.

- [ ] **`ponytail:` triangulação O(n²), só polígono simples** — `P`
  Anotado em `packages/engine/geometry.ts:42`. Correto para um polígono traçado à mão
  com uma dúzia de pontos; só vira problema se alguém importar SVG. Manter como está e
  só trocar por earcut se aparecer o caso — item registrado para não ser redescoberto.

### 5. Testes

- [ ] **Testar `parseProject` como fronteira de confiança** — `P`
  É o único ponto que impede um `project.json` editado à mão de mandar NaN para o
  renderer e apagar a projeção no meio do show, e não tem teste direto: só o
  round-trip e a referência pendurada em `store.test.ts:149`. Faltam frame com 3
  pontos, coordenada não numérica, `kind` desconhecido, `shape` polígono com 2 pontos.
  Onde: `packages/engine/project.ts:122-229`, novo caso em `packages/engine/store.test.ts`.

- [ ] **Testar a ida e volta polígono → espaço de frame** — `P`
  O caminho de `Stage.finishPolygon` (bbox vira frame, pontos pela homografia inversa)
  é a única parte da matemática do critério 6 sem teste, e é onde um erro produz um
  recorte fora do lugar na parede.
  Onde: `packages/editor/Stage.svelte:188-208` — extrair a função pura para a engine e
  testá-la em `packages/engine/math.test.ts`.

- [x] ~~**Smoke test do build**~~ — feito, e mais fundo do que o previsto
  `scripts/smoke.mjs` (`npm run smoke`) abre o `dist/index.html` por `file://` em
  chromium headless com SwiftShader, opera a UI real e lê pixels com `gl.readPixels`.
  Cobre AC-14 a AC-20, incluindo a medição de retidão de borda que prova a ausência de
  dobra diagonal.
  Onde: `scripts/smoke.mjs`, `package.json` (`smoke`, `verify`).

- [ ] **Falhar se o build deixar referência externa** — `P`
  O smoke prova que o arquivo abre, mas não que ele é autocontido: um `src=`/`href=`
  apontando para fora passaria despercebido se o recurso estivesse em cache. Dez linhas
  grepando o `dist/index.html`.
  Onde: `scripts/smoke.mjs`.

### 6. Verificação física — precisa de projetor de verdade

Nada abaixo é código: é a bateria que fecha os critérios de aceite. Só faz sentido
depois do item de resolução de saída.

- [x] ~~**Critério 1 — abrir `dist/index.html` por `file://`**~~ — automatizado (AC-14)
  Falta só a metade que o headless não faz: confirmar o `showDirectoryPicker` abrindo
  a pasta num Chromium de verdade.

- [ ] **Critérios 2 e 3 — três quadros na parede, cantos dentro de 1px** — `M`
  Alinhar com o mouse, corrigir 1px com as setas e confirmar que a diferença é visível
  na parede. É o teste que valida a resolução nativa de saída.

- [ ] **Critério 7 — grade sem dobra diagonal, em frame bem deformado** — `P`
  Deformar bastante um frame (perspectiva forte) antes de olhar: com pouca perspectiva
  a dobra não aparece nem quando o bug existe.

- [ ] **Critério 11 — ponto preto: mão na frente da lente** — `P`
  Padrão preto ligado e saída limpa: a parede tem que ficar totalmente escura, sem
  cinza, sem moldura em volta das formas. Verificar junto o halo de borda com um WebM
  com canal alfa (VP8/VP9), que é o caso em que a convenção de alpha pré-multiplicado
  falha visivelmente.

- [ ] **Critérios 4 e performance — 30 superfícies, 4 vídeos 1080p, 60fps** — `M`
  Meta declarada no brief, nunca medida. Rodar com a saída aberta (dois contextos GL)
  e com o padrão de varredura ligado para medir latência.

- [ ] **Critério 10 — laptop + projetor, dois monitores de verdade** — `P`
  Enumerar telas, mandar a saída para a segunda, confirmar que o editor fica no laptop
  e que o fechamento da janela devolve tudo ao normal.

- [ ] **Critério 12 — fechar o navegador e reabrir a pasta** — `P`
  Incluindo um arquivo de mídia renomeado de propósito, para ver o padrão de mídia
  faltando aparecer em vez de um silêncio.

---

## Explicitamente fora de escopo (v1)

Copiado do brief. Não implementar, mesmo parecendo natural:

- edge blending
- múltiplos projetores
- mapping 3D com modelo e câmera virtual
- warp por malha/bezier para superfície curva
- timeline e cues
- cadeia de efeitos
- reatividade a áudio
- OSC / MIDI / DMX
- gravação de saída
- colaboração
- nuvem
- autenticação
- tema claro

---

## Pontos de extensão preparados

Existem e devem continuar limpos — não implementar, não sujar.

| Ponto de extensão | Onde vive o gancho |
|---|---|
| **Controle externo** (uma ponte OSC via WebSocket vira só um adaptador) | `packages/engine/store.ts` — toda mutação passa por `Store.mutate` e pelos métodos públicos da classe; nenhum componente do editor escreve no projeto por fora. Ressalva no backlog: `patchSurface` ainda fura o lock. |
| **Warp por malha** (`{ kind: 'mesh' }` sem mexer no renderer além de gerar vértices) | `packages/engine/project.ts:16-19` — `Shape` é união discriminada; o único ponto que precisa de um novo caso é `Renderer.#geometry` em `packages/engine/renderer.ts:285`. |
| **Múltiplas saídas** (`output` vira array depois) | `packages/engine/project.ts:39-44` — `output` é um objeto (`{ width, height }`), não campos soltos em `Project`. |
