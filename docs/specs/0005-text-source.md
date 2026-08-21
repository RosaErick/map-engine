# 0005 — Texto como conteúdo

Uma fonte de conteúdo nova: `text`. O que ela desenha é texto; o resto do
aplicativo não precisa saber disso.

---

## O encaixe que já existe

`CanvasSource` já prova o caminho: um `<canvas>` 2D vira textura como qualquer
imagem. Texto é o mesmo mecanismo com uma função de desenho **nossa** em vez de
um módulo do usuário. Nada no renderer muda.

E há um encaixe melhor ainda, que decide o desenho todo: **preto é
transparência**. Um canvas preto com glifos coloridos acende exatamente os
glifos e nada mais. Isso significa que a fonte de texto **não precisa de cor de
fundo** — o fundo é ausência de luz, que é o que a ferramenta já faz de melhor.
Quem quiser uma caixa atrás do texto põe uma superfície de cor embaixo.

## O modelo

```ts
| { id; name; kind: 'text';
    text: string;
    family: 'sans' | 'serif' | 'mono';
    weight: 400 | 700;
    italic: boolean;
    color: Rgb;
    align: 'left' | 'center' | 'right';
    lineHeight: number;   // múltiplo do corpo
    tracking: number;     // espaçamento entre letras, em em
  }
```

**Três famílias, e não uma lista de fontes.** O aplicativo é um arquivo HTML
único que abre sem rede: embutir uma fonte inflaria o arquivo, e carregar uma da
web quebraria a promessa de funcionar offline. As três são pilhas de fontes do
sistema. Carregar uma fonte da **pasta do projeto** é o caminho natural para
depois — a pasta já copia arquivo arbitrário — e está registrado como ideia, não
como escopo.

**Não há campo de tamanho.** A textura é a caixa do próprio texto, e o
enquadramento da superfície (`esticar` / `caber` / `preencher`) decide como ela
cai na forma. Um campo de corpo em pixels seria um segundo controle de tamanho
brigando com o primeiro.

## A textura

A caixa exata do texto, desenhada **sempre no limite de 2048 px** no maior lado.
Não é para economizar: é para o projetor receber o texto mais nítido que o limite
permite, seja a superfície de 200 px ou de 1800. Acima de 2048 px projetados o
texto amolece — o conserto é um limite maior, e o preço é memória.

`caber` centraliza o texto na forma; `esticar` preenche e deforma, que numa
superfície em perspectiva costuma ser o que se quer.

## Editar sem piscar

`SourcePool.#patch` hoje cai num `JSON.stringify` e **reconstrói** a fonte quando
o descritor muda. Reconstruir a cada tecla digitada jogaria a textura fora e
piscaria na parede. Ganha um ramo próprio, como `ColorSource.setColor` já tem.

## Interface

O editor de texto **flutua**, como o seletor de cor: um painel dentro da lista
empurraria tudo para baixo e esconderia a parede, que é onde se julga o
resultado. Os dois passam a compartilhar `ui/Popover.svelte` — a segunda
ocorrência é o que justifica extrair a primeira.

Dentro: a área de digitação, e uma linha compacta com família, peso, itálico,
alinhamento, entrelinha e cor. O painel é redimensionável, porque uma área de
texto pequena é inútil e uma grande atrapalha o resto.

## Critérios

- **AC-74** — Uma fonte de texto acende só os glifos: o fundo continua preto, e
  preto é ausência de luz.
- **AC-75** — Digitar atualiza a parede **sem reconstruir a fonte**: o pool
  remenda a instância existente em vez de trocá-la.
- **AC-76** — A textura é a caixa do texto, limitada a 2048 px no maior lado, e é
  o enquadramento da superfície que decide como ela cai na forma.
- **AC-77** — Texto vazio é válido e não acende nada, em vez de virar erro ou
  textura de tamanho zero.
- **AC-78** — Uma fonte de texto sobrevive a salvar e recarregar com todos os
  campos, e um projeto sem texto continua idêntico byte a byte.
- **AC-79** — Várias linhas respeitam entrelinha e alinhamento; a linha mais
  larga define a caixa.
