/**
 * Guarda o handle da pasta do projeto entre sessões.
 *
 * Um `FileSystemDirectoryHandle` é serializável pelo algoritmo de clone
 * estruturado, então IndexedDB o aceita inteiro — `localStorage` não, porque só
 * guarda texto. Verificado que IndexedDB funciona e persiste em `file://`, que
 * é como a maioria vai abrir este app.
 *
 * O que este módulo NÃO guarda é a permissão. Ela é do navegador, e recuperá-la
 * é assunto de `project-folder.ts`.
 */

// O nome do banco é um namespace, não a marca. A ferramenta virou ProjMap e
// este nome ficou: renomeá-lo aponta o app para um banco vazio e a pasta do
// projeto de quem já usa some na primeira abertura depois da atualização.
// Se um dia mudar, tem que vir junto com uma migração que leia o nome antigo.
const DB = 'map-engine';
const STORE = 'handles';
const KEY = 'project-folder';

/** Uma promessa por sessão: abrir o banco a cada chamada seria trabalho repetido
 *  e uma corrida entre `upgradeneeded` concorrentes. */
let opening: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  opening ??= new Promise((resolve) => {
    // Modo privado e políticas de armazenamento podem recusar o banco inteiro.
    // Isso não é erro do usuário nem coisa que valha uma mensagem: é só uma
    // sessão sem memória de pasta.
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB, 1);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return opening;
}

/** Roda uma transação e devolve `null` em qualquer falha — nenhuma operação
 *  aqui vale interromper o que o usuário está fazendo. */
async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest,
): Promise<T | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => resolve(null);
      tx.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function rememberFolder(handle: FileSystemDirectoryHandle): Promise<void> {
  await withStore('readwrite', (store) => store.put(handle, KEY));
}

export async function recallFolder(): Promise<FileSystemDirectoryHandle | null> {
  return await withStore<FileSystemDirectoryHandle>('readonly', (store) => store.get(KEY));
}

export async function forgetFolder(): Promise<void> {
  await withStore('readwrite', (store) => store.delete(KEY));
}
