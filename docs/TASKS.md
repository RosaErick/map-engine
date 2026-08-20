# Backlog — Projection Mapping Engine

Base: `prompt-mapping-engine.md`. Este documento descreve o que **está no código hoje**
(85 testes de unidade + 28 checagens de smoke passando, `tsc --noEmit` e `svelte-check`
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
| 8 | `capture` mapeando a janela de outro programa, ao vivo | 🟡 parcial | `CaptureSource` usa `getDisplayMedia`. Fim de track agora vira `status: 'error'` e cai no padrão de mídia faltando em vez de congelar. Abrir a saída não pede mais permissão duas vezes: as duas janelas compartilham o pool de fontes (AC-29). Falta o teste com projetor. |
| 9 | Superfície travada não se move | ✅ implementado | Guard `#editable` em `packages/engine/store.ts:167` cobre `setCorner`/`nudgeCorner`/`moveSurface`/`setSurfaceFrame`; `disabled` na action de drag (`Overlay.svelte:151`); coberto por teste (`store.test.ts:103`). |
| 10 | Saída na segunda tela, editor no laptop | 🟡 parcial | `openOutput` posiciona a janela pelos bounds da tela e chama `requestFullscreen({ screen })`. Agora é totalmente síncrona: as telas são enumeradas na montagem da toolbar, não no clique, então nada é `await`-ado antes de `window.open` e a ativação transitória sobrevive (Fullscreen Companion Window). `hasWindowManagement()` checa `screen.isExtended` e escolhe a mensagem de degradação. Falta a verificação com duas telas físicas. |
| 11 | Saída limpa: só as superfícies acesas, resto preto absoluto | ✅ implementado | Janela de saída sem UI, `cursor:none`, body `#000` (`output.ts:245-248`); `clearColor(0,0,0,1)`, `alpha:false`, sem gama nem tone mapping (`renderer.ts:157-198`); superfície sem fonte faz `discard` em vez de pintar preto (`renderer.ts:99-102`). Falta a verificação física da mão em frente ao projetor. |
| 12 | Fechar, reabrir a pasta e tudo voltar | 🟡 parcial | `showDirectoryPicker` + `project.json` com caminhos relativos + autosave com debounce de 400 ms, e `parseProject` derruba lixo em vez de deixar NaN chegar no renderer. Os dois furos do autosave foram fechados: escrita concorrente agora enfileira uma passada extra em vez de descartar o estado novo, e falha de escrita avisa na tela. Continua pendente: o handle da pasta não é persistido entre sessões. |

A malha livre não está na tabela porque não é um dos doze critérios do brief: é escopo
que entrou depois, com critérios próprios (AC-44 a AC-54 em `docs/SPEC.md`).

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

- [x] ~~**Uma fonte, um decode: compartilhar o `SourcePool` entre editor e saída**~~ — feito
  `ContextTextures` guarda uma textura por contexto GL e a versão que cada um subiu;
  `Engine` aceita um pool emprestado e libera só o próprio contexto ao morrer. Um
  decode, um prompt de captura. AC-29, 5 testes. Ver ADR-0015.
  Onde: `packages/engine/sources/types.ts`, `packages/engine/sources/index.ts`,
  `packages/engine/engine.ts`, `packages/output/output.ts`.

- [x] ~~**Rotação do conteúdo dentro da superfície**~~ — feito
  `Surface.rotation` (graus, horário) entra na amostragem por `uvMatrix`, que compõe
  crop, encaixe e rotação num `mat3` em torno do centro do frame. Um quarto de volta
  troca a proporção usada por `contain`/`cover`. O frame não se mexe, então girar é
  seguro numa superfície travada. AC-28, com 5 testes de unidade e 2 checagens de pixel.
  Onde: `packages/engine/project.ts`, `packages/engine/renderer.ts`,
  `packages/engine/store.ts`, `packages/editor/Inspector.svelte`.

- [ ] **Girar o frame inteiro em torno do centro** — `P`
  Diferente de AC-28: rotacionar os 4 cantos, não o conteúdo. Útil quando o objeto
  físico está torto e o quad inteiro precisa acompanhar, em vez de arrastar canto por
  canto. Passaria pelo guard de lock, ao contrário da rotação de conteúdo.
  Onde: `packages/engine/store.ts` (novo `rotateSurface(id, deg)`),
  `packages/editor/Inspector.svelte`.

- [ ] **Espelhar conteúdo (flip H/V)** — `P`
  A matriz de UV já é `mat3`; espelhar é trocar o sinal de uma escala. Só entra se
  aparecer o caso real — projeção em espelho ou retroprojeção.
  Onde: `packages/engine/renderer.ts` (`uvMatrix`), `Inspector.svelte`.

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

- [x] ~~**Upload de vídeo sem `requestVideoFrameCallback`**~~ — feito, e era bug, não desperdício
  O fallback marcava a textura suja **uma vez só**, na construção: vídeo, GIF, captura e
  webcam **congelavam no primeiro frame** em Firefox e Safari mais antigo. Agora cada
  render invalida a textura enquanto o vídeo toca. Ver ADR-0016.
  Onde: `packages/engine/sources/video.ts`.

- [ ] **Verificar a matriz de navegadores** — `M`
  AC-30 é `not-tested`: o smoke roda em chromium, que tem `requestVideoFrameCallback`.
  O caminho de fallback só se prova em Firefox e Safari, e é onde o congelamento vivia.
  Anotar também o que degrada (pasta de projeto, GIF por `ImageDecoder`, posicionamento
  da saída) e publicar uma tabela de compatibilidade honesta.
  Onde: verificação manual + `README.md`.

- [ ] **Escolher a câmera pelo `deviceId` sobrevive à máquina errada?** — `P`
  A constraint virou `ideal` em vez de `exact`, então um projeto aberto noutra máquina
  pega qualquer câmera em vez de falhar. Falta decidir se isso é o certo: numa
  instalação com duas câmeras, pegar "qualquer uma" em silêncio pode ser pior que o
  erro. Reavaliar depois do primeiro uso real.
  Onde: `packages/engine/sources/video.ts` (`CameraSource`).

### 3. Projeto em disco

- [x] ~~**Autosave não pode perder gravação nem falhar em silêncio**~~ — feito
  Escrita concorrente enfileira uma passada extra (`saveAgain`) em vez de descartar o
  estado novo, e falha de escrita chama `onError`, que o `App.svelte` liga no aviso de
  tela.
  Onde: `packages/editor/project-folder.ts`, `packages/editor/App.svelte`.

- [x] ~~**Persistir o handle da pasta entre sessões**~~ — feito
  O handle vai para IndexedDB (`handle-store.ts`), que aceita clone estruturado —
  `localStorage` só guarda texto. Verificado que IndexedDB funciona e persiste em
  `file://`, que é a distribuição principal e uma origem opaca.
  A promessa é honesta sobre o que o navegador permite: **um clique em vez de navegar o
  diálogo do sistema**, e nenhum quando a permissão é persistente. `requestPermission`
  fora de um gesto do usuário é rejeitado de propósito, então a partida nunca escala
  sozinha — o nome da pasta vira botão e o pedido acontece dentro do clique. Handle
  morto é esquecido. AC-56 a AC-58.
  Onde: `packages/editor/handle-store.ts`, `project-folder.ts`, `App.svelte`,
  `ProjectPanel.svelte`.

### 4. Editor

- [x] ~~**`patchSurface` ignora o lock**~~ — feito
  `patchSurface` remove `frame` do patch quando a superfície está travada; nome,
  visibilidade e o próprio `locked` continuam passando, senão a trava viraria armadilha.
  Coberto por teste (`AC-9`, segundo caso).
  Onde: `packages/engine/store.ts`.

- [x] ~~**Editar pontos de um polígono já traçado, e acertar o hit-test**~~ — feito
  As alças de vértice e o `pointInPolygon` dentro de `surfaceAt` já existiam desde a
  revisão sênior — e o sintoma continuava, porque o diagnóstico apontava para o lugar
  errado. Quem capturava o clique era a trilha do frame no overlay, com
  `pointer-events: fill` sobre a caixa inteira: o ponteiro nunca chegava ao `surfaceAt`.
  A região que responde ao ponteiro passou a ser a silhueta (polígono, elipse amostrada
  em espaço de frame, ou o quad quando não há recorte); o contorno do frame continua
  desenhado como frame, que é o papel dele. AC-59 e AC-60.
  Onde: `packages/editor/Overlay.svelte`.

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

### 4b. Interface

- [x] ~~**Malha livre para superfície curva**~~ — feito
  Camada de deformação opcional entre o frame e o recorte, com pontos de controle
  arrastáveis, atração de vizinhos, interpolação curva (Catmull-Rom) ou reta, e grade de
  controle separada da tesselação. Uma homografia por célula com `w` próprio, então a
  textura fica projetivamente exata dentro da célula e a malha não mostra costura —
  em vez de subdividir até o erro não aparecer, que é o que o brief proíbe. Projeto sem
  malha continua idêntico byte a byte, e o caminho de render sem malha não foi tocado
  para não arriscar o AC-20. AC-44 a AC-54, ADR-0019 e ADR-0020.
  Onde: `packages/engine/warp.ts`, `renderer.ts`, `shaders.ts`, `store.ts`,
  `packages/editor/Inspector.svelte`, `Overlay.svelte`, `docs/specs/0001-mesh-warp.md`.

- [x] ~~**Contraste do guia de malha sobre conteúdo claro**~~ — feito
  Contorno escuro sob o traço claro, como a cartografia faz com estrada sobre qualquer
  fundo. Medir a luminância e inverter, que era a ideia registrada aqui, custaria
  `readPixels` por ponto e por frame — uma parada sincronizada da GPU dentro do laço de
  render. Medido: 1,38 → 3,14 de contraste sobre branco. AC-61.
  Onde: `packages/editor/Overlay.svelte`.

- [x] ~~**Engine publicável como biblioteca**~~ — feito
  `vite.lib.config.ts` + `tsconfig.lib.json` geram `dist-lib/map-engine.js` com
  declarações; `package.json` ganhou `exports`, `types`, `files` e um `prepare`, então
  instalar do git constrói sozinho. `examples/embed/` prova que o artefato é
  consumível — foi aberto no navegador antes de considerar pronto.
  Onde: `vite.lib.config.ts`, `tsconfig.lib.json`, `package.json`, `examples/embed/`.

- [x] ~~**Fonte de módulo JS pela interface**~~ — feito
  Botão **módulo js** no painel de conteúdo: escolhe um `.js`, copia para a pasta do
  projeto e cria a fonte. O ponto de extensão existia no código e não existia para o
  usuário.
  Onde: `packages/editor/SourcePanel.svelte`.

- [x] ~~**Guia de uso dentro do app**~~ — feito
  Página nova na barra de cima, no padrão de documentação técnica: índice fixo que
  acompanha a leitura, dez seções, exemplo de código. Conteúdo tipado em
  `packages/editor/i18n/docs/`, nas três línguas, com teste de paridade (AC-34).
  Onde: `packages/editor/DocsPage.svelte`, `packages/editor/i18n/docs/`.

- [x] ~~**Internacionalização do editor: português, espanhol e inglês**~~ — feito
  Catálogo tipado sem dependência (`packages/editor/i18n/`), idioma detectado por
  `navigator.languages` com seletor no topo e escolha lembrada, e `npm run i18n`
  reprovando string fixa ou tradução que perdeu placeholder/marcação. Engine e
  `packages/output` deixaram de ter cópia de interface: erram por código e o editor
  traduz. AC-33, ADR-0018.
  Onde: `packages/editor/i18n/`, `packages/editor/TopBar.svelte`, `scripts/check-i18n.mjs`.

- [x] ~~**Padrão de teste por superfície**~~ — feito
  O brief pede padrões "sobrepondo tudo", e era só isso que existia. Agora há o global
  (barra de trabalho) e um override por superfície (inspetor), com `'none'` próprio
  servindo para apagar o padrão só numa. Alinhar é uma superfície por vez. AC-32.
  Onde: `packages/engine/project.ts` (`ViewState.surfacePatterns`),
  `packages/engine/store.ts` (`patternFor`, `setSurfacePattern`),
  `packages/engine/renderer.ts` (recebe função, não valor),
  `packages/editor/Inspector.svelte`, `packages/editor/Toolbar.svelte`.

- [x] ~~**Numerar as linhas da lista de superfícies**~~ — feito
  A lista chama `surfaceOrder`, a mesma função do engine que o renderer usa para escolher
  o glifo — e não um `index + 1` próprio, que é como os dois números passariam a
  divergir. `surfaceOrder` virou export público por causa disso. AC-62.
  Onde: `packages/editor/SurfaceList.svelte`, `packages/engine/index.ts`.

- [x] ~~**Redesenho: espaçamento, temas, responsividade, sobre**~~ — feito
  Tailwind v4 + daisyUI no editor (ADR-0017), tema claro/escuro/sistema com persistência,
  layout que empilha o painel abaixo da área de trabalho em tela estreita, painel de
  projeto recolhível, estado vazio que ensina o primeiro passo, ícone e link do
  repositório, e um "sobre" com tipografia de jornal.
  Onde: `packages/editor/*.svelte`, `packages/editor/app.css`,
  `packages/editor/theme.svelte.ts`.

- [x] ~~**Enxugar o CSS do daisyUI**~~ — feito
  A lista `include:` no `app.css` restringe o daisyUI aos componentes realmente usados:
  CSS de 105 KB para 80 KB. O arquivo pequeno é diferencial declarado, e o build inteiro
  cabe em 304 KB com a malha dentro.
  Onde: `packages/editor/app.css`.

- [ ] **Prints do `sobre` e do tema claro no `docs/install/`** — `P`
  Some com os marcadores `📷 print:` agora que existe uma interface para fotografar.

- [ ] **Comentários do editor em português contra a regra do AGENTS.md** — `P`
  A regra 4 diz "código, identificadores e comentários em inglês". A engine cumpre (19
  comentários acentuados em 587); o editor não (179 em 444). Não é defeito de execução,
  é uma regra que erodiu num pacote só — vale decidir se a regra vale para o editor e
  então aplicá-la de uma vez, ou registrar a exceção no AGENTS.md. Traduzir 179
  comentários dentro de uma branch de feature esconderia a feature.
  Onde: `packages/editor/`, `AGENTS.md`.

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

- [x] ~~**Falhar se o build deixar referência externa**~~ — feito
  O smoke grepa `src=`/`href=` no `dist/index.html` e só aceita `data:` e os arquivos
  opcionais de instalação como aplicativo. Pegou uma referência de verdade na primeira
  execução. AC-14.
  Onde: `scripts/smoke.mjs`.

- [x] ~~**Instalação como aplicativo (PWA) e Release com o arquivo avulso**~~ — feito
  `manifest.webmanifest` + ícones gerados por `scripts/make-icons.mjs` + service worker
  **gerado no build e versionado pelo hash do HTML** (AC-31 — versão constante serve o
  app do mês passado para sempre). Registro é guardado por protocolo, então o arquivo
  avulso continua abrindo por `file://` sem tentar registrar nada. Release por tag anexa
  `projection-mapping.html`. Guia em `docs/install/`.
  Onde: `vite.config.ts`, `public/`, `packages/editor/main.ts`,
  `.github/workflows/release.yml`, `docs/install/`.

- [ ] **Prints reais no `docs/install/`** — `P`
  O guia está escrito com marcadores `📷 print:` nos quatro pontos onde uma imagem
  resolve mais que um parágrafo: o ícone de instalar na barra de endereço, o arquivo
  baixado, os quatro cantos sendo arrastados. Precisa de alguém com um projetor e uma
  tela para tirar.
  Onde: `docs/install/`.

- [ ] **Confirmar o que `file://` bloqueia** — `M`
  Segue sem resposta e é o que decide o peso do caminho 2 do `docs/install/`: origem
  opaca não persiste permissão, então `getDisplayMedia`, câmera e `showDirectoryPicker`
  podem pedir autorização toda vez — ou nem funcionar. O guia já avisa disso como
  possibilidade; falta virar fato verificado.
  Onde: verificação manual em Chrome limpo.

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

## Ideias além da v1

Não são tarefas e não têm dono. Ficam em [`FUTURO.md`](FUTURO.md) para não se perderem
nem virarem escopo por acidente — hoje: auto-calibração por câmera com Rust/WASM.

---

## Explicitamente fora de escopo (v1)

Copiado do brief. Não implementar, mesmo parecendo natural — com uma saída
deliberada: **warp por malha** estava nesta lista e foi construído depois, quando ficou
claro que quatro cantos não cobrem coluna nem arco. Ver `docs/specs/0001-mesh-warp.md`.

- edge blending
- múltiplos projetores
- mapping 3D com modelo e câmera virtual
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
| **Controle externo** (uma ponte OSC via WebSocket vira só um adaptador) | `packages/engine/store.ts` — toda mutação passa por `Store.mutate` e pelos métodos públicos da classe; nenhum componente do editor escreve no projeto por fora. |
| ~~**Warp por malha**~~ — **construído**, e não como este gancho previa | O gancho apostava num `Shape` `{ kind: 'mesh' }`. Isso teria custado a máscara: forma é o recorte, e uma malha que ocupasse esse lugar tornaria "elipse deformada" irrepresentável. Virou camada própria (`Surface.warp`), ortogonal ao recorte. ADR-0019. |
| **Múltiplas saídas** (`output` vira array depois) | `packages/engine/project.ts:39-44` — `output` é um objeto (`{ width, height }`), não campos soltos em `Project`. |
