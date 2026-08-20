import type { Guide } from './types.ts';

export const guideEs: Guide = [
  {
    id: 'what',
    title: 'Qué es esto',
    blocks: [
      { kind: 'p', text: 'Apuntas un proyector a algo físico — una pared con cuadros, una pila de cajas, una ventana, un mueble. Dibujas formas sobre la proyección que coinciden con los objetos reales, y pones contenido dentro de cada forma.' },
      { kind: 'p', text: 'La regla que rige todo: <b>el negro es transparencia</b>. Cada píxel negro es ausencia de luz, así que la superficie física se ve a través de él. Fuera de las formas que mapeaste no se dibuja nada.' },
      { kind: 'note', text: 'Usa Chrome o Edge. Otros navegadores abren la aplicación, pero pierden el acceso a la carpeta, el control de tiempo del GIF y la ubicación automática de la pantalla.' },
    ],
  },
  {
    id: 'start',
    title: 'La primera vez',
    blocks: [
      { kind: 'p', text: 'Seis pasos, alrededor de un minuto, en este orden.' },
      {
        kind: 'steps',
        items: [
          '<b>Abrir carpeta</b> — elige una carpeta vacía. El archivo del proyecto y tus medios quedan ahí, y todo se guarda solo.',
          '<b>Igualar esta pantalla</b> — elige el proyector en la lista y haz clic. Así la aplicación trabaja en su resolución nativa.',
          '<b>Superficie</b> — aparece un rectángulo. Arrastra sus cuatro esquinas hasta cubrir el objeto real.',
          'Arrastra un video o una imagen <b>encima de la superficie</b> para llenarla.',
          '<b>Enviar al proyector</b> — la proyección va a la segunda pantalla y los controles se quedan en tu portátil.',
          'Presiona <b>H</b> para ocultar la interfaz. Presiona H otra vez para recuperarla.',
        ],
      },
      { kind: 'note', text: 'Iguala la resolución antes de alinear. Alinear primero y cambiar la resolución después tira el alineado a la basura.' },
    ],
  },
  {
    id: 'surfaces',
    title: 'Superficies',
    blocks: [
      { kind: 'p', text: 'Una superficie es un cuadrilátero de cuatro esquinas. Ellas llevan la perspectiva: arrástralas hasta que el borde proyectado se apoye en el borde real, y el contenido se deforma con ellas.' },
      {
        kind: 'list',
        items: [
          'Arrastra <b>dentro</b> de la superficie para moverla entera; arrastra una <b>esquina</b> para deformarla.',
          'Haz clic en una esquina y usa las <b>flechas del teclado</b> para moverla un píxel a la vez. Ese es el ajuste que lo decide todo.',
          'Sin ninguna esquina seleccionada, las flechas mueven toda la superficie.',
          'El <b>imán</b> pega las esquinas a las de otras superficies. Mantén Ctrl para desactivarlo un momento.',
          'Doble clic en un nombre de la lista para renombrarlo. Una lista de “Superficie 7” no le sirve a nadie.',
          '<b>Shift + clic</b> elige más de una, y arrastrar en el vacío hace un lazo alrededor de varias. Con varias elegidas, arrastrar las mueve todas — y <b>vincular</b> las deja así para siempre, incluso después de cerrar y reabrir el proyecto.',
          'En una selección con una superficie bloqueada, las desbloqueadas se mueven y la bloqueada se queda. Bloquear habla de ella, nunca del grupo.',
        ],
      },
      { kind: 'p', text: 'Cada fila de la lista trae tres controles: <b>S</b> deja la superficie en solo y apaga todas las demás, el <b>ojo</b> apaga esta, y el <b>candado</b> la bloquea.' },
      { kind: 'note', text: 'Bloquea la superficie apenas quede alineada. Mover sin querer una esquina ya alineada es el accidente más caro que hay, y una superficie bloqueada rechaza cualquier movimiento — ratón, flechas, todo.' },
    ],
  },
  {
    id: 'shapes',
    title: 'Formas',
    blocks: [
      { kind: 'p', text: 'Dentro del cuadrilátero cabe un recorte. El marco guarda la perspectiva; el recorte decide qué queda encendido.' },
      {
        kind: 'list',
        items: [
          '<b>Rectángulo</b> — llena todo el marco.',
          '<b>Elipse</b> — para objetos redondos, con un borde suave que va de una línea dura a un difuminado ancho.',
          '<b>Polígono</b> — haz clic en la herramienta polígono, haz clic alrededor del objeto, doble clic para cerrar. Esc cancela.',
        ],
      },
      { kind: 'p', text: 'Mover el marco lleva el recorte con él, así que alinear nunca significa volver a dibujar la forma.' },
    ],
  },
  {
    id: 'mesh',
    title: 'Superficies curvas',
    blocks: [
      { kind: 'p', text: 'Cuatro esquinas mapean un plano. En una columna, un arco o una pared abombada aciertan el contorno y fallan en el medio — el contenido se desliza a medida que la superficie se aleja. La <b>malla libre</b> lo resuelve.' },
      {
        kind: 'list',
        items: [
          'Abre <b>malla libre</b> en el panel de la superficie y crea una. Todavía no cambia nada: una malla nueva nace perfectamente plana.',
          'Arrastra los puntos violeta hasta que el contenido se apoye en el objeto. Haz clic en uno y las flechas lo mueven 1 px, como una esquina.',
          '<b>Arrastrar vecinos</b> decide cuánto acompañan los puntos de alrededor al que arrastras. Bájalo para ajustar un solo punto, súbelo para moldear una curva amplia.',
          '<b>Curvo</b> pasa una superficie suave entre los puntos — es la opción para cualquier cosa redonda. <b>Recto</b> mantiene pliegues duros, para un doblez.',
          'Más puntos de control es más control fino. Cambiar la cantidad conserva la forma que ya ajustaste.',
        ],
      },
      { kind: 'note', text: '<b>Aplanar</b> deshace todas las curvas sin quitar la malla, y una superficie bloqueada rechaza editar la malla igual que rechaza una esquina.' },
    ],
  },
  {
    id: 'content',
    title: 'Contenido',
    blocks: [
      { kind: 'p', text: 'Suelta un archivo directamente sobre una superficie, o elige una fuente en el panel Contenido. Una fuente puede alimentar varias superficies.' },
      {
        kind: 'list',
        items: [
          '<b>Archivo</b> — imagen, video o GIF. Los videos se repiten sin sonido.',
          '<b>Color</b> — un color sólido, la forma más rápida de comprobar un borde. La muestra abre un selector con los colores de comprobar proyector a mano: blanco, gris 50%, negro y las tres primarias puras.',
          '<b>Captura de pantalla</b> — cualquier ventana de la máquina, en vivo. Un juego, un reproductor, otra pestaña.',
          '<b>Cámara</b> — una webcam en vivo.',
          '<b>Módulo JS</b> — tu propio dibujo generativo. Mira más abajo.',
        ],
      },
      { kind: 'p', text: 'Con contenido en la superficie, cuatro controles lo moldean: <b>encaje</b> (estirar ignora la proporción, contener muestra todo y deja negro alrededor, cubrir llena y recorta), <b>rotación</b>, <b>opacidad</b> y <b>mezcla</b>. En <b>recorte dentro de la fuente</b> usas solo un trozo del archivo, y <b>orden de dibujo</b> decide quién queda encima cuando dos superficies se solapan — ambas quedan plegadas hasta que las necesites.' },
      { kind: 'note', text: 'La rotación gira el contenido, nunca el marco — así que es segura en una superficie que ya alineaste y bloqueaste.' },
    ],
  },
  {
    id: 'module',
    title: 'Tu propio contenido en JavaScript',
    blocks: [
      { kind: 'p', text: 'Una fuente <b>módulo JS</b> es cualquier archivo <code>.js</code> que exporta una función <code>draw</code>. La aplicación la llama en cada fotograma con un contexto de canvas 2D y el tiempo transcurrido en segundos, y lo que pintes se convierte en textura proyectada.' },
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
      { kind: 'p', text: 'Guárdalo en la carpeta del proyecto y elígelo con el botón <b>módulo js</b>. Si falla, la superficie muestra el patrón de medios faltantes en lugar de tumbar el espectáculo.' },
    ],
  },
  {
    id: 'patterns',
    title: 'Patrones de prueba',
    blocks: [
      { kind: 'p', text: 'Los patrones reemplazan el contenido para que veas lo que estás alineando. Elige uno para todo en la barra de arriba, o uno solo para una superficie en su panel — el patrón de la superficie le gana al global.' },
      {
        kind: 'list',
        items: [
          '<b>Cuadrícula</b> — muestra si la superficie está distorsionada. Una línea recta tiene que seguir recta.',
          '<b>Número</b> — proyecta la posición de cada superficie, para saber cuál estás tocando.',
          '<b>Cruz</b> — centro y diagonales, para centrar sobre un objeto.',
          '<b>Blanco</b> / <b>negro</b> — comprobar el borde exacto, y comprobar el punto de negro.',
          '<b>Barras de color</b> — comprobar el color y los ajustes del proyector.',
          '<b>Barrido</b> — una línea en movimiento, para sentir la latencia.',
        ],
      },
    ],
  },
  {
    id: 'output',
    title: 'Salida y pantallas',
    blocks: [
      { kind: 'p', text: '<b>Enviar al proyector</b> abre una ventana limpia en la pantalla elegida: sin interfaz, sin cursor, sin borde. El editor se queda donde está.' },
      {
        kind: 'list',
        items: [
          'Presiona <b>Esc</b> en la ventana de salida para cerrarla.',
          'Si el navegador bloquea la ventana emergente, permítelas para esta página e inténtalo de nuevo.',
          'Si no entra en pantalla completa, haz clic en la ventana de salida y presiona F11.',
          'Sin segunda pantalla, arrastra la ventana de salida al proyector a mano.',
        ],
      },
      { kind: 'note', text: 'En salida limpia, los únicos píxeles encendidos están dentro de tus superficies. Tapa el lente con la mano y la pared debe quedar completamente oscura.' },
    ],
  },
  {
    id: 'project',
    title: 'El proyecto en disco',
    blocks: [
      { kind: 'p', text: 'Un proyecto es una carpeta, no un archivo. Dentro hay un <code>project.json</code> con rutas relativas y los medios al lado, que es lo que sobrevive a copiarse en una memoria USB.' },
      {
        kind: 'list',
        items: [
          'El guardado es automático, instantes después de cada cambio.',
          'Los archivos que sueltas se copian a la carpeta, así que el proyecto lleva sus propios medios.',
          'Si un archivo desaparece, la superficie muestra franjas magenta bien visibles — nunca silencio, y nunca luz sobre un objeto físico sin nada detrás. Usa <b>revincular</b> en el panel Contenido para apuntar la fuente al archivo en su nuevo lugar, sin rehacer la alineación.',
          'Sin acceso a la carpeta, el proyecto queda en la memoria del navegador y los medios no sobreviven a un reinicio. La aplicación avisa cuando pasa.',
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
          ['↑ ↓ ← →', 'Mueve 1 px la esquina o el punto de malla seleccionado — o toda la superficie, sin nada seleccionado'],
          ['Shift + flechas', 'Lo mismo, 10 px'],
          ['Ctrl (mantener)', 'Desactiva el imán mientras se mantiene'],
          ['Ctrl+Z / Ctrl+Shift+Z', 'Deshacer / rehacer'],
          ['Ctrl+D', 'Duplicar la superficie seleccionada'],
          ['Supr', 'Borrar la superficie seleccionada'],
          ['H', 'Ocultar o mostrar la interfaz'],
          ['Esc', 'Cancelar el polígono, soltar la selección de esquina'],
          ['Rueda del ratón', 'Zoom en el punto del cursor'],
          ['Botón central, Ctrl, o Alt + arrastrar', 'Reencuadrar la vista'],
          ['Shift + clic', 'Agrega o quita de la selección'],
          ['Ctrl+A', 'Elige todas las superficies visibles'],
        ],
      },
      { kind: 'note', text: 'El zoom y el paneo mueven solo la vista del editor, nunca la proyección. Si te pierdes, <b>encuadrar</b> en la barra superior devuelve toda la salida a la pantalla.' },
    ],
  },
];
