# Changelog

Todas as mudanças relevantes deste projeto. O formato segue
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), e a numeração segue
[SemVer](https://semver.org/lang/pt-BR/).

Enquanto a versão for `0.x`, a API pública da engine pode mudar sem aviso de
compatibilidade — o modelo de dados do `project.json` não: ele tem `version` e é
migrado na leitura.

## [Não lançado]

Ainda sem tag. `git tag v0.1.0 && git push origin v0.1.0` publica o Release com o
arquivo único anexado.

### Malha livre

Superfície que não é plana — coluna, arco, parede abaulada — passa a ter uma camada de
deformação entre o frame e o recorte. **Opcional**: projeto salvo sem ela continua
idêntico, byte a byte.

- Pontos de controle arrastáveis, com **atração de vizinhos** ajustável — sem isso,
  moldar uma curva seria um ponto de cada vez.
- Setas do teclado movem 1 px num ponto de malha, como já faziam num canto.
- Interpolação **curva** (Catmull-Rom) para superfície contínua, ou **reta** para vinco
  duro.
- Grade de controle separada da tesselação: poucas alças para arrastar, malha fina para
  desenhar. Trocar a subdivisão **reamostra** e preserva o que já foi ajustado.
- Cada célula carrega a própria homografia e o próprio `w`, então a textura fica
  projetivamente exata dentro dela e a malha não mostra costura.
- Máscara de elipse e de polígono continuam recortando numa superfície deformada.
- Superfície travada recusa edição de malha, pela mesma razão que recusa canto.

### A pasta do projeto sobrevive à sessão

O brief pede "abrir usa `showDirectoryPicker()` **e guarda o handle**", e o handle só
vivia na memória do módulo: toda abertura exigia re-selecionar a pasta antes de qualquer
coisa aparecer.

- O handle vai para IndexedDB, que aceita clone estruturado — `localStorage` só guarda
  texto. Verificado que IndexedDB funciona e persiste em `file://`, uma origem opaca e a
  distribuição principal deste app.
- A promessa é do tamanho do que o navegador permite: **um clique em vez de navegar o
  diálogo do sistema**, e nenhum quando a permissão é persistente. Pedir permissão fora
  de um gesto do usuário é rejeitado de propósito, então a partida nunca escala sozinha:
  o nome da pasta vira botão e o pedido acontece dentro do clique.
- Permissão negada não vira botão para insistir, e handle cuja pasta sumiu é esquecido
  em vez de ficar meio adotado falhando a cada salvamento.

### Texto como conteúdo

Uma fonte nova: `texto`, escrito dentro do app.

- O encaixe é com a regra central da ferramenta: **preto é ausência de luz**, então um
  canvas preto com glifos coloridos acende exatamente os glifos. Uma fonte de texto por
  isso **não tem cor de fundo** — quem quiser uma caixa atrás põe uma superfície de cor
  embaixo.
- Não há campo de tamanho: a textura é a caixa do próprio texto, e o enquadramento da
  superfície decide como ela cai na forma. Um corpo em pixels seria um segundo controle
  brigando com o primeiro.
- A caixa é desenhada **sempre no limite de 2048 px** no maior lado. Não é economia: é o
  texto mais nítido que o limite permite, seja a superfície de 200 px ou de 1800.
- Três famílias do sistema, e não uma lista de fontes: o app é um arquivo único que abre
  sem rede, e embutir tipografia o inflaria.
- Digitar **remenda** a fonte em vez de reconstruí-la — reconstruir jogaria a textura fora
  e piscaria na parede a cada tecla.
- O nome na lista é o próprio texto, pelo mesmo motivo que a fonte de cor passou a se
  chamar pela cor.

### Modo raio-x

Um mapeamento com trinta superfícies é ilegível com o conteúdo aceso. O raio-x (tecla `X`)
apaga o conteúdo e acende a estrutura: a silhueta de cada superfície, o número que o
projetor desenha, e a malha de quem tem uma — **inclusive as escondidas**, que é como se
acha a superfície que alguém silenciou.

Onde duas superfícies se sobrepõem, a translucidez soma sozinha e a sobreposição aparece:
interseção de polígonos sem calcular interseção de polígonos.

**Ele não pode chegar ao projetor, por construção.** É desenhado no overlay, que é DOM, e a
janela de saída não tem overlay — impossibilidade estrutural, não uma trava que alguém possa
esquecer de ligar. Medido lendo o buffer GL com o modo ligado e desligado: os pixels são
idênticos.

### Cenas e timeline

**Esta feature estava explicitamente fora de escopo no brief**, e a decisão de não a
perseguir estava registrada. A reversão foi deliberada, e o desenho existe para que ela não
transforme a ferramenta em outro produto.

A regra que decide o modelo inteiro: **uma cena guarda apresentação, nunca geometria.**
Fonte, opacidade e visibilidade entram; `frame`, `shape`, `warp`, `crop`, `rotação`,
`encaixe`, `mistura` e ordem, não. O alinhamento custou horas em cima de uma escada e é
físico — e o efeito colateral é o que torna a regra valiosa: **dá para corrigir alinhamento
com o show rodando**.

- Capturar cena tira uma foto do visual montado à mão. Duas cenas já são um show.
- **Segura** é quanto a cena dura; **segura em zero espera o GO**. **Transição** é quanto
  ela leva para entrar, escurecendo até o preto no meio.
- Com **repetir**, a última volta para a primeira.
- **Tocar não escreve um byte no projeto**: nem entrada de desfazer, nem autosave. A
  timeline sobrepõe na leitura, e o relógio guarda o instante de início em vez do tempo
  decorrido — uma escrita por cena, não sessenta por segundo.
- Mexer na opacidade ou na fonte de uma superfície **devolve o controle à mão** e tira a
  timeline do comando, o idioma que qualquer mesa de luz tem. Mexer na geometria não.

Não há crossfade verdadeiro, e isso é deliberado: exigiria duas texturas por superfície.
Quem precisar de um empilha duas superfícies e cruza as opacidades pela cena.

### Controle de várias superfícies

Selecionar uma de cada vez é o que se faz numa parede de três quadros. Numa de trinta,
não é.

- **Laço** arrastando no vazio, e **Shift + clique** para acrescentar ou tirar.
  **Ctrl+A** pega todas as visíveis.
- Arrastar uma das escolhidas move todas, e o arrasto inteiro volta num **só** desfazer —
  um por superfície transformaria "desfazer o que acabei de fazer" em apertar Ctrl+Z
  tantas vezes quantas superfícies havia, sem saber quantas eram.
- **Ligar** superfícies faz um grupo que sobrevive a salvar e reabrir. Vínculo é do
  projeto, seleção é do momento — confundir os dois é o erro clássico aqui, e por isso
  são coisas separadas no modelo.
- O **âncora** é a última escolhida: é ela que o painel edita e cujo canto as setas
  movem. Editar vale para uma, mover vale para todas.
- Superfície travada não anda e também não segura o grupo. Travar fala sobre ela.

### A vista não se perde mais

O zoom era preso entre 0,05 e 8 e o pan não era preso em nada: bastava arrastar longe o
bastante para a saída sair inteira da tela, e aí a roda do mouse ampliava o vazio. Medido:
a mesma sequência deixava **zero** pixel da saída visível.

- A saída fica sempre alcançável — um limite no resultado, não uma trava no gesto, então o
  arrasto continua fluido e só para de andar quando encosta.
- **Ctrl + arrastar** reenquadra, o gesto que se tenta primeiro quando a vista se perdeu.
  Ctrl durante um arrasto de **canto** continua desligando o ímã: a passagem vale só para
  o corpo da superfície, nunca para a alça de 1 px.

### Adicionado

**Engine**
- Renderização WebGL2 de superfícies em perspectiva, com UV projetivamente correto
  pelo `w` de `gl_Position` — sem dobra diagonal (desvio medido: 0,50 px).
- Superfície como quadrilátero de 4 cantos mais recorte: retângulo, elipse com borda
  suave e polígono livre traçado na tela.
- Rotação do conteúdo dentro da superfície, em torno do centro do frame.
- Encaixe `esticar`/`caber`/`preencher`, opacidade, mistura (`normal`, `soma`,
  `screen`, `multiply`) e ordem de desenho.
- Fontes de conteúdo: imagem, vídeo, GIF, cor sólida, captura de tela
  (`getDisplayMedia`), câmera e módulo JS do usuário.
- Cache de textura por fonte e por contexto GL: uma fonte alimenta várias superfícies
  e várias janelas com um decode só.
- Upload de vídeo guiado por `requestVideoFrameCallback`, com fallback correto onde a
  API não existe.
- Store com histórico, agrupamento de gesto, trava por superfície, solo e mudo.
- Oito padrões de teste, globais ou por superfície.

**Editor**
- Arrastar cantos e superfícies, pan, zoom, ímã de canto e ajuste por setas
  (1 px, 10 px com Shift).
- Projeto como pasta em disco, com `project.json` de caminhos relativos e autosave.
- Janela de saída em segunda tela pela Window Management API, compartilhando o store.
- Temas claro e escuro (paleta Carbonfox), com opção de seguir o sistema.
- Interface em português, espanhol e inglês, detectada pelo navegador.

**Sobre e guia**
- Página de documentação na barra de cima, com índice fixo que acompanha a leitura,
  em português, espanhol e inglês.
- Página "sobre" contando por que a ferramenta existe e o que a licença garante,
  separada do guia: uma explica o porquê, a outra ensina o como. Um teste garante que as três versões têm as mesmas
  seções, na mesma ordem, com a mesma contagem de passos e atalhos.

**Engine como biblioteca**
- `npm run build:lib` gera `dist-lib/projmap.js` (55 KB, ESM, zero dependências)
  com declarações de tipo, e o pacote expõe `exports`/`types` — instalar direto do
  repositório funciona, sem publicar no npm.
- Exemplo executável em `examples/embed/`: um canvas, um `Project`, e frames saindo
  em trinta linhas.

**Marca**
- Ícone novo: um grid de pixels vermelho deformado pela **mesma homografia que a
  ferramenta aplica** — `scripts/mark.mjs` importa `solveUnitToQuad` da engine para
  desenhá-lo. Um quadrado girado seria um grid girado; um que converge é um grid jogado
  em cima de alguma coisa. Uma célula acesa é a superfície já mapeada.
- A mesma marca no ícone do app, na barra de cima e no cartão de compartilhamento. Na
  interface a célula acesa usa `currentColor`, então contrasta no tema claro e no escuro.

**Descoberta**
- Título, descrição, Open Graph, Twitter card e cartão de compartilhamento 1200×630.
- Dados estruturados `SoftwareApplication` declarando `price: 0` e
  `isAccessibleForFree` — é assim que uma ferramenta realmente gratuita evita ser
  arquivada junto com os testes grátis e os planos freemium.
- Conteúdo legível por rastreador dentro do `#app`, substituído quando o editor monta:
  a página servida deixou de ser um `div` vazio de duas palavras.
- `robots.txt`, `sitemap.xml` e URL canônica.
- Título e descrição acompanham o idioma escolhido.

**Distribuição**
- Build de arquivo único que abre por `file://`, sem servidor e sem rede.
- Instalação como aplicativo (PWA) com service worker versionado pelo hash do build.
- Publicação no GitHub Pages e Release com o `.html` avulso anexado.

### Mudado
- **Os arquivos do editor e da engine foram para pastas.** O editor tinha 25 arquivos numa
  pasta só; não é mais um punhado de componentes em volta de uma engine, é um aplicativo.
  Nenhuma lógica mudou — só caminho e a linha de `import` que aponta para ele.
  - A **engine** foi dividida pela direção das dependências, que já era obedecida sem estar
    escrita: `math/` (funções puras que não sabem o que é um projeto) ← `model/` (o domínio
    e o único caminho de mutação) ← `render/` (o que fala WebGL) ← `engine.ts` ← `index.ts`.
  - O **editor** foi dividido pelas regiões da tela e por quem fala com o navegador:
    `stage/`, `panels/`, `pages/`, `platform/` e `ui/`. Espelhar `domain/application/
    adapters` aqui seria aplicar um padrão por ser um padrão: o editor **não tem domínio
    próprio**, o agregado mora na engine.
  - `npm run layers` reprova import na direção errada e entra no `verify`. Estrutura sem
    guarda volta ao estado anterior em poucas semanas, um import de cada vez.
- **Seletor de cor próprio**, no lugar do campo nativo que abria o diálogo do sistema:
  quadro de saturação e brilho, trilha de matiz, campo hex, três campos RGB, e as amostras
  que esta ferramenta usa o tempo todo — branco, cinza 50%, preto e as três primárias
  puras, que é o que se projeta para conferir foco, ponto de preto e canal.
- **O clique numa superfície passou a respeitar a forma, não a caixa dela.** Um polígono
  ocupa uma fração da própria bbox, e o canto vazio dela selecionava a superfície — em
  cima de uma escada, mirando outra coisa. A área que responde ao ponteiro virou a
  silhueta; o contorno do frame continua desenhado como frame, que é o papel dele.
- **O guia da malha ganhou contorno escuro sob o traço claro**, a técnica que a
  cartografia usa para estrada sobre qualquer fundo. Contraste sobre branco medido:
  1,38 → 3,14. A alternativa registrada no backlog, medir a luminância e inverter,
  custaria `readPixels` por ponto e por frame — uma parada sincronizada da GPU dentro do
  laço de render.
- **As linhas da lista de superfícies mostram o número que o projetor desenha**, vindo de
  `surfaceOrder` — a mesma função do renderer, e não um `index + 1` próprio que
  divergiria dela. Uma superfície chamada "Superfície 2" podia aparecer projetada como
  "1".
- **Opacidade** e **ordem de desenho** passaram a ficar recolhidas numa seção só, como
  já acontecia com o recorte: são ajustes que se faz uma vez e não se toca mais, e
  abertas empurravam encaixe, mistura e padrão para fora da tela. O cabeçalho recolhido
  mostra a porcentagem quando a opacidade não está cheia — senão uma superfície apagada
  vira mistério.
- O painel **Projeto e saída** virou só **Projeto**, e a saída foi para onde ela de fato
  é configurada: **Projetor (saída)**.

### Corrigido
- **Não dava para empilhar superfícies**, e por duas razões independentes que se somavam
  no mesmo caso — um fundo cobrindo a saída, que é o arranjo mais comum que existe.
  - A área de clique de uma superfície capturava o ponteiro **sempre**, então com um fundo
    na tela a ferramenta de polígono ficava morta: não havia como traçar um contorno por
    cima do que já existia. Ela passou a valer só para a ferramenta de seleção.
  - O overlay iterava as superfícies na ordem do array enquanto o renderer as desenha por
    `z`. Quando as duas ordens discordavam — uma superfície criada antes e empilhada por
    cima —, dava para **ver** uma e **selecionar** a de baixo. O overlay passou a pintar na
    mesma ordem em que se desenha.
- **O seletor de cor abria dentro da lista de fontes**, empurrava o painel para baixo e
  obrigava a rolar até achá-lo — escondendo justamente a parede, que é o que se olha
  enquanto se escolhe uma cor. E não dizia como fechar. Virou um painel flutuante, que
  cabe na tela, é redimensionável pelo canto, e fecha por **Esc**, por clique fora e pelo
  botão: três saídas, porque a primeira que a pessoa tenta varia.
- **Toda fonte de cor se chamava "branco"**, qualquer que fosse a cor: o nome era fixado na
  criação e trocar a cor só mexia no `rgb`. Cinco fontes "branco" de cores diferentes é o
  que sobrava de uma sessão de calibração. O nome passou a ser derivado — o tom mais o hex,
  com a palavra vindo do catálogo e o código vindo da engine.
- Editar o vértice de um polígono traçado nunca funcionou pelo motivo que o backlog
  registrava. As alças e o `pointInPolygon` dentro de `surfaceAt` já existiam; o ponteiro
  é que não chegava lá, porque a trilha do frame no overlay capturava o clique sobre a
  caixa inteira. Consertar o `surfaceAt` sozinho não mudava nada — e não mudou, por meses.
- O verificador de i18n reprovava a linha de abertura de um comentário JSDoc: ele pula
  linhas que começam com `//` ou `*`, e `/**` não é nenhum dos dois, então uma palavra
  entre aspas ali virava "texto em código". Comentários de bloco passaram a ser apagados
  antes da varredura, preservando as quebras de linha para o número da linha continuar
  certo. Mesmo defeito do apóstrofo em comentário de marcação, um nível acima.
- O `smoke` herdava o idioma da máquina. O editor escolhe o catálogo por
  `navigator.languages`, então os cliques — escritos em português — só achavam os botões
  porque quem rodava tinha o laptop em pt-BR. Numa máquina em inglês a suíte inteira
  morria no primeiro clique. O idioma passou a ser fixado no contexto do navegador.
  Encontrado ao pôr o `smoke` no CI pela primeira vez.
- O guia mandava clicar em botões com nomes que não existiam mais depois do redesenho da
  barra (`Igualar esta tela`, `+ superfície`). Os rótulos citados agora batem com os
  reais nos três idiomas.
- O guia não mencionava **religar**, então quem perdesse um arquivo via listras magenta
  sem saber que havia conserto sem refazer o alinhamento.
- O guia não dizia que zoom e pan são só do editor, nem que **enquadrar** devolve a saída
  inteira à tela — a saída de quem se perde no zoom.
- O bloco legível por rastreador piscava na tela antes do editor montar. Agora fica
  escondido desde antes da primeira pintura, e o `<noscript>` devolve a visibilidade
  para quem não executa JS — medido: zero frames com ele visível.
- Uma fonte que terminava de carregar depois de o loop de render dormir **nunca
  aparecia na parede**: nada marcava o frame como sujo. Coberto por AC-39, que lê o
  pixel sem forçar um frame — forçar esconderia exatamente esse bug.
- `patchSurface` aceitava valores que nenhum método nomeado aceitaria (opacidade 5,
  recorte vazio, encaixe inexistente). Todo caminho de escrita passa por um sanitizador
  único.
- Ids repetidos num `project.json` faziam toda busca acertar a errada e apagar as duas.

### Desempenho
- Homografia, triangulação e buffers de vértice passaram a ser calculados uma vez por
  versão da superfície, e não a cada frame. Trabalho de JS por frame com 30 superfícies
  (metade polígonos de 12 lados): **0,3 ms → 0,1 ms** de mediana, 0,7 → 0,2 ms de p95.
- O loop dorme de verdade: reconciliar o pool de fontes só acontece quando a lista muda.
- CSS de 105 KB para 80 KB restringindo daisyUI aos componentes realmente usados.

### Verificação
- Integração contínua num pipeline só: `testes → tipos → idioma → build → smoke →
  deploy`, com a publicação no Pages dependente de tudo que vem antes. Antes o deploy
  saía depois de apenas `npm test`, e pull request nenhum era verificado.
- 127 testes de unidade sem framework (`node:test`).
- 42 checagens de integração em chromium headless, lendo pixels do build real.
- `npm run i18n` reprova string fixa no editor e tradução que perdeu placeholder ou
  marcação.
