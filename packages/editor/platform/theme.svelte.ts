/**
 * Tema claro/escuro, com 'sistema' como padrão.
 *
 * daisyUI resolve o tema por `data-theme` no elemento raiz. Sem o atributo, o
 * tema marcado com `--prefersdark` vale quando o sistema está no escuro — que é
 * exatamente o comportamento de "seguir o sistema", sem nenhuma linha de JS.
 * Por isso 'system' **remove** o atributo em vez de calcular a preferência.
 */
export type Theme = 'system' | 'light' | 'dark';

// O prefixo é um namespace de armazenamento, não o nome do produto. A
// ferramenta virou ProjMap e esta chave ficou de propósito: renomeá-la joga
// fora o tema escolhido por quem já usa. Só muda junto com uma migração.
const KEY = 'map-engine:theme';

function load(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch { /* modo privado sem storage: segue o sistema */ }
  return 'system';
}

export const theme = $state({ value: load() });

export function applyTheme(next: Theme): void {
  theme.value = next;
  const root = document.documentElement;
  if (next === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', next);
  try { localStorage.setItem(KEY, next); } catch { /* nada a fazer */ }
}

/** Chamado uma vez na montagem, para o atributo bater com o que foi salvo. */
export function initTheme(): void {
  applyTheme(theme.value);
}
