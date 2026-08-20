# Futuro — ideias além da v1

Este arquivo guarda ideias que **não** estão no brief e **não** são compromisso. Nada
aqui entra em [`TASKS.md`](TASKS.md), que só contém trabalho derivado do brief e dos
critérios de aceite. Uma ideia sai daqui quando alguém decidir fazê-la — aí ela vira
tarefa lá, com escopo e tamanho.

Regra para o que entra: precisa ter um problema real por trás, não uma tecnologia
procurando emprego.

---

## Auto-calibração por câmera (Rust/WASM)

**Status:** ideia. Nada implementado, nada decidido.

### O problema

Alinhar à mão é o custo real de usar a ferramenta. Trinta superfícies, quatro cantos
cada, com ajuste de 1 px no fim: são horas de trabalho em cima de uma escada. E o
trabalho é frágil — alguém esbarra no projetor, ou o tripé cede meio grau durante a
noite, e o alinhamento inteiro se perde. Hoje a única resposta é refazer.

### A ideia

Projetar um padrão conhecido, filmar com uma webcam apontada para a mesma superfície e
resolver as correspondências entre o que foi projetado e o que a câmera vê. Disso sai a
homografia de cada superfície automaticamente.

Três fases, em ordem de utilidade por esforço:

1. **Recalibrar uma superfície.** Padrão de tabuleiro projetado dentro de um frame que
   já existe, câmera detecta os cantos, corrige o frame. Resolve o caso do "esbarrei no
   projetor" sem resolver o caso do zero.
2. **Descobrir várias superfícies de uma vez.** Gray code projetado sobre a cena inteira
   dá a correspondência pixel a pixel entre projetor e câmera, e daí saem os frames de
   todas as superfícies visíveis.
3. **Re-snap.** Guardar a assinatura da cena calibrada e, ao reabrir o projeto, oferecer
   "realinhar" comparando com o que a câmera vê agora.

### Por que Rust aqui, e só aqui

É o único trecho do app que seria genuinamente limitado por CPU. Todo o resto é GPU
(shader, blend, rasterização) ou decoder nativo do navegador (vídeo, GIF) — reescrever
qualquer um desses em Rust otimizaria algo que já é código nativo, e no caso do WASM
ainda pioraria, porque obrigaria a trazer pixels para dentro da memória do módulo.

Detecção de marcadores, refinamento sub-pixel e decodificação de gray code são o
oposto: laços apertados sobre buffers de imagem, que ganham muito com SIMD e com
controle de alocação. É o caso de uso para o qual WASM existe.

### Como entraria sem quebrar a arquitetura

Este é o ponto que faz a ideia valer a pena registrar: **ela não toca no renderer nem
na engine.**

O módulo de calibração seria chamado pelo **editor**, receberia frames da webcam
(que já é uma fonte suportada) e devolveria quatro cantos. A aplicação do resultado é
uma linha:

```ts
store.setSurfaceFrame(id, corners);
```

Ou seja, a calibração é exatamente o que o brief chamou de "adaptador que chama os
métodos do store" — o mesmo ponto de extensão previsto para a ponte OSC. A engine
continua recebendo um `Project` e desenhando. Zero mudança em `renderer.ts`.

### O que precisa ser verdade antes de começar

- **A webcam precisa estar confiável em todo navegador alvo.** AC-30 ainda é
  `not-tested`: o caminho sem `requestVideoFrameCallback` só se prova em Firefox e
  Safari. Calibração em cima de uma fonte que congela é pior que calibração nenhuma.
- **Medir se JavaScript puro já resolve.** OpenCV.js existe e detecção de tabuleiro em
  uma imagem de 1080p não é tempo real — acontece uma vez, com o operador esperando.
  Se um segundo de processamento em JS for aceitável, Rust é otimização prematura.
  **Esta é a pergunta que decide a ideia inteira.**
- **O build tem que continuar degradando bem.** Um `.wasm` é um segundo arquivo, e o
  arquivo único é o diferencial nº 1 do projeto. O caminho já existe: os assets de
  instalação como aplicativo vivem em `public/` e o `index.html` funciona sem eles. A
  calibração teria que ser opcional do mesmo jeito — presente na versão instalada,
  ausente e avisada no arquivo avulso.
- **Licença compatível.** O projeto é AGPL-3.0. Qualquer crate ou porte de algoritmo
  precisa ser compatível com isso.

### Riscos

- **Tamanho.** Trazer OpenCV inteiro para dentro do bundle mata o argumento do arquivo
  pequeno. Escrever à mão só o que é usado (detecção de cantos, homografia — que já
  temos e testada em `homography.ts`) é mais trabalho e muito mais leve.
- **Condições físicas.** Iluminação ambiente, lente com distorção, webcam barata com
  auto-exposição brigando com o padrão projetado. Calibração que funciona no
  laboratório e falha no galpão é pior que não ter.
- **Complexidade de toolchain.** `wasm-pack` no build contradiz o "clone e `npm
  install`". Precisaria de artefato pré-compilado versionado, ou de um build opcional.

### A versão barata, que vem antes

Antes de qualquer visão computacional: um **assistente de alinhamento manual guiado**.
Projeta a cruz de centro numa superfície por vez, mostra qual canto está selecionado,
avança com uma tecla. Zero câmera, zero Rust, zero WASM — e resolve boa parte da dor
de "trinta superfícies em cima de uma escada". Se depois disso a auto-calibração ainda
parecer necessária, ela é necessária de verdade.
