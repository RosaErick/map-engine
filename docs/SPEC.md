# Spec — critérios de aceite

Contrato do que a ferramenta garante hoje. Cada critério é **falsificável**: dá para
descrever a execução que o quebra. Cada um está ligado a pelo menos um teste pelo id
no nome do teste (`AC-7: ...`), então a ligação é greppável dos dois lados e não
depende de nenhuma ferramenta.

```
brief (por quê + o quê)  →  critérios (falsificáveis)  →  testes (executáveis)  →  código
```

O brief original está em [`prompt-mapping-engine.md`](../prompt-mapping-engine.md) e
continua sendo a fonte da intenção. Este arquivo é a fonte do que está **provado**.

**Ids são permanentes.** Um critério que sai vira `~~AC-n~~ substituído por AC-m`;
renumerar quebra silenciosamente toda a ligação com os testes.

Como rodar a prova:

```bash
npm test              # 127 testes de unidade (node:test, sem framework)
npm run layers        # reprova import na direção errada entre as camadas
npm run build         # gera dist/index.html autocontido
npm run smoke         # chromium headless abre o build por file:// e lê pixels
```

---

## 1. Matemática — homografia e geometria

Seam: `packages/engine/math/homography.ts`, `packages/engine/math/geometry.ts` (funções puras).

### AC-1 — O frame define a projeção

**Dado** um quadrilátero de 4 cantos em pixels de saída
**Quando** a homografia do quadrado unitário para esse quadrilátero é resolvida
**Então** os cantos `(0,0) (1,0) (1,1) (0,1)` caem exatamente sobre TL, TR, BR, BL

### AC-2 — Ida e volta sem perda

**Dado** qualquer ponto do espaço do frame
**Quando** ele passa pela homografia e depois pela inversa
**Então** volta ao ponto de origem com erro abaixo de `1e-9`

> É o critério que sustenta traçar polígono livre na tela e hit-testing: os dois
> convertem pixels de volta para o espaço do frame.

### AC-3 — Frame degenerado não vira NaN

**Dado** um frame com cantos coincidentes ou colineares
**Quando** a homografia é resolvida
**Então** o resultado é ausência de transformação, e nada é desenhado

> Um NaN chegando no renderer apaga a parede no meio da montagem. Falhar aqui é
> obrigatório e explícito.

### AC-4 — Polígono livre vira triângulos

**Dado** um polígono simples de n pontos, convexo ou côncavo
**Quando** ele é triangulado
**Então** saem n-2 triângulos, e nenhum deles cobre área fora do polígono

### AC-35 — O ímã gruda na aresta, não só no canto

**Dado** um ponto arrastado perto da aresta de outra superfície
**Quando** o ponto mais próximo daquele segmento é calculado
**Então** ele é o pé da perpendicular quando cai dentro do segmento, e a ponta
mais próxima quando passa dela; e uma aresta degenerada (dois cantos no mesmo
lugar) devolve aquele ponto em vez de dividir por zero.

### AC-36 — Elipse é elipse, não a caixa dela

**Dado** um ponto no espaço do frame
**Quando** ele é testado contra a elipse inscrita
**Então** o centro e os meios das arestas estão dentro, e os quatro cantos do
quadrado unitário estão fora.

> É o que faz clicar no canto vazio de uma superfície elíptica **não** selecionar
> o que não está aceso ali.

### AC-5 — Hit test e bounds

**Dado** um polígono e um ponto
**Quando** o ponto é testado
**Então** a resposta diz se ele está dentro; e os bounds de um conjunto de pontos
envolvem todos eles

---

## 2. Conteúdo dentro da forma

Seam: `uvTransform` em `packages/engine/render/renderer.ts` (função pura, sem GL).

### AC-6 — Encaixe respeita a proporção

**Dado** uma fonte com proporção diferente da superfície
**Quando** o encaixe é `stretch`, `contain` ou `cover`
**Então**
- `stretch` amostra a janela de crop inteira;
- `cover` estreita a janela no eixo longo, centrada, e o conteúdo preenche a forma;
- `contain` alarga a janela além da imagem, centrada, e a sobra vira preto real
  (descartada no shader, não borda esticada);
- em todos os casos a janela de `crop` do usuário continua sendo respeitada.

### AC-28 — Rotação do conteúdo dentro da forma

**Dado** uma superfície com conteúdo
**Quando** a rotação é ajustada
**Então**
- o conteúdo gira em torno do **centro** do frame, e o centro é ponto fixo;
- a rotação é em graus no sentido horário, e uma volta completa devolve cada
  amostra exatamente ao ponto de partida;
- o que sair da fonte por causa do giro vira preto real, descartado no shader;
- um quarto de volta troca a proporção usada por `contain` e `cover`, para que um
  vídeo deitado continue encaixando;
- o **frame não se mexe** — girar conteúdo é seguro numa superfície travada, porque
  não toca no alinhamento com o objeto físico.

> Giros de 30° não trocam a proporção: um retângulo girado 37° não tem proporção
> única, e a rotação livre existe para corrigir projetor torto, não para reenquadrar.

---

## 3. Estado, histórico e travas

Seam: `Store` em `packages/engine/model/store.ts`. Toda mutação passa por métodos daqui —
é isso que torna uma ponte OSC futura um adaptador puro.

