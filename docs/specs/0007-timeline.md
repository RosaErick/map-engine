# 0007 — Cenas e timeline

**Esta feature estava explicitamente fora de escopo.** O brief lista "timeline e
cues" entre o que não fazer na v1, e `DIFERENCIAIS.md` registrava a decisão de
não perseguir: *"vira Millumin, e o Millumin já existe"*. A decisão foi
revertida de propósito. Este documento existe para que a reversão seja uma
escolha registrada, e para desenhar a feature de um jeito que **não** vire um
editor de vídeo.

---

## O que um mapeamento precisa de uma timeline, e o que não precisa

Numa instalação, o que muda com o tempo é **o que está tocando**. O que nunca
muda é **onde as coisas estão**: o alinhamento custou horas em cima de uma
escada, e é físico.

Daí a regra que decide o modelo inteiro:

> **Uma cena guarda apresentação, nunca geometria.**

`sourceId`, `opacity`, `visible` entram. `frame`, `shape`, `warp`, `crop`,
`rotation`, `fit`, `blend` e `z` **não**. Rodar o show não pode, por construção,
mexer no alinhamento de ninguém — e o efeito colateral é que **dá para corrigir
alinhamento com o show rodando**, que é uma necessidade real de galpão.

`blend` e `z` ficaram de fora por outra razão: são como a superfície foi
**construída**, não o que ela está mostrando. Animar os dois traz surpresa
combinatória e paga pouco.

## O modelo

```ts
interface Cue     { sourceId: string | null; opacity: number; visible: boolean }
interface Scene   { id; name; cues: Record<SurfaceId, Cue>; hold: number; fade: number }
interface Timeline { scenes: Scene[]; loop: boolean }

Project.timeline?: Timeline    // opcional: projeto sem show continua byte a byte idêntico
```

`hold` é quanto a cena segura depois da transição. **`hold: 0` significa esperar
o GO** — nunca avança sozinha. `fade` é a transição de entrada, em segundos.

## Tocar não pode escrever no projeto

Este é o ponto técnico que decide tudo o resto.

Se o playhead escrevesse `opacity` nas superfícies, cada frame passaria por
`Store.mutate` — que clona o projeto inteiro e empilha histórico. Sessenta vezes
por segundo. O desfazer viraria lixo, o autosave escreveria no disco a noite
toda, e a instalação morreria de escrita.

**A timeline é uma projeção de leitura, não uma mutação.** O mesmo lugar por onde
solo e padrão de teste já passam:

```ts
visibleSurfaces(state)                  // já sobrepõe solo e visibilidade
presentationOf(state, surface): Cue     // novo: sobrepõe a cena corrente
```

`renderer.render()` já recebe a lista de superfícies pronta e já recebe
`patternFor` **como função**. A apresentação entra pela mesma porta, como
`presentationFor`.

### Por que função, e não superfícies clonadas

O renderer guarda a geometria derivada num `WeakMap<Surface, …>`, com a
identidade do objeto servindo de chave — é o que fez o trabalho de JS por frame
cair de 0,3 ms para 0,1 ms com 30 superfícies.

Clonar superfícies a cada frame para injetar a opacidade da cena **furaria esse
cache em todos os frames** e recalcularia homografia e triangulação de tudo,
desfazendo exatamente aquela otimização. Por isso a apresentação chega como
função e as superfícies chegam com a identidade intacta. O AC-92 tranca isso.

### O relógio

`ViewState.playback = { sceneIndex, since, playing }`, com `since` em
`Date.now()` — **não** `performance.now()`, porque o editor e a janela de saída
são duas janelas com origens de tempo diferentes, e as duas leem o mesmo store.

Guardar o instante de início em vez do tempo decorrido é o que faz tocar não
custar nenhuma escrita: o tempo decorrido é calculado na hora de desenhar. Uma
escrita por cena, não sessenta por segundo.

O laço de render dorme quando nada muda. Ele acorda **enquanto há transição**,
não enquanto há timeline: uma cena parada com conteúdo parado não tem por que
segurar a GPU.

## A transição

Em `fade` segundos, a superfície escurece até o preto na primeira metade — ainda
mostrando o conteúdo velho — e volta ao alvo na segunda, já com o novo. `fade: 0`
é corte seco.

**Não é um crossfade de verdade**, e isso é deliberado: um crossfade real exige
duas texturas por superfície, o que é uma mudança de renderer grande. Quem quiser
um: duas superfícies empilhadas na mesma geometria, com as opacidades cruzadas
pela cena. O primitivo compõe, e o custo fica com quem precisa.

## Quem manda no visual

Com uma timeline ativa, a apresentação da cena ganha do que está no projeto. Um
controle de opacidade no inspetor que não faz nada é pior do que um controle
desabilitado.

**Mexer na apresentação de uma superfície ejeta a timeline** — o idioma de "pegar
o controle na mão" que qualquer mesa de luz tem — e avisa na tela. Mexer na
**geometria** não ejeta nada: corrigir alinhamento com o show rodando é a razão
pela qual cena não guarda geometria.

## Capturar

"Capturar cena" tira uma foto da apresentação **do projeto** — o que foi montado
à mão —, nunca do que a timeline está mostrando no momento. Capturar no meio de
uma transição guardaria um estado intermediário que ninguém pediu.

Uma superfície criada depois da captura não aparece nas cues daquela cena. Ela
mantém a própria apresentação em vez de sumir: cena é uma sobreposição, não um
estado completo do mundo.

## Interface

Uma barra no rodapé do palco, **recolhida por padrão** — quem não usa timeline
não paga espaço nenhum por ela.

- Transporte: tocar, parar, laço, e ejetar.
- As cenas como blocos, com largura proporcional a `fade + hold`; cena de `hold: 0`
  ganha largura mínima e uma marca de **GO**.
- Um playhead atravessando o bloco corrente.
- Clicar num bloco estaciona nele; duplo clique renomeia; arrastar reordena.
- O bloco selecionado abre `fade` e `hold` na própria barra.
- Escondendo a interface (`H`), ela some junto com o resto.

## Critérios

- **AC-84** — Uma cena guarda apresentação e nunca geometria: capturar, mover uma
  superfície e voltar à cena deixa a superfície onde ela foi movida.
- **AC-85** — Tocar não escreve no projeto: nem entrada de desfazer, nem
  alteração no JSON salvo.
- **AC-86** — A transição escurece até o preto e troca o conteúdo no fundo dela;
  `fade: 0` corta seco.
- **AC-87** — `hold: 0` espera o GO em vez de avançar sozinha.
- **AC-88** — Com laço, a última cena volta para a primeira.
- **AC-89** — A timeline sobrevive a salvar e recarregar, e projeto sem timeline
  continua byte a byte idêntico.
- **AC-90** — Superfície criada depois da cena mantém a própria apresentação em
  vez de sumir.
- **AC-91** — Mexer na apresentação ejeta a timeline; mexer na geometria não.
- **AC-92** — Com a timeline tocando, as superfícies entregues ao renderer são
  **os mesmos objetos** do projeto: a apresentação é função, não cópia, e o cache
  de geometria por identidade continua valendo.
