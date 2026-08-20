import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restoreFrom, type Permissioned } from './project-folder.ts';

/** Um handle de mentira: o de verdade só sai de um diálogo do sistema, que
 *  nenhum teste consegue operar. */
function fakeHandle(opts: {
  permission: PermissionState;
  json?: string;
  missing?: boolean;
  onRequest?: () => void;
}): Permissioned {
  return {
    name: 'palco',
    async queryPermission() { return opts.permission; },
    async requestPermission() { opts.onRequest?.(); return opts.permission; },
    async getFileHandle() {
      if (opts.missing) {
        const e = new Error('no such file');
        e.name = 'NotFoundError';
        throw e;
      }
      if (opts.json === undefined) {
        const e = new Error('empty folder');
        e.name = 'NotFoundError';
        throw e;
      }
      return { async getFile() { return { async text() { return opts.json; } }; } };
    },
  } as unknown as Permissioned;
}

test('AC-56: a pasta permitida volta com o projeto já lido', async () => {
  const restored = await restoreFrom(fakeHandle({ permission: 'granted', json: '{"version":1}' }));
  assert.equal(restored?.state, 'granted');
  assert.equal(restored?.name, 'palco');
  assert.equal(restored?.state === 'granted' ? restored.json : null, '{"version":1}');
});

test('AC-57: permissão pendente não é escalada sozinha', async () => {
  let asked = false;
  const restored = await restoreFrom(fakeHandle({ permission: 'prompt', onRequest: () => { asked = true; } }));
  assert.equal(restored?.state, 'prompt', 'devolve o nome para a interface oferecer o clique');
  assert.equal(restored?.name, 'palco');
  assert.equal(asked, false, 'pedir permissão fora de um gesto do usuário é rejeitado pelo navegador');
});

test('AC-57: permissão negada não vira botão para insistir', async () => {
  assert.equal(await restoreFrom(fakeHandle({ permission: 'denied' })), null);
});

test('AC-58: handle cuja pasta sumiu é esquecido em vez de adotado', async () => {
  assert.equal(await restoreFrom(fakeHandle({ permission: 'granted', missing: true })), null);
});