### AC-7 — Desfazer e refazer

**Dado** uma superfície com um canto movido
**Quando** desfazer é acionado
**Então** o canto volta ao valor anterior; e refazer o traz de volta

### AC-8 — Um arrasto é uma entrada de histórico

**Dado** um arrasto de canto que dispara dezenas de mutações
**Quando** o gesto termina e desfazer é acionado uma vez
**Então** o canto volta ao valor de antes do gesto inteiro

> Sem isso, `Ctrl+Z` anda um pixel por vez e o histórico é inútil.

### AC-9 — Trava é trava

**Dado** uma superfície travada
**Quando** qualquer edição de geometria é tentada (arrastar canto, mover, setas,
definir frame)
**Então** nada muda

> Esbarrar num canto já alinhado é o acidente mais caro da montagem.

### AC-10 — Contrato de store

**Dado** um assinante
**Quando** ele se inscreve
**Então** é chamado imediatamente com o estado atual, a cada mudança depois disso,
e nunca mais depois de cancelar

> Essa assinatura **é** o contrato de store do Svelte. É a única costura entre a
> engine e o editor.

### AC-11 — Solo, mudo e ordem

**Dado** superfícies com `z` diferentes
**Quando** o desenho é montado
**Então** elas saem ordenadas por `z`; uma superfície muda não sai; e com solo ativo
só a superfície em solo sai, mesmo que outras estejam visíveis

### AC-12 — Remover fonte não deixa referência solta

**Dado** superfícies apontando para uma fonte
**Quando** a fonte é removida
**Então** essas superfícies ficam sem fonte, e portanto apagadas

### AC-13 — Projeto sobrevive ao disco

**Dado** um projeto salvo em JSON
**Quando** ele é recarregado
**Então** volta idêntico; e uma referência de fonte que não existe mais é derrubada
na leitura, em vez de chegar ao renderer

### AC-37 — Recorte sempre amostra alguma coisa

**Dado** um recorte com largura ou altura zero, negativa ou acima de 1
**Quando** ele é gravado ou carregado de um arquivo
**Então** ele é trazido para dentro de 0..1 com um mínimo que ainda amostra
pixels — uma janela vazia apagaria a superfície por um motivo invisível no arquivo.

### AC-38 — Vértice de polígono obedece à trava

**Dado** um polígono traçado
**Quando** um vértice é movido
**Então** ele se move no espaço do frame; e numa superfície travada não se move,
pela mesma razão que um canto não se move — a forma é o que está em cima do
objeto físico.

### AC-40 — A porta genérica tem as mesmas travas das nomeadas

**Dado** um patch com opacidade 5, rotação 450°, recorte inválido, encaixe
inexistente, mistura inexistente, nome em branco e `z` não numérico
**Quando** ele é aplicado pelo caminho genérico
**Então** o resultado é indistinguível do que os métodos nomeados produziriam:
opacidade em 0..1, ângulo normalizado, recorte que amostra algo, encaixe e
mistura recusados, nome preservado, `z` finito.

> Uma regra que depende de qual método o chamador escolheu não é uma regra. E o
> consumidor previsto do caminho genérico é a ponte de controle externo.

### AC-41 — Id repetido é resolvido na leitura, não carregado adiante

**Dado** um `project.json` com duas fontes de mesmo id e duas superfícies de
mesmo id
**Quando** ele é carregado
**Então** sobra uma fonte — a que as superfícies já referenciam — e as duas
superfícies sobrevivem com ids que as endereçam separadamente, de modo que apagar
uma não apague a outra.

---

## 3c. O projeto em disco

Seam: `createSaver` e `safeName` em `packages/editor/platform/saver.ts`.

### AC-42 — O autosave não perde estado nem trava

**Dado** mudanças em sequência
**Quando** o período de silêncio passa
**Então** acontece **uma** escrita, com o conteúdo do momento em que ela roda; e
se outra escrita já estiver em voo, exatamente uma passada extra é enfileirada,
carregando o estado mais novo — não duas, e nenhuma perdida. Uma escrita que
falha é reportada e **não trava** o autosave: a próxima funciona.

### AC-43 — Nome de arquivo solto não escapa da pasta

**Dado** um arquivo arrastado com nome hostil
**Quando** ele é copiado para a pasta do projeto
**Então** só o nome-base é usado, sem separador de caminho, sem ponto inicial e
nunca vazio.

---

## 3b. Uma fonte, duas janelas

Seam: `ContextTextures` em `packages/engine/sources/types.ts` e `SourcePool`.

### AC-29 — Um decode, várias telas

**Dado** uma fonte alimentando o editor e a janela de saída ao mesmo tempo
**Quando** o conteúdo muda
**Então**
- cada contexto GL recebe a sua própria textura, porque textura não atravessa janela;
- subir a textura numa janela **não** marca a outra como atualizada — as duas veem
  o frame novo;
- fechar uma das janelas libera só as texturas daquela janela: a fonte continua viva,
  o vídeo não recomeça e a captura de tela **não pede permissão de novo**;
- uma fonte que ninguém desenhou ainda conta como pendente.

> A regra do brief é cache por fonte, não por superfície. Duas janelas mostraram que
> ela também não pode ser por janela.

