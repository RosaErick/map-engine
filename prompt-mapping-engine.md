# Projection Mapping Engine — brief de construção

## Missão

Construir uma ferramenta de projection mapping que roda no navegador. O usuário liga um projetor numa superfície física qualquer — uma parede com quadros, uma pilha de caixas, uma janela, um móvel — desenha formas por cima da projeção que coincidem com os objetos reais, e joga conteúdo dentro de cada forma: imagem, vídeo, GIF, cor sólida, captura de tela, câmera ao vivo, ou canvas generativo.

A ferramenta tem duas metades com fronteira rígida entre elas: uma **engine** sem interface, que recebe um estado serializável e renderiza; e um **editor**, que é uma das formas possíveis de produzir aquele estado. A engine tem que rodar sozinha, sem o editor, importada como biblioteca por qualquer outro projeto.

## Princípios inegociáveis

**Preto é transparente.** Todo pixel preto na saída é ausência de luz, e a superfície física aparece através dele. O fundo da saída é `#000000` absoluto — nada de cinza escuro, nada de gradiente, nada de vinheta, nada de borda. Fora das formas mapeadas, nada é desenhado. Essa regra vale também para a interface: em modo de saída limpa, nenhum pixel de UI existe.

**A engine não conhece o editor.** O pacote da engine não importa framework de UI nenhum, não toca no DOM fora do seu próprio canvas, não lê nada global. Recebe `Project`, devolve frames. Se essa fronteira vazar, a ferramenta virou um app e deixou de ser um motor.

**Funciona offline.** O build final abre sem servidor e sem rede. Em local de montagem não existe wi-fi confiável e não existe tempo para debugar isso.

**Nada de ouro.** Implemente o escopo da v1 e pare. Uma ferramenta pequena que alinha perfeito vale mais que uma grande que alinha quase.

## Stack decidida

Não reavalie estas escolhas, elas já foram ponderadas:

- **Vite + TypeScript strict.** Build para arquivo único com `vite-plugin-singlefile` e `base: './'`, para abrir via `file://`.
- **Renderização: WebGL2 puro, zero dependência gráfica.** Sem Pixi, sem Three, sem regl. O núcleo é malha texturizada 2D com UV projetivo — abstração de terceiro atrapalha exatamente na parte que importa, e WebGL2 hoje roda por padrão em todos os navegadores principais.
- **Não use WebGPU.** Para 2D texturizado não há ganho que justifique o risco.
- **Editor: Svelte 5 com runes,** sem biblioteca de estado. O store mora no pacote da engine como um objeto serializável que expõe `subscribe(fn)` — chamando `fn` imediatamente e devolvendo a função de cancelamento. Essa assinatura **é** o contrato de store do Svelte, então o editor lê o estado da engine com `$store` sem uma linha de adaptador, e a engine continua sem saber que Svelte existe.
- Use **actions (`use:`)** para todo comportamento imperativo de ponteiro — arrastar canto, arrastar superfície, pan, zoom. Handler de ponteiro conversando com canvas é onde nasce a maior parte dos bugs num editor, e action mantém esse código fora do ciclo de render da UI.
- **Svelte 5, nunca sintaxe do Svelte 4.** Runes (`$state`, `$derived`, `$effect`, `$props`) e nada de `export let`, `$:` reativo ou `createEventDispatcher`. As duas sintaxes convivem na documentação e na internet, então código gerado tende a misturar as duas — se aparecer sintaxe antiga, corrija antes de seguir em frente, não depois.
- **Alvo: Chromium (Chrome/Edge) desktop.** Várias APIs necessárias são só Chromium. Detecte ausência e degrade com aviso claro, não silenciosamente.
- Código, identificadores e comentários em inglês. Interface do editor em português.

## Arquitetura

```
/packages/engine     — zero deps, zero framework, zero DOM externo
  project.ts         — tipos, defaults, validação, migração de versão
  store.ts           — estado + subscribe + undo/redo
  homography.ts      — solve 4 pontos, inversa, aplicação
  geometry.ts        — triangulação, hit-test, bounds
  sources/           — um módulo por tipo de fonte, interface comum
  renderer.ts        — contexto WebGL2, programas, loop de desenho
  index.ts           — API pública

/packages/editor     — Svelte, só produz mutações no store
/packages/output     — janela de saída limpa, só renderer + store
```

A API pública da engine tem que ser suficiente para isto funcionar sem o editor:

