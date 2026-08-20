# 0003 — Controle de superfícies

Três frentes que apareceram usando a ferramenta de verdade: cor, seleção múltipla
e navegação da área de trabalho. A do meio é a grande, e é a que muda o modelo.

---

## A — Cor: um defeito e um seletor

**O defeito.** Toda fonte de cor nasce chamada "branco" e nunca deixa de se
chamar assim, porque o nome é fixado na criação (`t('sources.white')`) e mudar a
cor só toca `rgb`. Uma lista com cinco fontes "branco" de cores diferentes é
inútil — e é exatamente a lista que aparece depois de calibrar um projetor.

**A cura.** O nome de uma fonte de cor **é** a cor. Deixa de ser copiado na
criação e passa a ser derivado do `rgb`, com um nome humano do tom mais próximo
mais o hex: `vermelho #d02b2b`. Renomear à mão continua valendo — nome escrito
por gente ganha do derivado, e é o `name` que decide.

**O seletor.** `<input type="color">` abre o diálogo do sistema: pesado, fora do
tema, sem as cores que esta ferramenta usa o tempo todo. O nosso:

- Quadro de saturação/valor mais trilha de matiz, arrastáveis.
- Campo hex e três campos RGB, para o valor exato que uma medição pediu.
- Amostras fixas do domínio: branco, preto, cinza 50%, e as três primárias
  puras — o que se usa para conferir foco, ponto de preto e canal do projetor.

### Critérios

- **AC-63** — Trocar a cor de uma fonte muda o nome dela, e um nome escrito à
  mão sobrevive à troca.
- **AC-64** — O seletor devolve exatamente a cor escolhida: o que o hex diz é o
  que a superfície acende.

---

## B — Seleção múltipla, e superfícies ligadas

**Duas coisas diferentes, de propósito.** Confundi-las é o erro clássico aqui.

- **Seleção** é do momento: quem eu peguei agora. Não vai para o disco.
- **Vínculo** é do projeto: estas superfícies são uma coisa só e continuam sendo
  amanhã, quando a pasta for reaberta no galpão.

**O modelo.** `ViewState.selectedSurfaceId` vira `selectedIds: string[]`, e o
**âncora** — a superfície cujas propriedades o inspetor edita, cujo canto as
setas movem — é o último da lista. Um campo, sem invariante entre dois. Quem
precisa do âncora chama `anchorId(view)`.

Uma superfície ganha `link?: string`. Selecionar uma seleciona o grupo inteiro;
mover, travar ou esconder uma faz o mesmo com todas. Um grupo é uma decisão do
operador, não uma inferência.

**Invariantes.**

- `selectedIds` nunca repete, e nunca aponta para superfície que não existe.
- Apagar uma superfície a tira da seleção.
- Superfície travada não se move, e num arrasto de grupo ela também não segura o
  grupo: as destravadas andam, a travada fica. Travar é sobre aquela superfície,
  nunca sobre as outras.
- Um arrasto de grupo é **um** desfazer, não um por superfície.

### Critérios

- **AC-65** — Ctrl/Cmd + clique acrescenta e tira da seleção; arrastar move
  todas as selecionadas juntas, e o conjunto volta num só desfazer.
- **AC-66** — O inspetor e as setas continuam operando o âncora, e o âncora é o
  último escolhido.
- **AC-67** — Superfícies ligadas se selecionam juntas, se movem juntas e
  sobrevivem a salvar e recarregar.
- **AC-68** — Numa seleção com uma superfície travada, as destravadas se movem e
  a travada não.
- **AC-69** — Apagar superfície selecionada a remove da seleção sem deixar id
  órfão.

---

## C — Voltar de um zoom perdido

**O problema.** Depois de rolar muito, a área de trabalho fica num lugar de onde
não se volta a não ser clicando em "enquadrar": o zoom é preso entre 0,05 e 8,
mas o pan não é preso em nada, então a saída sai inteira da tela e a roda do
mouse passa a ampliar o vazio.

**A cura, em duas partes.**

1. **O pan não pode perder a saída.** O retângulo de saída fica sempre com uma
   margem visível dentro da área de trabalho. Não é uma trava dura que trava o
   arrasto: é um limite aplicado ao resultado, então continua fluido.
2. **Ctrl arrasta a vista.** Segurar Ctrl e arrastar reenquadra livremente, sem
   tocar em superfície nenhuma — o mesmo modificador que já desliga o ímã, e o
   gesto que a pessoa espera de qualquer ferramenta de canvas.

### Critérios

- **AC-70** — Depois de qualquer sequência de rolagem e arrasto, a saída
  continua alcançável na área de trabalho.
- **AC-71** — Ctrl + arrastar reenquadra a vista e não move superfície nenhuma.