---

## 3d. Malha livre

Seam: `packages/engine/model/warp.ts` e o caminho de malha do renderer.

### AC-44 — Ter malha não muda nada até alguém usar

**Dado** uma superfície com malha na grade identidade
**Quando** ela é desenhada
**Então** a parede recebe a mesma coisa que receberia sem malha nenhuma — mesmo
sendo outro caminho de código, outro ramo de shader e outro formato de vértice.
E um projeto sem malha salva sem a chave, byte a byte como antes.

### AC-46 — A trava vale para a malha

**Dado** uma superfície travada com malha
**Quando** qualquer edição de malha é tentada — mover ponto, trocar a grade,
aplanar, remover
**Então** nada muda. A malha é o que está em cima do objeto físico, pela mesma
razão que o canto é.

### AC-47 — Trocar a subdivisão não joga trabalho fora

**Dado** uma malha já ajustada
**Quando** a grade de controle muda de tamanho
**Então** os pontos novos são lidos da superfície atual, e a forma continua a
mesma dentro de uma tolerância pequena. Sobrevive a salvar e reabrir.

### AC-48 — Aplanar volta exatamente à identidade

**Dado** uma malha deformada
**Quando** ela é aplanada
**Então** volta à grade regular exata; e reamostrar uma grade identidade continua
identidade — o que só é verdade porque a spline extrapola nas bordas em vez de
repetir o ponto.

### AC-49 — Correção projetiva por célula, sem costura

**Dado** uma malha, identidade ou deformada
**Quando** ela é desenhada
**Então** cada célula carrega a própria homografia e o próprio `w`, e uma
varredura horizontal pelo meio da superfície encontra **um único trecho aceso** —
sem linha escura entre células, que numa ferramenta onde preto é transparência
seria uma faixa de parede aparecendo no meio do conteúdo.

### AC-50 — Curvo e reto são escolhas, não acidentes

**Dado** os mesmos pontos de controle
**Quando** a interpolação é `curvo` ou `reto`
**Então** os dois passam exatamente pelos pontos de controle, e divergem entre
eles: um descreve superfície contínua, o outro vinco duro.

### AC-51 — Malha corrompida é consertada ponto a ponto

**Dado** um `project.json` com grade absurda, ponto faltando, coordenada não
numérica ou lixo no lugar de um ponto
**Quando** ele é carregado
**Então** cada ponto válido é preservado e cada ponto quebrado cai na identidade;
grade e coordenadas são contidas em faixas sãs. Nenhum NaN chega ao renderer.

### AC-52 — A máscara atravessa a deformação

**Dado** uma superfície deformada com recorte de elipse ou polígono
**Quando** ela é desenhada
**Então** o recorte continua valendo e entorta junto com o conteúdo — porque
máscara, recorte e encaixe operam na coordenada do frame **antes** da malha.

### AC-53 — O clique atravessa a deformação

**Dado** uma superfície deformada
**Quando** um ponto da tela é convertido para o espaço do frame
**Então** a malha é desfeita além da perspectiva, e um ponto fora da superfície
deformada é reportado como erro de clique, não chutado.

### AC-54 — Um arrasto de malha é um desfazer

**Dado** um ponto de controle arrastado com atração de vizinhos
**Quando** o gesto termina
**Então** os vizinhos acompanharam com peso que cai com a distância, os pontos
distantes ficaram parados, e **um** desfazer devolve tudo.

---

## 4. Saída — o que a parede recebe

Seam: o build real (`dist/index.html`) rodando em chromium headless, com leitura de
pixels via `gl.readPixels`. Provado por [`scripts/smoke.mjs`](../scripts/smoke.mjs).

### AC-14 — Abre sem servidor, console limpo

**Dado** o build de arquivo único
**Quando** ele é aberto por `file://`, sem servidor e sem rede
**Então** a engine monta, nenhum erro aparece no console, e o HTML não referencia
nada fora de si além dos arquivos opcionais de instalação como aplicativo

### AC-31 — A instalação como aplicativo não serve app velho

**Dado** um build publicado
**Quando** o service worker é gerado
**Então** a versão do cache é derivada do hash do HTML construído

> Service worker só atualiza quando os próprios bytes mudam. Versão constante é o
> jeito clássico de servir o app do mês passado para sempre.

### AC-15 — Preto é transparente

**Dado** qualquer projeto
**Quando** um frame é renderizado
**Então** todo pixel fora das superfícies mapeadas é `#000000` absoluto —
sem cinza, sem gradiente, sem vinheta, sem borda

### AC-16 — Sem fonte, sem luz

**Dado** uma superfície sem fonte atribuída, ou com fonte que não carregou
**Quando** ela é renderizada
**Então** nenhum pixel dela acende sobre o objeto físico

> Fonte que falhou é caso à parte: aparece o padrão de mídia faltando, magenta e
> impossível de confundir com conteúdo. Nunca falha em silêncio.

### AC-17 — Conteúdo acende a forma

**Dado** uma superfície com fonte de cor branca
**Quando** ela é renderizada
**Então** o interior da forma fica branco

### AC-18 — Máscara de elipse

**Dado** uma superfície com forma de elipse
**Quando** ela é renderizada
**Então** os cantos do frame ficam apagados e o centro continua aceso

