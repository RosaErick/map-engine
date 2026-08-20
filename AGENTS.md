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

### ADR-0014 — AGPL-3.0

**Status:** aceita

**Contexto.** O espaço de projection mapping grátis no navegador já tem um líder
maduro (Map Club) e um freemium (4mapper), e **os dois são de código fechado**. A
pesquisa de arte anterior deixou uma conclusão desconfortável: quase tudo o que este
projeto faz existe em algum lugar, de graça. A única vantagem que um concorrente não
consegue neutralizar por decisão de produto é ser aberto.

Uma licença permissiva (MIT, CC0) permitiria exatamente o cenário que o mercado atual
sugere: alguém pega o código, fecha e publica como produto próprio. E como este é um
app de navegador, um concorrente pode se servir dele **sem distribuir binário nenhum** —
basta hospedar.

**Decisão.** AGPL-3.0-only. A cláusula de rede fecha a brecha do "só hospedei, não
distribuí". Contribuição é *inbound = outbound*: quem contribui licencia sob a mesma
licença, sem CLA e sem cessão de direitos.

**Consequências.** Fork fechado deixa de ser possível, hospedado ou não. Em troca,
embutir a engine dentro de um produto de código fechado também deixa de ser
possível — o que custa parte do público do ponto de extensão "engine como
biblioteca". Foi uma troca consciente: impedir o fork fechado era o requisito, o
embutimento comercial não era. `MPL-2.0` seria o caminho do meio (copyleft por
arquivo, embutimento permitido) se essa prioridade se inverter.

**Nota prática.** Enquanto houver um único autor, relicenciar é possível. Depois do
primeiro PR aceito de outra pessoa, não é — sem pedir permissão a cada contribuinte.
Se a licença for mudar, é agora.

---

### ADR-0017 — Tailwind v4 e daisyUI no editor, nada disso na engine

**Status:** aceita

**Contexto.** A interface começou com CSS escrito à mão e variáveis próprias.
Funcionava, mas o espaçamento era irregular, não havia tema claro e cada componente
reinventava botão, campo e painel. Adicionar um sistema de UI custa bytes num projeto
cujo diferencial declarado é caber num arquivo pequeno.

**Decisão.** Tailwind v4 + daisyUI no **editor**. A engine continua sem tocar em CSS,
sem framework e sem DOM fora do próprio canvas — a fronteira da ADR-0001 não se move.
Dois temas apenas, `light` e `dark`, com 'seguir o sistema' implementado pela ausência
do atributo `data-theme` (o `--prefersdark` do daisyUI já faz o resto, sem uma linha de
JS).

**Consequências.** O build foi de ~104 KB para ~208 KB (gzip: 37 KB → 57 KB). É o dobro,
e é o custo real desta decisão — ainda assim é um arquivo de 208 KB que abre de um
pendrive, então o argumento de distribuição continua de pé. Em troca: espaçamento
consistente, tema claro, componentes acessíveis de graça e muito menos CSS próprio para
manter.

**O tema escuro é Carbonfox**, a variante IBM Carbon do nightfox: base `#161616`,
controles `#262626`, fios `#393939`. O escuro padrão do daisyUI fica perto de `#1d232a`,
que numa sala apagada ainda é cinza aceso ao lado de uma área de trabalho que é preto
absoluto — a interface tem que encostar no preto do canvas, não brigar com ele.

Uma armadilha na tradução do Carbon para o daisyUI: **Carbon empilha clareando**. A
superfície é o fundo, e controle e borda sobem a partir dela. O escuro padrão do daisyUI
faz o contrário — `base-200` e `base-300` são mais escuros que `base-100` —, e copiar
essa direção com uma base já quase preta afunda todo botão dentro do painel. Por isso as
barras usam `base-100` e o que sobe (botão, campo, hover) usa `base-200`.

**A regra que não pode ser esquecida:** a área de trabalho é **sempre preta**, nos dois
temas. Ela não é fundo de interface, é pré-visualização do que sai do projetor, e no
projetor preto é ausência de luz. Pelo mesmo motivo, a paleta das alças do overlay é
fixa e escolhida para contraste contra preto — seguir o tema claro deixaria as alças
invisíveis. A cor primária da interface foi igualada à das alças para as duas metades
falarem a mesma língua.

---

