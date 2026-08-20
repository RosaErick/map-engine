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
npm test              # 37 testes de unidade (node:test, sem framework)
npm run build         # gera dist/index.html autocontido
npm run smoke         # chromium headless abre o build por file:// e lê pixels
```

---

## 1. Matemática — homografia e geometria

Seam: `packages/engine/homography.ts`, `packages/engine/geometry.ts` (funções puras).

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

### AC-5 — Hit test e bounds

**Dado** um polígono e um ponto
**Quando** o ponto é testado
**Então** a resposta diz se ele está dentro; e os bounds de um conjunto de pontos
envolvem todos eles

---

## 2. Conteúdo dentro da forma

Seam: `uvTransform` em `packages/engine/renderer.ts` (função pura, sem GL).

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

Seam: `Store` em `packages/engine/store.ts`. Toda mutação passa por métodos daqui —
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

### AC-20 — UV com correção de perspectiva

**Dado** um quadrilátero fortemente deformado em perspectiva e um padrão com bordas retas
**Quando** ele é renderizado
**Então** as bordas continuam retas na saída, com desvio máximo de **1,5 px** em
relação à reta ajustada

> Esta é a armadilha número um do brief. Interpolação linear de UV produz uma dobra
> diagonal no meio da textura, exatamente onde os dois triângulos se encontram.
> Medição atual: **0,50 px** de desvio máximo em 414 amostras.

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

Última execução: `npm test` (37/37) + `npm run smoke` (18/18), build de ~212 KB.

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
| AC-21..27 | `not-tested` | ver seção 5 |

**Julgamento:** o caminho de renderização está garantido, não apenas testado — o
smoke lê pixels do build real, e o critério mais escorregadio do projeto (AC-20) é
medido em pixels, não olhado. O que **não** está garantido é a precisão física: nada
aqui prova que a borda projetada coincide com a moldura real, e nada prova a meta de
performance. Esses são AC-21 a AC-27, e continuam abertos até alguém ligar um projetor.
