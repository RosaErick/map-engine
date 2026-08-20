# Malha livre — plano

Branch `mesh-warp`. Complementa o que existe; nada do modelo atual muda de forma.

## 1. A decisão de modelagem que sustenta tudo

Malha **não** é mais um membro de `Shape`. Se fosse, "malha com máscara de elipse"
seria irrepresentável — e a elipse é uma das coisas que o app já faz bem.

Uma superfície passa a ter três camadas ortogonais:

```
frame  →  warp  →  shape
onde está    como entorta    o que fica aceso
4 cantos     malha opcional  retângulo · elipse · polígono
px de saída  espaço do frame espaço do frame
```

`Surface.warp` é **opcional**. Projeto salvo sem ele continua idêntico, e a ausência é
o caso comum. Nada de migração, `version: 1` intacto.

### Consequência que valida a escolha

`shape` e `uvMatrix` (recorte, encaixe, rotação) operam sobre `vUV`, a coordenada do
frame **antes** da deformação. Logo a máscara e o encaixe atravessam a malha sem uma
linha de código novo: o conteúdo entorta, o recorte entorta junto, e ninguém precisa
saber disso.

## 2. Semântica dos pontos de controle

Um ponto de controle é uma **posição**, não uma coordenada de textura. Você arrasta para
mover aquele pedaço da projeção até o objeto físico; a textura acompanha a geometria.

- Vivem em **espaço do frame**, valor padrão `(col/cols, row/rows)`.
- Posição em pixels = `H · ponto`, com `H` a homografia do frame — então **mexer no
  frame carrega a malha junto**, exatamente como já acontece com a forma.
- Coordenada de textura do vértice = a posição **não deformada** da grade.

## 3. Correção de perspectiva com malha livre

Com pontos movidos livremente não existe mais uma homografia única — e o brief proíbe
"subdividir para disfarçar o problema". A saída é por célula:

- Cada célula é um quad; resolve-se **uma homografia por célula** e emite-se
  `gl_Position = vec4(clip * w, 0, w)` com o `w` daquela célula.
- Vértices **não são compartilhados** entre células: o `w` de um canto difere para cada
  célula que o toca. 8×8 células = 256 vértices. Irrelevante para a GPU.
- Resultado: projetivamente exato **dentro** de cada célula, contínuo em posição entre
  elas.

### Grade de controle ≠ tesselação

Duas grades distintas, e é isso que separa esta implementação de uma malha comum:

- **controle** — o que você arrasta (3×3, 5×5). Poucas alças, UI usável.
- **tesselação** — o que é desenhado, mais fina que o controle.

Entre os pontos de controle interpola-se em dois modos:

- `smooth` (Catmull-Rom) — superfície contínua na derivada, sem facetamento em
  gradiente. Para coluna, arco, parede abaulada.
- `linear` — para vinco duro, onde suavizar seria errado.

## 4. Invariantes

1. `cols ≥ 1`, `rows ≥ 1`, e exatamente `(cols+1) × (rows+1)` pontos.
2. Pontos são finitos. Podem sair de `0..1` — puxar para fora do frame é legítimo —
   mas são contidos numa faixa sã para um arquivo corrompido não gerar geometria absurda.
3. A malha identidade é **exatamente** reconstruível: `reset` e "sem malha" desenham o
   mesmo pixel.
4. Superfície travada recusa edição de malha, pela mesma razão que recusa canto: é o que
   está em cima do objeto físico.
5. Trocar a subdivisão **reamostra** o que já foi editado, nunca descarta.

## 5. Critérios de aceite

| id | critério |
|---|---|
| AC-44 | Sem malha, o desenho é idêntico ao de antes — e uma malha identidade também |
| AC-45 | Pontos vivem no espaço do frame: mover o frame carrega a malha |
| AC-46 | Superfície travada recusa edição de malha |
| AC-47 | Trocar a subdivisão reamostra a superfície atual |
| AC-48 | `reset` restaura a grade identidade exatamente |
| AC-49 | Correção projetiva por célula: reta continua reta dentro da célula |
| AC-50 | `smooth` e `linear` produzem superfícies diferentes e previsíveis |
| AC-51 | `parseProject` conserta ou descarta malha inválida sem deixar NaN passar |
| AC-52 | Máscara de elipse e polígono continua recortando numa superfície deformada |
| AC-53 | Hit-test atravessa a malha |
| AC-54 | Um arrasto de ponto colapsa numa entrada de histórico |

## 6. Ordem de execução

1. Domínio na engine: `warp.ts` — tipos, identidade, avaliação, reamostragem, validação.
2. Renderer: caminho de malha em paralelo ao caminho atual. **O caminho sem malha não
   é tocado** — AC-20 é a garantia mais cara do projeto e não entra em risco.
3. Store e persistência: mutações nomeadas, `parseWarp`, trava.
4. Editor: alças, linhas da malha, seleção suave, setas, hit-test.
5. i18n nos três idiomas.
6. Testes, smoke em pixel, documentação, ADR.