### AC-19 — Padrões de teste chegam na saída

**Dado** um padrão de teste ativo
**Quando** um frame é renderizado
**Então** o padrão aparece dentro das superfícies, e só dentro delas

### AC-32 — Padrão por superfície

**Dado** um padrão global e uma superfície com padrão próprio
**Quando** um frame é renderizado
**Então**
- a superfície com padrão próprio desenha o dela, e as outras seguem o global;
- um `'none'` próprio apaga o padrão só naquela superfície, mesmo com o global ligado;
- devolver o controle ao global restaura o comportamento anterior;
- apagar a superfície descarta o padrão próprio dela.

> Alinhar é uma superfície por vez: grade numa, número em outra, nada nas demais. O
> global continua existindo porque "grade em tudo" é o caso mais comum.

### AC-39 — Fonte que chega tarde acende sozinha

**Dado** um projeto parado, sem nada animado e sem nenhuma mutação pendente
**Quando** uma imagem termina de decodificar depois que o loop de render dormiu
**Então** ela aparece na parede sem nenhuma ação do usuário.

> O loop dorme de propósito. A textura chegando é uma das três razões para
> desenhar um frame, ao lado de "o estado mudou" e "existe fonte animada".

### AC-20 — UV com correção de perspectiva

**Dado** um quadrilátero fortemente deformado em perspectiva e um padrão com bordas retas
**Quando** ele é renderizado
**Então** as bordas continuam retas na saída, com desvio máximo de **1,5 px** em
relação à reta ajustada

> Esta é a armadilha número um do brief. Interpolação linear de UV produz uma dobra
> diagonal no meio da textura, exatamente onde os dois triângulos se encontram.
> Medição atual: **0,50 px** de desvio máximo em 414 amostras.

---

## 4b. Idioma

Seam: `packages/editor/i18n/` e `scripts/check-i18n.mjs`.

### AC-33 — A interface fala a língua de quem abriu

**Dado** um navegador configurado em português, espanhol ou inglês
**Quando** o editor é aberto
**Então**
- a interface inteira aparece nessa língua, incluindo o "sobre";
- `pt-BR`, `pt-PT` e `pt` caem todos em português, e o mesmo vale para as variantes
  de espanhol e inglês;
- uma língua que não temos cai no inglês, que é o catálogo base;
- trocar de idioma no seletor re-renderiza tudo sem recarregar a página, atualiza
  `<html lang>` e é lembrado na próxima abertura;
- nenhuma string do editor está fixa no código, e nenhuma tradução perdeu um
  `{placeholder}` ou uma marcação `<b>` do inglês.

> Chave que falta é erro de compilação, não rótulo em branco. O resto é `npm run i18n`.

### AC-34 — O guia não perde conteúdo na tradução

**Dado** o guia de uso em português, espanhol e inglês
**Quando** as três versões são comparadas
**Então** têm as mesmas seções, na mesma ordem, com os mesmos blocos e a mesma
contagem de passos, itens e linhas de atalho; os títulos estão traduzidos; e os
exemplos de código são idênticos, porque código não se traduz.

> Um guia traduzido que perde um passo em silêncio é pior do que um que falta
> inteiro: ninguém percebe até precisar daquele passo.

### AC-56 — A pasta volta na sessão seguinte

**Dado** uma pasta de projeto aberta numa sessão anterior
**Quando** o app é aberto de novo
**Então** o handle guardado é encontrado, e com permissão persistente a pasta é
readotada com o projeto já lido — sem passar pelo seletor de arquivos.

> O que se prova automaticamente é a camada de baixo: que `file://`, uma origem
> opaca, guarda e devolve o valor. Um handle de verdade só sai de um diálogo do
> sistema operacional, que nenhum teste consegue operar.

### AC-57 — Permissão pendente não é escalada sozinha

**Dado** um handle guardado cuja permissão não sobreviveu à sessão
**Quando** o app parte
**Então** nada é pedido: o nome da pasta vira um botão, e o pedido acontece
dentro do clique. Permissão negada não vira botão nenhum.

> Pedir permissão fora de um gesto do usuário é rejeitado pelo navegador de
> propósito. E insistir com um botão numa pasta que a pessoa já recusou é a
> versão de interface da mesma falta de educação.

### AC-58 — Handle morto é esquecido

**Dado** um handle cuja pasta foi apagada, movida, ou está num dispositivo
ausente
**Quando** o app tenta readotá-la
**Então** o handle é descartado e a partida segue como se não houvesse nada
guardado — nunca uma pasta meio adotada que falha a cada salvamento.

### AC-59 — O clique respeita a forma, não a caixa dela

**Dado** um polígono que ocupa uma fração da própria caixa
**Quando** o ponteiro cai num canto vazio dessa caixa
**Então** a superfície não é selecionada; dentro do polígono, é.

> A área que responde ao ponteiro é a silhueta. O contorno do frame continua
> desenhado como frame — ele é o guia de alinhamento —, mas deixou de ser o que
> captura o clique.

### AC-60 — Vértice de polígono se edita depois de traçado

**Dado** um polígono já fechado
**Quando** um vértice é arrastado
**Então** aquele vértice se move, e o arrasto inteiro é um só desfazer.

