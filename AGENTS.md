# AGENTS.md

Regras de trabalho e registro de decisões deste repositório. Quem for mexer no código
— pessoa ou agente — lê isto antes.

O formato do registro é **ADR**: contexto → decisão → consequências. Uma ADR decidida
nunca é reescrita; se a realidade mudar, escreva uma nova que a substitui e marque a
antiga como `Substituída por ADR-nnnn`. Um registro que é editado para bater com o
código vira changelog e perde a única coisa que ele tinha: a razão.

---

## Regras

1. **A engine não conhece o editor.** `packages/engine/` não importa framework de UI,
   não toca no DOM fora do próprio canvas, não lê nada global. Se essa fronteira vazar,
   a ferramenta virou um app e deixou de ser um motor. Ver [ADR-0001](#adr-0001).
2. **Svelte 5 com runes, nunca sintaxe do Svelte 4.** `$state`, `$derived`, `$effect`,
   `$props`. Nada de `export let`, `$:` reativo ou `createEventDispatcher`. As duas
   sintaxes convivem na internet e código gerado tende a misturar — se aparecer
   sintaxe antiga, corrija antes de seguir, não depois.
3. **TypeScript strict, sem `any`.** `npm run check` (tsc + svelte-check) tem que ficar
   limpo.
4. **Código, identificadores e comentários em inglês. Interface do editor em
   português.** Documentação em português.
5. **Toda mutação passa por métodos do `Store`.** É isso, e só isso, que faz de uma
   ponte OSC futura um adaptador puro.
6. **Nada de ouro.** Implemente o escopo da v1 e pare. Fora de escopo está listado no
   brief e no README; não re-adicione por parecer natural.
7. **Ambiguidade vira `// DECISION:`** no ponto do código, explicando a escolha. Atalho
   deliberado vira `// ponytail:` nomeando o teto e o caminho de upgrade.
8. **Antes de dizer que terminou:** `npm run verify` (testes + build + smoke) passando.
   O smoke abre o build real por `file://` e lê pixels; ele é a única prova de que a
   saída continua correta.
9. **Critério novo, id novo.** Comportamento acordado vira um `AC-n` em
   [`docs/SPEC.md`](docs/SPEC.md) e o id entra no nome do teste. Ids nunca são
   renumerados.

---

## Registro de decisões

### ADR-0001 — Fronteira engine/editor costurada por um único `subscribe` {#adr-0001}

**Status:** aceita

**Contexto.** A engine precisa rodar sem o editor, e o editor precisa ler o estado da
engine sem cerimônia. A saída óbvia seria uma biblioteca de estado no meio, ou um
adaptador que traduz o estado da engine para o formato do framework — e aí a engine
passa a ter opinião sobre o framework, ou o editor passa a ter uma cópia do estado.

**Decisão.** O store mora na engine (`packages/engine/store.ts`) como um objeto
serializável que expõe `subscribe(fn)`: chama `fn` imediatamente e devolve a função de
cancelamento. Essa assinatura **é** o contrato de store do Svelte.

**Consequências.** O editor escreve `$store` sem uma linha de adaptador. A engine
continua sem saber que Svelte existe — nenhum import, nenhuma menção. Qualquer outro
host que entenda esse contrato (ou que só chame `subscribe`) funciona igual. O custo é
que o contrato é implícito: quebrar a assinatura de `subscribe` quebra o editor sem
erro de tipo óbvio, então ela está coberta por AC-10.

---

### ADR-0002 — WebGL2 puro, sem biblioteca gráfica

**Status:** aceita (herdada do brief)

**Contexto.** Pixi, Three e regl resolveriam o boilerplate de contexto e programa. Mas
o núcleo desta ferramenta é malha texturizada 2D com UV projetivo, e é exatamente aí
que a abstração de terceiro atrapalha: você acaba lutando contra o pipeline de matriz
da biblioteca para conseguir escrever o `w` que precisa em `gl_Position`.

**Decisão.** WebGL2 direto, zero dependência gráfica. Sem WebGPU: para 2D texturizado
não há ganho que justifique o risco.

**Consequências.** `packages/engine/renderer.ts` carrega o boilerplate de shader,
programa e VAO à mão — cerca de 130 linhas que uma biblioteca teria escondido. Em
troca, o truque de correção de perspectiva (ADR-0004) cabe em uma linha. Zero
dependências em produção; o bundle inteiro do app tem ~100 KB.

---

### ADR-0003 — Toda superfície é um frame de 4 cantos mais uma máscara

**Status:** aceita (herdada do brief)

**Contexto.** Quadrado, círculo e polígono livre parecem três coisas diferentes, e a
implementação ingênua dá a cada um seu caminho de código, sua matemática e seus bugs.

**Decisão.** Uma superfície é sempre um quadrilátero de 4 cantos (o `frame`, em pixels
de saída) mais uma forma de recorte em coordenadas normalizadas `0..1` **dentro** do
frame. O frame carrega a perspectiva; a `shape` vive no espaço do frame. Quad e elipse
recortam no fragment shader; polígono recorta pela própria geometria triangulada.

**Consequências.** Mexer no frame carrega a forma junto, coerentemente, de graça. Um
polígono traçado na tela vira um frame (a caixa envolvente) mais pontos convertidos
pela homografia inversa — nenhum caminho novo. `Shape` é união discriminada, então um
`{ kind: 'mesh' }` futuro não exige mexer no renderer além de gerar vértices. O preço:
o polígono ainda não tem feather (borda dura), porque a máscara dele é geometria e não
um campo de distância.

---

### ADR-0004 — Correção de perspectiva pelo `w` de `gl_Position`

**Status:** aceita

**Contexto.** Um quadrilátero desenhado como dois triângulos com UV interpolado
linearmente produz uma dobra diagonal visível no meio da textura. Num mapping isso
salta aos olhos. Há três saídas: subdividir a malha até a dobra ficar pequena, emitir
`vec3 vUV = vec3(u/w, v/w, 1/w)` e dividir no fragmento, ou deixar o rasterizador
fazer o trabalho.

**Decisão.** Deixar o hardware corrigir: a posição em pixels vira clip space `c`, e o
vértice sai como `gl_Position = vec4(c.xy * w, 0.0, w)`. Com o `w` correto, todo
`varying` é interpolado projetivamente e um `vec2 vUV` simples já funciona.

**Consequências.** Dois triângulos bastam — nenhuma subdivisão, nenhum custo de
vértice. O fragment shader não paga uma divisão por pixel. A malha continua sendo
4 vértices, o que mantém o caminho do polígono (que tem n vértices) idêntico. Medido
por AC-20: 0,50 px de desvio máximo numa borda reta sobre um quadrilátero fortemente
deformado, contra um limite de 1,5 px.

---

### ADR-0005 — Alfa pré-multiplicado numa única função de upload

**Status:** aceita

**Contexto.** Misturar convenções de alfa entre fontes produz halo escuro na borda das
formas, que num projetor vira uma moldura cinza em volta de cada quadro. O erro não
aparece no monitor e aparece na parede.

**Decisão.** Uma função, `uploadTexture` em `packages/engine/sources/types.ts`, faz
todo upload de imagem com `UNPACK_PREMULTIPLY_ALPHA_WEBGL` e `UNPACK_FLIP_Y_WEBGL`
ligados. O blend é `ONE, ONE_MINUS_SRC_ALPHA`. `clearColor` é `(0,0,0,1)`, sem exceção,
sem correção de gama, sem tone mapping.

**Consequências.** Nenhuma fonte pode inventar sua própria convenção sem passar por
essa função — e a única que não passa (`ColorSource`, que sobe 1×1 opaco) está
comentada como tal. WebM com canal alfa funciona. O `flip Y` no upload permite que o
espaço do frame use `v=0` no topo, igual à imagem, sem inverter UV em lugar nenhum.

---

### ADR-0006 — Cache de textura por fonte, upload guiado pelo vídeo

**Status:** aceita

**Contexto.** Uma fonte pode alimentar várias superfícies. Fazer `texImage2D` por
superfície e por `requestAnimationFrame` multiplica o tráfego de textura por dois
fatores independentes.

**Decisão.** `SourcePool` mantém uma instância por id de fonte e faz `update()` uma vez
por frame de render, não uma vez por superfície. Vídeo, captura e câmera marcam a
textura como suja em `requestVideoFrameCallback`, que dispara na taxa de quadros do
vídeo e não na do monitor.

**Consequências.** Um clipe a 25fps num monitor a 60Hz sobe 25 texturas por segundo em
vez de 60. Dez superfícies com a mesma fonte custam um upload. O loop de render também
dorme quando nada mudou e nenhuma fonte animada está ativa (`SourcePool.hasAnimated`),
então instalação parada não segura a GPU a 60fps por nada.

**Pendência conhecida.** Editor e saída têm cada um seu `SourcePool`, porque contexto
GL não atravessa janela — então com a saída aberta cada vídeo decodifica duas vezes e
`capture` pede permissão duas vezes. Registrado em [`docs/TASKS.md`](docs/TASKS.md).

---

### ADR-0007 — GIF por `ImageDecoder`, com degradação avisada

**Status:** aceita

**Contexto.** Um `<img>` com GIF animado não dá acesso aos quadros: não dá para pausar,
não dá para saber quantos são, não dá para controlar o tempo.

**Decisão.** `ImageDecoder` do WebCodecs, lendo `frameCount` e a duração de cada quadro,
avançando com relógio próprio. Onde `ImageDecoder` faltar, o fallback desenha o `<img>`
num canvas 2D a cada frame.

**Consequências.** Ganhamos APNG, WebP e AVIF animados de graça, pelo mesmo caminho. O
fallback funciona, mas o navegador é quem controla o tempo — está comentado como tal no
código, para ninguém tentar depurar por que o scrub não responde ali.

---

### ADR-0008 — Store como classe com um único ponto de mutação

**Status:** aceita

**Contexto.** Histórico, notificação e imutabilidade são três coisas que, espalhadas
pelos métodos, saem de sincronia na terceira semana. E um arrasto de canto dispara
dezenas de mutações: sem agrupamento, `Ctrl+Z` anda um pixel por vez e o histórico é
inútil.

**Decisão.** Todo método de mutação chama `mutate(fn, opts)`, que empilha o histórico,
clona o projeto com `structuredClone` e notifica os assinantes. Gestos passam uma chave
`coalesce` (`corner:<id>:<n>`); mutações consecutivas com a mesma chave colapsam numa
entrada. `endGesture()` fecha o gesto.

**Consequências.** Histórico, imutabilidade e notificação existem em um lugar só.
Trava de superfície idem: o guard `#editable` fica em `Store` e todo chamador herda —
arrastar, mover, setas e `setSurfaceFrame` respeitam a trava sem repetir o teste. O
custo é um `structuredClone` do projeto por mutação, o que a 30 superfícies é ruído.

---

### ADR-0009 — `project.json` é fronteira de confiança

**Status:** aceita

**Contexto.** O arquivo pode ter sido editado à mão, escrito por um build antigo, ou
copiado pela metade. Um canto `NaN` chegando no renderer apaga a parede no meio da
montagem.

**Decisão.** `parseProject` valida campo a campo, preenche defaults e **derruba** o que
não reconhece: fonte de tipo desconhecido, frame que não tem 4 pontos finitos, forma
inválida, referência de fonte que não existe. Um quadrilátero degenerado não é
desenhado (`solveUnitToQuad` devolve `null`).

**Consequências.** Um projeto corrompido abre com menos coisas, visivelmente, em vez de
abrir quebrado. Superfície que perdeu a fonte fica apagada; fonte que existe mas não
carregou mostra o padrão magenta de mídia faltando. Nunca falha em silêncio, e nunca
desenha em cima do objeto físico sem ter conteúdo (AC-16).

---

### ADR-0010 — A janela de saída compartilha o `Store` por referência

**Status:** aceita — **desvia do brief**

**Contexto.** O brief pede `BroadcastChannel` entre a janela de controle e a de saída.
Mas o mesmo brief exige que o build abra por `file://`, e ali cada documento recebe uma
origem opaca: `BroadcastChannel` não conecta as duas janelas. A ferramenta funcionaria
no `npm run dev` e falharia no pendrive, no local da montagem, sem wi-fi para debugar.

**Decisão.** A saída é aberta com `window.open('')`, que herda o realm do opener, e
recebe o **mesmo objeto `Store`**. Cada janela constrói seu próprio contexto WebGL e
sua própria `Engine`, porque contexto GL não atravessa janela — mas não há protocolo,
não há serialização e não há sincronia para dessincronizar.

**Consequências.** Zero latência e zero divergência entre as janelas. Servindo por http
mais tarde, trocar para `BroadcastChannel` é mudar uma função (`openOutput`). O preço
está em ADR-0006: dois pools de fontes, logo dois decodes. E a abertura precisa ser
síncrona dentro do gesto do usuário — nada pode ser `await`-ado antes de
`window.open` e de `requestFullscreen`, ou a ativação transitória expira e o Fullscreen
Companion Window não acontece. As telas são enumeradas antes, na montagem da toolbar,
justamente por isso.

---

### ADR-0011 — Um pacote npm só, três pastas

**Status:** aceita

**Contexto.** O brief descreve `/packages/engine`, `/packages/editor` e
`/packages/output`. A leitura literal seria npm workspaces, com três `package.json`,
três builds e resolução de dependência entre eles.

**Decisão.** A estrutura de pastas é a do brief; o `package.json` é um só. A fronteira
entre engine e editor é mantida por disciplina e revisão, não por empacotamento —
a regra real (`a engine não importa framework`) é verificável lendo os imports.

**Consequências.** Zero cerimônia de workspace para um projeto de uma pessoa. Se um dia
a engine for publicada como biblioteca, o `vite build --lib` aponta para
`packages/engine/index.ts` e o resto não muda. O risco é que nada impede
mecanicamente um import errado — daí a regra 1 estar no topo deste arquivo.

---

### ADR-0012 — Testes sem framework, smoke com navegador de verdade

**Status:** aceita

**Contexto.** A matemática de homografia precisa de teste antes de qualquer render (o
brief é explícito). Mas as promessas mais caras deste projeto — "console limpo por
`file://`", "preto absoluto fora das formas", "sem dobra diagonal" — não são
verificáveis em teste de unidade: são pixels.

**Decisão.** Duas camadas. Unidade em `node:test` com type stripping nativo do Node 22:
zero dependências, zero configuração, `node --test 'packages/engine/*.test.ts'`.
Integração em `scripts/smoke.mjs`: Playwright abre o `dist/index.html` por `file://` em
chromium headless com SwiftShader, opera a UI real e lê pixels com `gl.readPixels`.

**Consequências.** A suíte de unidade não tem custo de manutenção nem de instalação. O
smoke prova AC-14 a AC-20 contra o artefato que vai para o pendrive, não contra um
mock — inclusive medindo em pixels a retidão de uma borda num quadrilátero deformado,
que é a forma objetiva de dizer que a armadilha nº 1 não voltou. O custo é uma
dependência de desenvolvimento pesada (Playwright) e um teste que leva segundos, não
milissegundos.

---

### ADR-0013 — Estado de ensaio fora do `Project`

**Status:** aceita

**Contexto.** Solo, seleção, canto selecionado, padrão de teste e "interface escondida"
são estado — mas não são o show.

**Decisão.** Vivem em `ViewState`, dentro do store mas fora do `Project`, e não são
salvos.

**Consequências.** Reabrir a pasta nunca deixa alguém encarando uma tela quase preta
por causa de um solo esquecido, nem uma grade de teste projetada na inauguração. Em
troca, o padrão de teste ativo não sobrevive a um reload — o que é o comportamento
certo para uma ferramenta de montagem.