```ts
const engine = createEngine(canvas, project);
engine.load(projectJson);
engine.setSurfaceFrame(id, corners);
engine.setSurfaceSource(id, sourceId);
engine.start(); engine.stop();
engine.on('change', cb);
```

## Modelo de dados

Isto é o contrato. Escreva exatamente assim antes de escrever qualquer render.

```ts
type Vec2 = { x: number; y: number };

type Source =
  | { id: string; name: string; kind: 'image';   path: string }
  | { id: string; name: string; kind: 'video';   path: string; loop: boolean; muted: boolean; rate: number }
  | { id: string; name: string; kind: 'gif';     path: string }
  | { id: string; name: string; kind: 'color';   rgb: [number, number, number] }
  | { id: string; name: string; kind: 'capture' }              // getDisplayMedia
  | { id: string; name: string; kind: 'camera';  deviceId?: string }
  | { id: string; name: string; kind: 'canvas';  moduleId: string };

type Shape =
  | { kind: 'quad' }
  | { kind: 'ellipse'; feather: number }
  | { kind: 'polygon'; points: Vec2[] };   // normalizados 0..1 no espaço do frame

interface Surface {
  id: string;
  name: string;
  frame: [Vec2, Vec2, Vec2, Vec2];   // TL, TR, BR, BL — em pixels da saída
  shape: Shape;
  sourceId: string | null;
  crop: { x: number; y: number; w: number; h: number };  // 0..1 dentro da fonte
  fit: 'stretch' | 'contain' | 'cover';
  opacity: number;
  blend: 'normal' | 'add' | 'screen' | 'multiply';
  locked: boolean;
  visible: boolean;
  z: number;
}

interface Project {
  version: 1;
  output: { width: number; height: number };
  sources: Source[];
  surfaces: Surface[];
}
```

### A decisão central: frame + máscara

**Toda superfície é um quadrilátero de 4 cantos (o `frame`) mais uma forma de recorte dentro dele.** Círculo, polígono e quadrado usam o mesmo caminho de código.

O `frame` é o que carrega a perspectiva — é ele que o usuário arrasta para alinhar com o objeto físico. A `shape` vive em coordenadas normalizadas 0..1 dentro do frame, então mexer no frame carrega a forma junto, coerentemente. Quando o usuário traça um polígono livre clicando na tela, converta os pontos para o espaço do frame pela homografia inversa, e inicialize o frame como o quadrilátero envolvente dos pontos traçados.

Não crie um caminho separado para elipse. Não crie um caminho separado para polígono.

## Renderização — as cinco armadilhas

Estas são as coisas que toda implementação ingênua erra. Resolva cada uma explicitamente.

### 1. UV com correção de perspectiva

Um quadrilátero desenhado como dois triângulos com UV interpolado linearmente produz uma **dobra diagonal visível** no meio da textura. É o erro clássico, e num mapping ele salta aos olhos.

Calcule a homografia `H` que leva o espaço do frame (0..1)² para os pixels da saída. Para cada vértice, obtenha `(X, Y, W) = H · (u, v, 1)`. A posição em pixels é `(X/W, Y/W)`.

**Preferido:** deixe o hardware corrigir. Converta a posição em pixels para clip space `c`, e emita `gl_Position = vec4(c.x * W, c.y * W, 0.0, W)`. Com o `w` correto, o rasterizador interpola todo `varying` de forma projetivamente correta e um `varying vec2 vUV` simples já funciona.

**Alternativa:** emita `varying vec3 vUV = vec3(u/W, v/W, 1.0/W)` e no fragmento faça `vUV.xy / vUV.z`.

Com isso resolvido, **dois triângulos bastam**. Não subdivida a malha para disfarçar o problema.

### 2. Máscara

Quad e elipse: renderize o frame inteiro e recorte no fragment shader. A elipse usa a distância radial em espaço de frame com `smoothstep` para o feather.

Polígono: triangule por ear clipping e deixe a geometria ser a máscara. Feather em polígono fica fora da v1 — borda dura.

### 3. Upload de vídeo

Não faça `texImage2D` a cada `requestAnimationFrame`. Use **`video.requestVideoFrameCallback()`**, que dispara na taxa de quadros do vídeo e não na do monitor — um vídeo a 25fps num monitor a 60Hz dispara 25 vezes por segundo em vez de 60, e você economiza dois terços dos uploads. Está disponível de forma estável desde outubro de 2024.

Marque a textura como suja no callback e faça o upload uma vez por frame de render, não uma vez por superfície — várias superfícies podem compartilhar a mesma fonte.