### ADR-0018 — i18n com catálogo tipado, sem biblioteca

**Status:** aceita

**Contexto.** O editor precisa falar mais de uma língua, escolhendo pelo idioma do
navegador e permitindo troca manual. As bibliotecas de i18n do ecossistema resolvem
coisas que este app não tem: carregamento assíncrono de catálogo, namespaces, contextos,
formatação de data por região, fallback em cadeia. O que ele tem é um punhado de strings
que cabem no bundle.

**Decisão.** Catálogo em TypeScript, sem dependência. `en.ts` é a fonte da verdade e de
onde os tipos saem (`MessageKey = keyof typeof en`); qualquer outra língua é
`Record<MessageKey, string>`. `t(key, params)` interpola `{nome}` e escolhe plural por
`Intl.PluralRules`, com a chave base servindo de forma geral e `_one` de singular.

**Consequências.** **Chave que falta é erro de compilação**, não rótulo em branco numa
parede às duas da manhã — que é a única garantia que realmente importa numa ferramenta
de montagem. `Intl.PluralRules` significa que uma língua com mais formas que o inglês
precisa de mais chaves, não de mais código. Acrescentar uma língua é um arquivo novo e
três linhas em `index.svelte.ts` — foi assim que o espanhol entrou. O custo é que todo o
catálogo entra no bundle: com três línguas isso é ruído, e virar problema é sinal de que
chegou a hora de uma biblioteca de verdade.

Duas regras que sustentam isso: **o código continua em inglês** — identificadores,
comentários e mensagens de erro internas —, e a **engine não tem cópia de interface**.
Texto que o usuário lê é responsabilidade do editor, e é por isso que `t` lê
`i18n.locale` dentro de um rune: trocar de língua re-renderiza tudo sem store, sem
adaptador e sem recarregar a página.

**Verificação.** `npm run i18n` faz duas coisas, e roda dentro de `npm run verify`.
Reprova qualquer string fixa em `packages/editor` — texto no markup, `title`,
`aria-label`, `placeholder`, e literal acentuado em `.ts` **e no bloco `<script>` dos
`.svelte`**, que foi por onde uma mensagem de toast escapou na primeira versão do check.
E compara cada catálogo com o inglês procurando o que o compilador não enxerga: um
`{placeholder}` perdido na tradução, ou uma marcação `<b>` que sumiu numa chave
renderizada com `{@html}`. Os dois são silenciosos em produção e barulhentos na parede.

---

### ADR-0019 — Malha livre é uma camada, não mais uma forma

**Status:** aceita

**Contexto.** Uma superfície plana é bem descrita por quatro cantos e uma homografia. Uma
coluna, um arco ou uma parede abaulada não são: a homografia acerta o contorno e erra o
meio. O brief lista malha como fora da v1 **e** como ponto de extensão preparado — a
união `Shape` foi desenhada com isso em mente.

O caminho óbvio seria acrescentar `{ kind: 'mesh' }` a `Shape`. É também o caminho errado:
`Shape` é o **recorte**, e uma superfície deformada continua podendo ser recortada em
elipse ou em polígono. Como membro da união, "malha com máscara de elipse" viraria
irrepresentável.

**Decisão.** Três camadas ortogonais: `frame` (onde está, 4 cantos em pixels de saída),
`warp` (como entorta, opcional) e `shape` (o que fica aceso). `Surface.warp` é opcional,
então projeto salvo antes continua idêntico e não há migração.

**Consequências.** Máscara, recorte, encaixe e rotação operam sobre a coordenada do frame
**antes** da deformação — então todos atravessaram a malha sem uma linha de código novo,
e o conteúdo entorta com o recorte junto. É a evidência de que a camada foi posta no
lugar certo.

Dois pontos de controle merecem registro:

**Ponto de controle é posição, não coordenada de textura.** Você arrasta para levar aquele
pedaço da projeção até o objeto, e a textura acompanha a geometria. Eles vivem em espaço
do frame, então mexer no frame carrega a malha junto — a mesma regra que já valia para a
forma.

**Grade de controle não é a tesselação.** Poucas alças para arrastar, malha fina para
desenhar. Entre os pontos, `curvo` roda uma superfície Catmull-Rom e `reto` mantém o vinco.
`reto` nunca subdivide além da própria grade: cada célula já é exata sob a própria
homografia, e subdividi-la bilinearmente introduziria justamente o erro que o caminho
projetivo evita.