### AC-61 — O guia da malha sobrevive ao conteúdo

**Dado** o guia da malha desenhado sobre conteúdo branco e sobre conteúdo preto
**Quando** o contraste é medido no elemento renderizado, com o CSS aplicado
**Então** a razão de contraste é de pelo menos 2 nos dois casos.

> Medido, não olhado: o desenho anterior — violeta a 40%, sem contorno — dava
> 1,38 sobre branco, que é o motivo de ele sumir justamente sobre a imagem em
> que se julga o alinhamento.

### AC-62 — O número da lista é o número projetado

**Dado** superfícies em qualquer ordem de empilhamento
**Quando** a lista é lida ao lado do padrão "número"
**Então** os dois dizem o mesmo, e uma mudança de ordem move os dois juntos.

> A lista chama `surfaceOrder`, a mesma função que o renderer usa para escolher
> o glifo. Recalcular a ordenação na interface é como os dois divergem.

### AC-63 — O nome de uma fonte de cor é a cor dela

**Dado** uma fonte de cor
**Quando** a cor muda
**Então** o nome muda junto, e um nome escrito à mão sobrevive à troca.

> Toda fonte nascia "branco" e continuava assim: cinco fontes "branco" de cores
> diferentes é o que sobra de uma sessão de calibração. Preto quase puro não vira
> um matiz de ruído — o último bit de um canal daria um matiz qualquer, e chamar
> isso de "verde" seria pior do que não nomear.

### AC-64 — O seletor devolve a cor escolhida

**Dado** um hex digitado no seletor
**Quando** a superfície é desenhada
**Então** o pixel aceso é exatamente aquele valor, e hex inválido é recusado em
vez de virar preto no meio da digitação.

### AC-65 — Várias se escolhem e se movem juntas

**Dado** um laço no vazio, ou Shift + clique
**Quando** uma das escolhidas é arrastada
**Então** todas andam o mesmo tanto, quem ficou de fora não se mexe, e o arrasto
inteiro volta num **só** desfazer.

> Um por superfície transformaria "desfazer o que acabei de fazer" em apertar
> Ctrl+Z tantas vezes quantas superfícies havia — sem saber quantas eram.

### AC-66 — O âncora é o último escolhido

**Dado** uma seleção de várias
**Quando** o painel e as setas de canto operam
**Então** operam a última superfície escolhida — e continua sendo ela mesmo
quando um vínculo trouxe outras junto.

> Editar vale para uma, mover vale para todas. Quem clica numa superfície espera
> ver aquela no painel, não uma irmã que o vínculo arrastou.

### AC-67 — Vínculo é do projeto, seleção é do momento

**Dado** superfícies ligadas
**Quando** uma é escolhida, movida, salva e recarregada
**Então** o grupo inteiro vem junto nas três, e projeto sem vínculo continua sem
a chave no JSON.

### AC-68 — Travar fala sobre uma superfície, não sobre o grupo

**Dado** uma seleção com uma superfície travada
**Quando** o grupo se move
**Então** as destravadas andam e a travada fica onde está.

### AC-69 — A seleção não guarda id órfão

**Dado** uma superfície selecionada
**Quando** ela é apagada, ou um id inexistente é oferecido
**Então** a seleção fica só com o que existe, sem repetido.

### AC-70 — A vista não perde a saída

**Dado** qualquer sequência de rolagem e arrasto
**Quando** a área de trabalho para
**Então** a saída continua alcançável na tela.

> Medido: sem o limite, a mesma sequência deixa **zero** pixel da saída visível —
> e aí a roda do mouse amplia o vazio, sem nada na tela para orientar a volta.

### AC-71 — Ctrl reenquadra sem mover nada

**Dado** o ponteiro sobre uma superfície
**Quando** Ctrl é segurado e o ponteiro arrasta
**Então** a vista se move e a superfície fica onde está.

> Ctrl segurado durante um arrasto de **canto** continua desligando o ímã: a
> passagem vale só para o corpo da superfície, que é gesto grosso, nunca para a
> alça de 1 px.

### AC-72 — O seletor de cor não empurra a página

**Dado** o seletor de cor aberto
**Quando** a página é medida
**Então** a altura dela não mudou, o painel cabe inteiro na tela, e ele fecha por
**Esc**, por clique fora e pelo botão.

> Aberto dentro da lista, o seletor empurrava o painel para baixo e obrigava a
> rolar até achá-lo — escondendo justamente a parede, que é o que se olha
> enquanto se escolhe uma cor. Três saídas porque a primeira que a pessoa tenta
> varia, e nenhuma delas pode não funcionar.

### AC-73 — As dependências apontam para baixo

**Dado** a estrutura de pastas de `packages/`
**Quando** os `import` são lidos
**Então** nada em `engine/math/` importa do modelo, do renderer ou das fontes;
nada em `engine/model/` importa do renderer; nada em `editor/ui/` conhece o
estado ou o domínio; e a engine não importa nada do editor.

> Uma estrutura de pastas sem guarda volta ao estado anterior em poucas semanas,
> um `import` de cada vez. `npm run layers` torna a regra executável, e as
> mensagens dizem **por que** a direção existe, não só que ela foi violada.

