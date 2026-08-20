import type { Guide } from './types.ts';

export const guidePt: Guide = [
  {
    id: 'what',
    title: 'O que é isto',
    blocks: [
      { kind: 'p', text: 'Você aponta um projetor para uma coisa física — uma parede com quadros, uma pilha de caixas, uma janela, um móvel. Desenha formas por cima da projeção que coincidem com os objetos reais, e joga conteúdo dentro de cada forma.' },
      { kind: 'p', text: 'A regra que rege tudo: <b>preto é transparência</b>. Todo pixel preto é ausência de luz, então a superfície física aparece através dele. Fora das formas que você mapeou, nada é desenhado.' },
      { kind: 'note', text: 'Use Chrome ou Edge. Outros navegadores abrem o app, mas perdem o acesso à pasta, o controle de tempo do GIF e o posicionamento automático da tela.' },
    ],
  },
  {
    id: 'start',
    title: 'Primeira vez',
    blocks: [
      { kind: 'p', text: 'Seis passos, cerca de um minuto, nesta ordem.' },
      {
        kind: 'steps',
        items: [
          '<b>Abrir pasta</b> — escolha uma pasta vazia. O arquivo do projeto e a sua mídia ficam ali, e tudo é salvo sozinho.',
          '<b>Casar resolução com esta tela</b> — escolha o projetor na lista e clique. Isso faz o app trabalhar na resolução nativa dele.',
          '<b>Superfície</b> — aparece um retângulo. Arraste os quatro cantos até cobrirem o objeto real.',
          'Arraste um vídeo ou uma imagem <b>para cima da superfície</b> para preenchê-la.',
          '<b>Enviar para o projetor</b> — a projeção vai para a segunda tela e os controles ficam no seu notebook.',
          'Aperte <b>H</b> para esconder a interface. Aperte H de novo para trazê-la de volta.',
        ],
      },
      { kind: 'note', text: 'Iguale a resolução antes de alinhar. Alinhar primeiro e trocar a resolução depois joga fora o alinhamento.' },
    ],
  },
  {
    id: 'surfaces',
    title: 'Superfícies',
    blocks: [
      { kind: 'p', text: 'Uma superfície é um quadrilátero de quatro cantos. São eles que carregam a perspectiva: arraste até a borda projetada assentar na borda real, e o conteúdo se deforma junto.' },
      {
        kind: 'list',
        items: [
          'Arraste <b>dentro</b> da superfície para movê-la inteira; arraste um <b>canto</b> para deformá-la.',
          'Clique num canto e use as <b>setas do teclado</b> para movê-lo um pixel por vez. É esse ajuste que decide tudo.',
          'Sem canto selecionado, as setas movem a superfície inteira.',
          'O <b>ímã</b> gruda os cantos nos cantos das outras superfícies. Segure Ctrl para desligá-lo por um instante.',
          'Duplo clique num nome da lista para renomear. Uma lista de “Superfície 7” não ajuda ninguém.',
        ],
      },
      { kind: 'p', text: 'Cada linha da lista traz três chaves: <b>S</b> deixa a superfície em solo e apaga todas as outras, o <b>olho</b> apaga esta, e o <b>cadeado</b> trava.' },
      { kind: 'note', text: 'Trave a superfície assim que ela estiver alinhada. Esbarrar num canto já alinhado é o acidente mais caro que existe, e uma superfície travada recusa qualquer movimento — mouse, setas, tudo.' },
    ],
  },
  {
    id: 'shapes',
    title: 'Formas',
    blocks: [
      { kind: 'p', text: 'Dentro do quadrilátero cabe um recorte. O frame guarda a perspectiva; o recorte decide o que fica aceso.' },
      {
        kind: 'list',
        items: [
          '<b>Retângulo</b> — preenche o frame inteiro.',
          '<b>Elipse</b> — para objetos redondos, com uma borda suave que vai de uma linha dura a um esfumado largo.',
          '<b>Polígono</b> — clique na ferramenta polígono, clique em volta do objeto, duplo clique para fechar. Esc cancela.',
        ],
      },
      { kind: 'p', text: 'Mover o frame carrega o recorte junto, então alinhar nunca significa redesenhar a forma.' },
    ],
  },
  {
    id: 'mesh',
    title: 'Superfícies curvas',
    blocks: [
      { kind: 'p', text: 'Quatro cantos mapeiam um plano. Numa coluna, num arco ou numa parede com barriga eles acertam o contorno e erram o meio — o conteúdo escorrega conforme a superfície foge. A <b>malha livre</b> resolve isso.' },
      {
        kind: 'list',
        items: [
          'Abra <b>malha livre</b> no painel da superfície e crie uma. Nada muda ainda: malha nova nasce perfeitamente plana.',
          'Arraste os pontos violeta até o conteúdo assentar no objeto. Clique num deles e as setas movem 1 px, como num canto.',
          '<b>Puxar vizinhos</b> decide o quanto os pontos ao redor acompanham o que você arrasta. Baixe para ajustar um ponto só, aumente para moldar uma curva larga.',
          '<b>Curvo</b> passa uma superfície suave entre os pontos — é a escolha para qualquer coisa redonda. <b>Reto</b> mantém dobra dura, para vinco.',
          'Mais pontos de controle é mais controle fino. Trocar a quantidade preserva a forma que você já ajustou.',
        ],
      },
      { kind: 'note', text: '<b>Aplanar</b> desfaz todas as curvas sem remover a malha, e superfície travada recusa edição de malha exatamente como recusa canto.' },
    ],
  },
  {
    id: 'content',
    title: 'Conteúdo',
    blocks: [
      { kind: 'p', text: 'Solte um arquivo direto em cima de uma superfície, ou escolha uma fonte no painel Conteúdo. Uma fonte pode alimentar várias superfícies.' },
      {
        kind: 'list',
        items: [
          '<b>Arquivo</b> — imagem, vídeo ou GIF. Vídeos tocam em loop e sem som.',
          '<b>Cor</b> — uma cor sólida, o jeito mais rápido de conferir uma borda.',
          '<b>Captura de tela</b> — qualquer janela da máquina, ao vivo. Um jogo, um player, outra aba.',
          '<b>Câmera</b> — uma webcam ao vivo.',
          '<b>Módulo JS</b> — o seu próprio desenho generativo. Veja abaixo.',
        ],
      },
      { kind: 'p', text: 'Com conteúdo na superfície, quatro controles o moldam: <b>encaixe</b> (esticar ignora a proporção, caber mostra tudo e deixa preto na sobra, preencher cobre e corta), <b>rotação</b>, <b>opacidade</b> e <b>mistura</b>. Em <b>recorte dentro da fonte</b> você usa só um pedaço do arquivo, e <b>ordem de desenho</b> decide quem fica por cima quando duas superfícies se sobrepõem — as duas ficam recolhidas até você precisar delas.' },
      { kind: 'note', text: 'A rotação gira o conteúdo, nunca o frame — então é segura numa superfície que você já alinhou e travou.' },
    ],
  },
  {
    id: 'module',
    title: 'Seu próprio conteúdo em JavaScript',
    blocks: [
      { kind: 'p', text: 'Uma fonte <b>módulo JS</b> é qualquer arquivo <code>.js</code> que exporta uma função <code>draw</code>. O app a chama a cada frame com um contexto de canvas 2D e o tempo decorrido em segundos, e o que você pintar vira textura projetada.' },
      {
        kind: 'code',
        code: `export const size = [512, 512];

export function draw(ctx, t) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 512, 512);

  ctx.fillStyle = '#fff';
  const x = 256 + Math.cos(t) * 160;
  ctx.beginPath();
  ctx.arc(x, 256, 40, 0, Math.PI * 2);
  ctx.fill();
}`,
      },
      { kind: 'p', text: 'Salve na pasta do projeto e escolha pelo botão <b>módulo js</b>. Se ele der erro, a superfície mostra o padrão de mídia faltando em vez de derrubar o show.' },
    ],
  },
  {
    id: 'patterns',
    title: 'Padrões de teste',
    blocks: [
      { kind: 'p', text: 'Os padrões substituem o conteúdo para você enxergar o que está alinhando. Escolha um para tudo na barra de cima, ou um só para uma superfície no painel dela — o padrão da superfície ganha do global.' },
      {
        kind: 'list',
        items: [
          '<b>Grade</b> — mostra se a superfície está distorcida. Linha reta tem que continuar reta.',
          '<b>Número</b> — projeta a posição de cada superfície, para você saber em qual está mexendo.',
          '<b>Cruz</b> — centro e diagonais, para centralizar num objeto.',
          '<b>Branco</b> / <b>preto</b> — conferir a borda exata, e conferir o ponto de preto.',
          '<b>Barras de cor</b> — conferir cor e ajustes do projetor.',
          '<b>Varredura</b> — uma linha em movimento, para sentir a latência.',
        ],
      },
    ],
  },
  {
    id: 'output',
    title: 'Saída e telas',
    blocks: [
      { kind: 'p', text: '<b>Enviar para o projetor</b> abre uma janela limpa na tela escolhida: sem interface, sem cursor, sem borda. O editor fica onde está.' },
      {
        kind: 'list',
        items: [
          'Aperte <b>Esc</b> na janela de saída para fechá-la.',
          'Se o navegador bloquear o pop-up, libere pop-ups para esta página e tente de novo.',
          'Se ela não entrar em tela cheia, clique na janela de saída e aperte F11.',
          'Sem segunda tela, arraste a janela de saída até o projetor na mão.',
        ],
      },
      { kind: 'note', text: 'Em saída limpa, os únicos pixels acesos estão dentro das suas superfícies. Cubra a lente com a mão e a parede deve ficar totalmente escura.' },
    ],
  },
  {
    id: 'project',
    title: 'O projeto em disco',
    blocks: [
      { kind: 'p', text: 'Um projeto é uma pasta, não um arquivo. Dentro dela há um <code>project.json</code> com caminhos relativos e a mídia ao lado, que é o que sobrevive a ser copiado para um pendrive.' },
      {
        kind: 'list',
        items: [
          'O salvamento é automático, instantes depois de cada mudança.',
          'Os arquivos que você solta são copiados para a pasta, então o projeto carrega a própria mídia.',
          'Se um arquivo sumir, a superfície mostra listras magenta bem visíveis — nunca silêncio, e nunca luz em cima de um objeto físico sem nada por trás. Use <b>religar</b> no painel Conteúdo para apontar a fonte ao arquivo no novo lugar, sem refazer o alinhamento.',
          'Sem acesso à pasta, o projeto fica na memória do navegador e a mídia não sobrevive a um reinício. O app avisa quando isso acontece.',
        ],
      },
    ],
  },
  {
    id: 'keyboard',
    title: 'Teclado',
    blocks: [
      {
        kind: 'keys',
        rows: [
          ['↑ ↓ ← →', 'Move 1 px o canto ou o ponto de malha selecionado — ou a superfície inteira, sem nada selecionado'],
          ['Shift + setas', 'O mesmo, 10 px'],
          ['Ctrl (segurar)', 'Desliga o ímã enquanto estiver pressionado'],
          ['Ctrl+Z / Ctrl+Shift+Z', 'Desfazer / refazer'],
          ['Ctrl+D', 'Duplicar a superfície selecionada'],
          ['Delete', 'Apagar a superfície selecionada'],
          ['H', 'Esconder ou mostrar a interface'],
          ['Esc', 'Cancelar o polígono, largar a seleção de canto'],
          ['Roda do mouse', 'Zoom no ponto do cursor'],
          ['Botão do meio, ou Alt + arrastar', 'Pan'],
        ],
      },
      { kind: 'note', text: 'O zoom e o pan movem só a vista do editor, nunca a projeção. Se você se perder, <b>enquadrar</b> na barra de cima devolve a saída inteira à tela.' },
    ],
  },
];
