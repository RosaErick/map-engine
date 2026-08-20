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

**Guia dentro do app**
- Página de documentação na barra de cima, com índice fixo que acompanha a leitura,
  em português, espanhol e inglês. Um teste garante que as três versões têm as mesmas
  seções, na mesma ordem, com a mesma contagem de passos e atalhos.

**Engine como biblioteca**
- `npm run build:lib` gera `dist-lib/map-engine.js` (55 KB, ESM, zero dependências)
  com declarações de tipo, e o pacote expõe `exports`/`types` — instalar direto do
  repositório funciona, sem publicar no npm.
- Exemplo executável em `examples/embed/`: um canvas, um `Project`, e frames saindo
  em trinta linhas.

**Distribuição**
- Build de arquivo único que abre por `file://`, sem servidor e sem rede.
- Instalação como aplicativo (PWA) com service worker versionado pelo hash do build.
- Publicação no GitHub Pages e Release com o `.html` avulso anexado.

### Verificação
- 37 testes de unidade sem framework (`node:test`).
- 18 checagens de integração em chromium headless, lendo pixels do build real.
- `npm run i18n` reprova string fixa no editor e tradução que perdeu placeholder ou
  marcação.