### AC-74 — Texto acende só os glifos

**Dado** uma superfície com uma fonte de texto
**Quando** ela é desenhada
**Então** só os glifos acendem: o fundo continua preto, e preto é ausência de luz.

> Isso não é uma escolha de estilo, é o encaixe com a regra central da
> ferramenta. Uma fonte de texto não precisa de cor de fundo porque o fundo já é
> transparente — quem quiser uma caixa atrás põe uma superfície de cor embaixo.

### AC-75 — Digitar não reconstrói a fonte

**Dado** uma fonte de texto já desenhando na parede
**Quando** o texto muda
**Então** o pool **remenda** a instância existente em vez de trocá-la.

> `SourcePool.#patch` caía num `JSON.stringify` e reconstruía qualquer descritor
> que mudasse. A cada tecla, a textura seria jogada fora e a parede piscaria.

### AC-76 — A textura é a caixa do texto

**Dado** um texto de qualquer tamanho
**Quando** a textura é gerada
**Então** ela é a caixa do próprio texto, com o maior lado em 2048 px, e é o
enquadramento da superfície que decide como ela cai na forma.

> Sempre no limite, e não no tamanho "natural": é o que dá ao projetor o texto
> mais nítido que o limite permite, seja a superfície de 200 px ou de 1800.

### AC-77 — Texto vazio é válido

**Dado** uma fonte de texto sem texto
**Quando** ela é desenhada
**Então** nada acende, e ela não vira erro nem textura de tamanho zero.

### AC-78 — Uma fonte de texto sobrevive ao disco

**Dado** uma fonte de texto com todos os campos alterados
**Quando** o projeto é salvo e recarregado
**Então** todos voltam; e um projeto sem texto continua byte a byte idêntico.

### AC-79 — Várias linhas se comportam

**Dado** um texto com quebras de linha
**Quando** ele é desenhado
**Então** entrelinha e alinhamento são respeitados, e a linha mais larga define
a caixa.

### AC-93 — O conteúdo sobe na orientação certa

**Dado** uma imagem de orientação conhecida e um texto, no mesmo frame
**Quando** os pixels são lidos
**Então** os dois aparecem com o topo em cima.

> Nasceu de um defeito real: o texto subia **de cabeça para baixo**, e todo teste
> de pixel continuava passando — eles contavam brilho e cor, e um espelhamento
> não muda nenhum dos dois. `UNPACK_FLIP_Y_WEBGL` é ignorado para `ImageBitmap`
> neste navegador e aplicado a um `<canvas>`; medido lado a lado, com o flip
> ligado a imagem sai certa e o canvas sai invertido. Por isso a imagem entra
> nesta checagem junto: se um dia o flip mudar para todo mundo, ela denuncia.

### AC-80 — O raio-x mostra a estrutura inteira

**Dado** o raio-x ligado
**Quando** o overlay é desenhado
**Então** toda superfície ganha uma silhueta, **inclusive as escondidas**.

> Achar a superfície que alguém silenciou é metade do motivo deste modo existir.

### AC-81 — O raio-x não muda um pixel do que a engine desenha

**Dado** o raio-x ligado e desligado
**Quando** os pixels são lidos do buffer GL
**Então** são idênticos.

> Um modo de diagnóstico que chegue ao projetor no meio de uma inauguração é um
> desastre. Ele é desenhado no overlay, que é DOM, e a janela de saída não tem
> overlay: não é uma trava que alguém possa esquecer de ligar, é impossibilidade
> estrutural.

### AC-82 — Esconder a interface apaga o raio-x junto

**Dado** o raio-x ligado
**Quando** `H` esconde a interface
**Então** ele some com o resto — sem nenhum código para isso, porque ele **é** a
interface.

### AC-84 — Uma cena guarda apresentação, nunca geometria

**Dado** uma cena capturada
**Quando** uma superfície é movida e a cena é retomada
**Então** a superfície continua onde foi movida, e a cue não guarda `frame`,
`shape`, `warp`, `crop`, `rotation`, `fit`, `blend` nem `z`.

> O alinhamento custou horas em cima de uma escada e é físico. Rodar o show não
> pode mexer nele — e o efeito colateral é o que torna a regra valiosa: dá para
> corrigir alinhamento com o show rodando.

### AC-85 — Tocar não escreve no projeto

**Dado** uma timeline tocando um ciclo inteiro
**Quando** o projeto é comparado antes e depois
**Então** nem um byte mudou e nenhuma entrada de desfazer foi criada.

> Se o playhead escrevesse opacidade nas superfícies, cada frame passaria por
> `Store.mutate`, que clona o projeto e empilha histórico — sessenta vezes por
> segundo. O desfazer viraria lixo e o autosave escreveria no disco a noite
> toda. A timeline é projeção de leitura, não mutação.

### AC-86 — A transição escurece e volta

**Dado** uma cena com transição
**Quando** ela entra
**Então** a superfície escurece até o preto na primeira metade, ainda com o
conteúdo velho, e volta ao alvo na segunda, já com o novo. Transição zero corta
seco.

### AC-87 — `hold` zero espera o GO

**Dado** uma cena com `hold: 0`
**Quando** o tempo passa
**Então** ela não avança: segura até alguém mandar seguir.

