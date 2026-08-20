# 0002 — Quatro arestas do editor

Quatro tarefas do backlog, sem tema comum além de serem atrito diário. Reunidas
numa branch porque nenhuma delas justifica uma sozinha, e porque três tocam
`Overlay.svelte` ou a vizinhança dele.

Ordem de execução: A (a única de tamanho `M` real), depois B, C, D.

---

## A — Persistir o handle da pasta entre sessões

**O problema.** O brief diz "abrir usa `showDirectoryPicker()` e guarda o
handle". Hoje `dir` é uma variável de módulo: toda abertura do app exige
re-selecionar a pasta pelo diálogo do sistema antes de qualquer coisa aparecer.
Numa montagem, isso é atrito no pior momento — e contradiz a frase que o produto
usa para se vender, "seus projetos são pastas suas".

**O que não dá para prometer.** Um `FileSystemDirectoryHandle` é serializável e
sobrevive em IndexedDB (verificado: IndexedDB funciona e persiste em `file://`,
que é a distribuição principal). A **permissão** é que não sobrevive sozinha:
na volta, `queryPermission` responde `granted` só quando o usuário concedeu
acesso persistente; o normal é `prompt`. E `requestPermission` sem gesto do
usuário é rejeitado pelo navegador, de propósito.

Então a promessa honesta não é "abre sozinho sempre". É: **um clique em vez de
navegar o diálogo do sistema**, e nenhum quando a permissão é persistente.

**Desenho.**

- `packages/editor/handle-store.ts` — IndexedDB cru, sem dependência, três
  funções: `rememberFolder`, `recallFolder`, `forgetFolder`. Um banco, um store,
  uma chave.
- `project-folder.ts` ganha `restoreFolder()`, que devolve um de três estados:
  `null` (nada guardado), `{ state: 'granted', json }` (adotou a pasta) ou
  `{ state: 'prompt', name }` (tem handle, falta permissão).
- `grantFolder()` — chamada de dentro de um clique, faz `requestPermission` e
  adota.
- Handle morto (pasta apagada, movida, pendrive fora) → `forgetFolder`, e o app
  cai no caminho de hoje sem ruído.

**Invariante.** Restaurar só acontece na partida, com projeto vazio. Um handle
recuperado nunca pode sobrescrever trabalho já em memória.

### Critérios

- **AC-56** — Abrir uma pasta guarda o handle; a sessão seguinte o encontra sem
  passar pelo seletor de arquivos.
- **AC-57** — Permissão em `prompt` não é escalada sozinha: o app espera um
  clique, e o pedido acontece dentro dele.
- **AC-58** — Handle que não resolve mais (pasta apagada ou dispositivo ausente)
  é esquecido, e a partida segue como se não houvesse nada guardado.

---

## B — Editar pontos de um polígono já traçado, e acertar o hit-test

**Já está feito, e o backlog é que ficou para trás.** `Overlay.svelte` desenha
alça em cada vértice e chama `store.setPolygonPoint`; `surfaceAt` já testa
`pointInPolygon` e `pointInUnitEllipse` antes de aceitar o clique. As duas
metades foram fechadas durante a revisão sênior e a tarefa nunca foi marcada.

O trabalho aqui é **verificar e travar**: provar as duas na interface real e
deixar critério para a regressão não passar em silêncio, já que hoje nenhum
teste cobre o hit-test do polígono fora do unitário.

### Critérios

- **AC-59** — Clique no canto vazio da bbox de um polígono não seleciona a
  superfície; clique dentro do polígono seleciona.
- **AC-60** — Arrastar o vértice de um polígono traçado move aquele vértice, e
  um arrasto inteiro é um só desfazer.

---

## C — Contraste do guia de malha sobre conteúdo claro

**O problema.** As linhas e os pontos da malha são violeta a 40%. Sobre conteúdo
escuro leem bem; sobre uma imagem clara quase somem — e é justamente sobre a
imagem que se julga o alinhamento.

**A abordagem que o backlog sugeria e por que ela perde.** "Medir a luminância
sob o ponto e inverter" custa `readPixels`, que é uma parada sincronizada da GPU.
Fazer isso por ponto e por frame briga com o loop de render, que é a coisa que
este projeto mais protege.

**O que fazer em vez disso:** contorno escuro sob o traço claro — a técnica que
a cartografia usa para estrada sobre qualquer fundo. Custo: um `<path>` a mais
por linha de guia. Nenhuma leitura de GPU, nenhum frame perdido, e funciona
sobre branco e sobre preto pelo mesmo motivo.

### Critérios

- **AC-61** — A linha de guia da malha permanece distinguível do fundo tanto
  sobre conteúdo branco quanto sobre conteúdo preto.

---

## D — Numerar as linhas da lista de superfícies

**O problema.** O padrão "número" projeta a posição na ordem z decrescente, mas
a lista mostra só nomes. Uma superfície chamada "Superfície 2" pode aparecer
projetada como "1" — e a pessoa está numa escada tentando descobrir em qual
mexer.

**Desenho.** A lista usa `surfaceOrder` do engine, a mesma função que o renderer
usa para desenhar o glifo. Não recalcular a ordenação na interface: número que
diverge do projetado é pior do que número nenhum.

### Critérios

- **AC-62** — O número na lista é o mesmo que o padrão "número" projeta, e
  acompanha uma mudança de ordem.
