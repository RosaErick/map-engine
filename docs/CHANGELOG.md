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
- `npm run build:lib` gera `dist-lib/map-engine.js` (55 KB, ESM, zero dependências)
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

### Corrigido
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
- 62 testes de unidade sem framework (`node:test`).
- 19 checagens de integração em chromium headless, lendo pixels do build real.
- `npm run i18n` reprova string fixa no editor e tradução que perdeu placeholder ou
  marcação.