### AC-88 — O laço fecha o ciclo

**Dado** a última cena
**Quando** ela vence
**Então** com laço volta à primeira e continua tocando; sem laço, pausa.

### AC-89 — A timeline sobrevive ao disco

**Dado** uma timeline com cenas, tempos e laço
**Quando** o projeto é salvo e recarregado
**Então** tudo volta; projeto sem timeline continua byte a byte idêntico, e
apagar a última cena devolve o arquivo ao que era.

### AC-90 — Superfície nova não some numa cena antiga

**Dado** uma superfície criada depois de uma cena ser capturada
**Quando** a cena é retomada
**Então** ela mantém a própria apresentação em vez de sumir.

> Cena é uma sobreposição, não um estado completo do mundo.

### AC-91 — Mexer na apresentação devolve o controle à mão

**Dado** uma timeline ativa
**Quando** a opacidade, a fonte ou a visibilidade de uma superfície é alterada
**Então** a timeline sai do comando. Mexer na **geometria** não ejeta nada.

> Um controle de opacidade que não faz nada é pior do que um desabilitado. E
> corrigir alinhamento com o show rodando precisa continuar possível.

### AC-92 — A apresentação é função, não cópia

**Dado** uma timeline tocando
**Quando** as superfícies chegam ao renderer
**Então** são **os mesmos objetos** do projeto.

> A geometria derivada é guardada num `WeakMap` com a identidade do objeto como
> chave, e foi ela que fez o trabalho de JS por frame cair de 0,3 ms para 0,1 ms
> com 30 superfícies. Clonar superfícies por frame para injetar a opacidade da
> cena furaria esse cache em todos os frames.

### AC-55 — O guia manda clicar em botões que existem

**Dado** o guia e o catálogo de mensagens da mesma língua
**Quando** o guia manda o leitor clicar num botão nomeado
**Então** aquele rótulo aparece no catálogo com o mesmo texto, nas três línguas.

> Este critério nasceu de um defeito real: o redesenho da barra renomeou dois botões e
> o guia continuou mandando clicar nos nomes antigos. Nada quebrou, nada avisou — só o
> texto que existe para tirar dúvida passou a criar uma. A checagem cobre os rótulos
> que o guia usa como instrução, não toda palavra em negrito: "preto é transparência"
> é conceito, não botão.

---

## 5. Não testado automaticamente

Deliberado e visível. Estes precisam de hardware, de permissão de usuário, ou de olho
humano — marcá-los é melhor do que fingir cobertura.

| Id | Critério | Por que não é automatizado |
|---|---|---|
| AC-21 | Setas corrigem 1 px num canto e a diferença é visível na parede | Precisa de projetor e parede. A mutação em si está coberta por AC-7/AC-8. |
| AC-22 | Três superfícies coincidem com molduras reais dentro de 1 px | Verificação física, com projetor apontado para objeto real. |
| AC-23 | Imagem, vídeo em loop e GIF tocando juntos sem engasgo | Depende de mídia real e de GPU real; headless usa SwiftShader. |
| AC-24 | `capture` mapeando a janela de outro programa, ao vivo | `getDisplayMedia` exige gesto e escolha de janela pelo usuário. |
| AC-25 | Saída na segunda tela com o editor no laptop | Exige segunda tela física e a Window Management API. |
| AC-26 | Fechar, reabrir a pasta do projeto e tudo voltar | `showDirectoryPicker` exige gesto do usuário; não roda headless. |
| AC-27 | 30 superfícies com 4 vídeos 1080p a 60fps | Meta de performance nunca medida. Ver [TASKS.md](TASKS.md). |
| AC-30 | Conteúdo animado continua animando em navegador **sem** `requestVideoFrameCallback` | O smoke roda em chromium, que tem a API. Este é o caminho de Firefox e Safari mais antigo, onde o upload passa a ser marcado a cada render — precisa de verificação manual nesses navegadores. |

---

## 6. Estado da verificação

Última execução: `npm test` (78/78) + `npm run smoke` (23/23), build de ~280 KB.

