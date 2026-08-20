# Engine embutida

Mostra o que a engine é sem o editor: um canvas, um `Project`, e frames saindo.

```bash
npm run build:lib   # gera dist-lib/
npm run example     # abre http://localhost:5174
```

O host fornece duas coisas que a engine não tem como saber sozinha:

- **`resolveUrl(path)`** — como um caminho relativo do projeto vira uma URL
  carregável. Aqui é uma URL relativa; no editor é um blob vindo da pasta escolhida
  pelo usuário.
- **`loadModule(id)`** — como um id vira um módulo com `draw(ctx, t)`. Aqui está
  embutido no arquivo; no editor é um `.js` lido da pasta do projeto.

Depois disso, toda mutação passa por métodos do store — `engine.store.setCorner(...)`,
`setSurfaceSource(...)`, `undo()` — que é o que faz uma ponte OSC futura ser só um
adaptador.