---

### ADR-0020 — Uma homografia por célula, e vértices não compartilhados

**Status:** aceita

**Contexto.** Com pontos movidos livremente não existe mais uma homografia única para a
superfície — e o brief proíbe em negrito "subdividir a malha para disfarçar o problema",
que é como a maioria das ferramentas resolve isso.

**Decisão.** Cada célula desenhada resolve a **própria** homografia e emite o próprio `w`
por vértice, o mesmo truque de `gl_Position` que já dava a correção de perspectiva no
quad. Vértices **não** são compartilhados entre células: um canto pertence a até quatro
delas e carrega um `w` diferente em cada.

**Consequências.** A textura fica projetivamente exata **dentro** de cada célula, e
contínua em posição entre elas — o que o AC-49 verifica varrendo uma linha de pixels
atrás de costura. Posição e `w` passam a ser calculados na CPU e chegam como atributo, o
que exigiu um segundo formato de vértice e um ramo no vertex shader.

**O caminho sem malha não foi tocado.** Dois VAOs, dois buffers, um `uniform` escolhendo o
ramo. Unificar seria mais bonito e colocaria em risco o AC-20, que é a garantia mais cara
do projeto. O preço é um pouco de duplicação; a compra é que a feature nova não pode
quebrar a antiga.

**Pendência resolvida junto.** Polígono era desenhado *como geometria*, e numa superfície
deformada a geometria passou a ser a malha. O recorte virou uma máscara rasterizada uma
vez num canvas 2D e amostrada pela coordenada do frame — só no caminho de malha, deixando
o caminho antigo intacto.

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

**Resolvido depois, por ADR-0015.** Editor e saída começaram com um `SourcePool` cada,
e o resultado foi decode dobrado e dois prompts de captura.

---

### ADR-0015 — Textura por contexto, fonte compartilhada

**Status:** aceita — refina ADR-0006

**Contexto.** Uma textura GL não atravessa janela, então a primeira versão deu à
janela de saída a sua própria `SourcePool`. O custo apareceu na prática: cada vídeo
decodificado duas vezes, e — pior — `getDisplayMedia` pedindo permissão de captura uma
segunda vez ao abrir a saída, no meio de uma demonstração.

O que não atravessa janela é a *textura*. O `<video>`, o `ImageDecoder` e o
`MediaStream` atravessam sem problema.

**Decisão.** Uma fonte, várias texturas. `ContextTextures` guarda um `WebGLTexture` por
contexto e a versão de conteúdo que cada contexto subiu pela última vez. O antigo
`isDirty` booleano virou um getter derivado disso, porque um flag único não sobrevive a
dois consumidores: quem subisse primeiro zeraria o flag e a outra janela ficaria com o
frame velho para sempre. `Engine` aceita um pool emprestado e, ao ser destruída, libera
só as texturas do seu contexto (`SourcePool.releaseContext`) em vez de matar as fontes.

**Consequências.** Um decode, um prompt de captura, e fechar a saída não interrompe
nada no editor. O módulo de canvas generativo ganhou um guard de tempo para desenhar
uma vez por frame e não uma vez por contexto, senão um sketch andaria em dobro. Coberto
por AC-29.

---

### ADR-0016 — Sem `requestVideoFrameCallback`, todo render é um frame novo

**Status:** aceita

**Contexto.** O upload de vídeo é guiado por `requestVideoFrameCallback`, que dispara
na taxa do vídeo e não na do monitor. Onde a API não existe — Firefox e Safari mais
antigo — o fallback marcava a textura como suja **uma única vez**, na construção.
Resultado: vídeo, GIF, captura e webcam congelavam no primeiro frame nesses
navegadores, silenciosamente, e só ali.

**Decisão.** O fallback não tenta imitar o callback. Enquanto o vídeo estiver tocando e
não houver rVFC, cada `update()` invalida a textura — todo render vira um frame novo.

**Consequências.** Correto em todo navegador, ao custo de subir a textura na taxa do
monitor onde a API falta. É desperdício conhecido e medido em uma linha, contra um
congelamento invisível. A verificação nesses navegadores é manual (AC-30), porque o
smoke roda em chromium, que tem a API.

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