| Critério | Estado | Prova |
|---|---|---|
| AC-1 | provado | `math.test.ts` |
| AC-2 | provado | `math.test.ts` (2 testes) |
| AC-3 | provado | `math.test.ts` |
| AC-4 | provado | `math.test.ts` (convexo + côncavo) |
| AC-5 | provado | `math.test.ts` (2 testes) |
| AC-6 | provado | `renderer.test.ts` (6 testes) |
| AC-7 | provado | `store.test.ts` + `smoke.mjs` (pela UI real) |
| AC-8 | provado | `store.test.ts` |
| AC-9 | provado | `store.test.ts` (2 testes, incluindo o patch genérico) |
| AC-10 | provado | `store.test.ts` |
| AC-11 | provado | `store.test.ts` (2 testes, incluindo a numeração projetada) |
| AC-12 | provado | `store.test.ts` |
| AC-13 | provado | `store.test.ts` |
| AC-14 | provado | `smoke.mjs` (2 checagens) |
| AC-15 | provado | `smoke.mjs` (3 checagens) |
| AC-16 | provado | `smoke.mjs` |
| AC-17 | provado | `smoke.mjs` |
| AC-18 | provado | `smoke.mjs` (2 checagens) |
| AC-19 | provado | `smoke.mjs` |
| AC-20 | provado | `smoke.mjs` (0,50 px de 1,5 px permitidos) + `renderer.test.ts` |
| AC-28 | provado | `renderer.test.ts` (5 testes) + `smoke.mjs` (2 checagens de pixel) |
| AC-29 | provado | `sources/textures.test.ts` (5 testes) |
| AC-31 | provado | `smoke.mjs` |
| AC-32 | provado | `store.test.ts` (3 testes) + `smoke.mjs` (2 checagens de pixel) |
| AC-33 | provado | `i18n/catalogues.test.ts` (6 testes) + `check-i18n.mjs` |
| AC-34 | provado | `i18n/docs/guide.test.ts` (7 testes) |
| AC-35 | provado | `math.test.ts` (2 testes) |
| AC-36 | provado | `math.test.ts` |
| AC-37 | provado | `store.test.ts` |
| AC-38 | provado | `store.test.ts` |
| AC-39 | provado | `smoke.mjs` (leitura de pixel sem forçar frame) |
| AC-40 | provado | `store.test.ts` |
| AC-41 | provado | `store.test.ts` |
| AC-42 | provado | `saver.test.ts` (4 testes) |
| AC-43 | provado | `saver.test.ts` |
| AC-44 | provado | `warp.test.ts`, `store.test.ts` + `smoke.mjs` (pixel) |
| AC-46 | provado | `store.test.ts` |
| AC-47 | provado | `warp.test.ts`, `store.test.ts` |
| AC-48 | provado | `warp.test.ts`, `store.test.ts` |
| AC-49 | provado | `warp.test.ts` + `smoke.mjs` (varredura por costura) |
| AC-50 | provado | `warp.test.ts` |
| AC-51 | provado | `warp.test.ts` (2 testes) |
| AC-52 | provado | `smoke.mjs` (pixel) |
| AC-53 | provado | `warp.test.ts` (2 testes) |
| AC-54 | provado | `store.test.ts` |
| AC-55 | provado | `docs/guide.test.ts` (3 línguas) |
| AC-56 | provado | `project-folder.test.ts` + `smoke.mjs` (IndexedDB em `file://`) |
| AC-57 | provado | `project-folder.test.ts` (2 testes) |
| AC-58 | provado | `project-folder.test.ts` |
| AC-59 | provado | `smoke.mjs` (clique real) |
| AC-60 | provado | `smoke.mjs` (arrasto real) |
| AC-61 | provado | `smoke.mjs` (contraste medido) |
| AC-62 | provado | `smoke.mjs` (DOM contra ordem do engine) |
| AC-63 | provado | `color.test.ts` (2 testes) + `smoke.mjs` |
| AC-64 | provado | `color.test.ts` (3 testes) + `smoke.mjs` (pixel) |
| AC-65 | provado | `store.test.ts` (2 testes) + `smoke.mjs` (laço e arrasto reais) |
| AC-66 | provado | `store.test.ts` (2 testes) |
| AC-67 | provado | `store.test.ts` (3 testes) |
| AC-68 | provado | `store.test.ts` |
| AC-69 | provado | `store.test.ts` (2 testes) |
| AC-70 | provado | `smoke.mjs` (pixels da saída depois de afastar e arrastar) |
| AC-71 | provado | `smoke.mjs` (ponteiro real) |
| AC-72 | provado | `smoke.mjs` (2 checagens: layout e fechamento) |
| AC-73 | provado | `scripts/check-layers.mjs` (`npm run layers`) |
| AC-74 | provado | `smoke.mjs` (pixel) |
| AC-75 | provado | `smoke.mjs` |
| AC-76 | provado | `sources/text.test.ts` |
| AC-77 | provado | `sources/text.test.ts` |
| AC-78 | provado | `model/store.test.ts` |
| AC-79 | provado | `sources/text.test.ts` |
| AC-80 | provado | `smoke.mjs` (DOM) |
| AC-81 | provado | `smoke.mjs` (pixel, ligado contra desligado) |
| AC-82 | provado | `smoke.mjs` |
| AC-84 | provado | `model/store.test.ts` |
| AC-85 | provado | `model/store.test.ts` |
| AC-86 | provado | `model/store.test.ts` (2 testes) |
| AC-87 | provado | `model/store.test.ts` |
| AC-88 | provado | `model/store.test.ts` (2 testes) |
| AC-89 | provado | `model/store.test.ts` (3 testes) |
| AC-90 | provado | `model/store.test.ts` |
| AC-91 | provado | `model/store.test.ts` |
| AC-92 | provado | `model/store.test.ts` |
| AC-93 | provado | `smoke.mjs` (imagem e texto no mesmo frame) |
| AC-21..27 | `not-tested` | ver seção 5 |

**Julgamento:** o caminho de renderização está garantido, não apenas testado — o
smoke lê pixels do build real, e o critério mais escorregadio do projeto (AC-20) é
medido em pixels, não olhado. O que **não** está garantido é a precisão física: nada
aqui prova que a borda projetada coincide com a moldura real, e nada prova a meta de
performance. Esses são AC-21 a AC-27, e continuam abertos até alguém ligar um projetor.