Autoplay: navegador bloqueia vídeo com som sem gesto do usuário. Carregue com `muted`, `playsinline`, `loop`, e destrave a reprodução no primeiro clique dentro do app.

### 4. GIF

`<img>` com GIF animado não dá acesso aos quadros. Use **`ImageDecoder` do WebCodecs**, que decodifica imagens animadas (GIF, PNG, WebP, AVIF) em `VideoFrame`, com seleção de track para os formatos animados — disponível no Chrome desde a versão 94. Leia `frameCount` e a duração de cada quadro, e avance com relógio próprio.

Fallback se `ImageDecoder` faltar: desenhe o `<img>` num canvas 2D a cada frame e suba esse canvas. Funciona, mas você perde o controle de tempo.

### 5. Alfa e ponto preto

Trabalhe com alpha pré-multiplicado de ponta a ponta e seja consistente na flag de upload — misturar convenções produz halo escuro na borda das formas, que num projetor vira uma moldura cinza em volta de cada quadro.

Suporte WebM com canal alfa (VP8/VP9), que é como se faz conteúdo recortado para projeção.

Nunca clareie o preto. Sem `clearColor` diferente de zero, sem correção de gama dupla, sem tone mapping.

## Fontes de conteúdo

Interface comum: `{ getTexture(gl): WebGLTexture | null, size: [w,h], isDirty: boolean, update(): void, dispose(): void }`.

Implemente na v1: **image**, **video**, **gif**, **color**, **capture**, **camera**, **canvas**.

Duas merecem destaque. **`capture` usa `getDisplayMedia()`** — captura de tela ou de janela específica, virando textura ao vivo. Isso é o equivalente de Spout/Syphon dentro do navegador: qualquer outro aplicativo rodando na máquina vira fonte mapeável, incluindo um jogo, um player, ou outra aba. É a feature de maior alavancagem da lista inteira, e sai de graça.

**`canvas` recebe um módulo JS do usuário** que exporta `draw(ctx, t)`. É o ponto de extensão para conteúdo generativo, sem que a engine precise saber o que é.

Uma fonte pode alimentar várias superfícies. Faça o cache por fonte, não por superfície.

## Editor

### O fluxo de 60 segundos

Alguém que nunca abriu a ferramenta tem que conseguir, em um minuto: abrir → clicar em "nova superfície" → arrastar os 4 cantos até cobrir um objeto físico → arrastar um arquivo de vídeo de dentro da pasta para cima dela → esconder a interface. Se qualquer passo exigir ler documentação, o design falhou.

### Manipulação

- Arrastar canto. Arrastar a superfície inteira. Arrastar dentro para mover, nas alças para deformar.
- Canto selecionado aceita **setas do teclado: 1px, com Shift 10px.** Esse ajuste fino não é opcional — é ele que separa "quase encaixado" de encaixado, e sem ele a ferramenta é inutilizável na prática.
- Zoom e pan na tela de edição.
- Snap opcional a cantos e arestas de outras superfícies, com tecla para desligar.

### Afordâncias que a ferramenta precisa ter

- **Lock por superfície.** Depois de alinhar uma superfície com o objeto real, travar. Esbarrar num canto já alinhado é o acidente mais comum e mais caro.
- **Solo e mute por superfície.** Alinhar uma coisa por vez, com o resto apagado.
- **Padrões de teste**, disponíveis com um clique e sobrepondo tudo: grade, número da superfície, cruz de centro, branco sólido, preto sólido, barras de cor, e uma linha em movimento para checar latência. Sem isso não se alinha nada em condição real.
- **Undo/redo** com histórico. É uma ferramenta, não uma demo.
- **Duplicar superfície.**
- **Renomear.** Uma lista de "Surface 7" é inútil; "quadro da esquerda" não é.

### Saída e telas

Use a **Window Management API**. Cheque `screen.isExtended`, chame `getScreenDetails()` para enumerar as telas, e ofereça um seletor "enviar saída para: [tela]". A saída vai para o projetor com `requestFullscreen({ screen })`, e o editor fica na tela do laptop.

O recurso de **Fullscreen Companion Window** do Chrome permite, a partir de um único gesto do usuário, entrar em tela cheia numa tela e abrir uma janela na outra — exatamente o par janela-de-controle mais janela-de-saída que essa ferramenta precisa. Use isso.

As duas janelas compartilham estado por `BroadcastChannel`. Cada janela tem seu próprio contexto WebGL e seu próprio renderer lendo o mesmo store; contexto GL não atravessa janela. A janela de saída não tem UI nenhuma, nem cursor, nem borda.

Se a API não estiver disponível, caia para janela única com overlay escondível e avise o usuário do que ele está perdendo.

### Projeto em disco

Um projeto é uma **pasta**, não um arquivo. Dentro: `project.json` com caminhos relativos, e a mídia ao lado. Abrir usa `showDirectoryPicker()` e guarda o handle. Se um arquivo sumiu, mostre a superfície com padrão de "mídia faltando" bem visível e ofereça religar — nunca falhe em silêncio, nunca desenhe nada em cima do objeto físico se a fonte não carregou.

Salve automaticamente a cada mudança, com debounce. Perder um alinhamento de meia hora por causa de um crash é inaceitável numa ferramenta de montagem.

## Performance

- Não redesenhe se nada mudou e nenhuma fonte animada está ativa. Instalação parada não deve manter a GPU a 60fps por nada.
- Uma passada, sem framebuffer intermediário na v1.
- Ordene os desenhos por `z`, agrupando por textura quando possível.
- `antialias: true`, `preserveDrawingBuffer: false`, `alpha: false` no contexto de saída.
- A resolução do canvas de saída é a resolução nativa do projetor, sem escalonamento intermediário. Escalonar duas vezes borra o que você acabou de alinhar com precisão de pixel.
- Meta: 30 superfícies com 4 vídeos 1080p simultâneos a 60fps numa GPU de notebook.

## Fora de escopo da v1

Não implemente, mesmo parecendo natural: edge blending, múltiplos projetores, mapping 3D com modelo e câmera virtual, warp por malha/bezier para superfície curva, timeline e cues, cadeia de efeitos, reatividade a áudio, OSC/MIDI/DMX, gravação de saída, colaboração, nuvem, autenticação, tema claro.

## Preparado para, mas não construído

Deixe estes pontos de extensão limpos, sem implementá-los:

- **Controle externo:** todas as mutações passam por métodos do store. Uma ponte OSC via WebSocket depois deve ser só um adaptador que chama esses métodos.
- **Warp por malha:** `Shape` é uma união discriminada. Um `{ kind: 'mesh' }` novo não deve exigir mexer no renderer além de gerar vértices.
- **Múltiplas saídas:** `output` no `Project` é um objeto, não campos soltos, para virar array depois.

## Critério de aceite

Testável fisicamente, com um projetor de verdade:

1. Build abre por `file://`, sem servidor, sem rede, console limpo.
2. Aponto o projetor para uma parede com três quadros. Crio três superfícies, arrasto os cantos, e as bordas projetadas coincidem com as molduras reais dentro de 1px.
3. Uso as setas para corrigir 1px num canto e vejo a diferença na parede.
4. Coloco imagem num quadro, vídeo em loop no outro, e GIF no terceiro. Tudo toca ao mesmo tempo sem engasgo.
5. Crio uma superfície elíptica sobre um objeto redondo e o conteúdo é recortado no círculo, com feather ajustável.
6. Traço um polígono livre sobre um objeto irregular e ele recorta corretamente.
7. Ligo o padrão de grade e a grade aparece sem distorção dentro de cada superfície — **sem dobra diagonal no meio**.
8. Uso `capture` para mapear a janela de outro programa numa das superfícies, ao vivo.
9. Travo uma superfície, tento arrastar, nada se move.
10. Mando a saída para a segunda tela e o editor fica no laptop.
11. Em modo de saída limpa, o único pixel aceso na parede está dentro das superfícies. Cobrindo o projetor com a mão, a parede está totalmente escura.
12. Fecho, reabro a pasta do projeto, e tudo volta exatamente onde estava.

## Qualidade de código

TypeScript strict, sem `any`. A matemática de homografia e geometria tem testes unitários — ida e volta pela homografia e sua inversa tem que voltar ao ponto de origem com erro abaixo de 1e-9, e essa é a primeira coisa a escrever, antes de qualquer render.

Construa nesta ordem, verificando cada etapa antes de seguir: matemática com testes → renderer com uma superfície quad e uma cor sólida → arrastar cantos → fontes de imagem e vídeo → formas → padrões de teste → persistência em pasta → segunda janela.

Quando algo no brief estiver ambíguo, escolha a opção mais simples que satisfaz o critério de aceite e deixe um comentário `// DECISION:` explicando a escolha. Não invente features para preencher lacuna.
