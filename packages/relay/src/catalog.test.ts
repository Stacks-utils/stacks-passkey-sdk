import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CatalogStore } from './catalog.js';

describe('CatalogStore', () => {
  let dir: string;
  let store: CatalogStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'spk-catalog-'));
    store = new CatalogStore(join(dir, 'catalog.json'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('saves and lists contracts per project', () => {
    store.save({
      contractId: 'ST1PQ.my-app',
      projectId: 'proj-1',
      functions: ['passkey-exec', 'set-score'],
      registeredAt: new Date().toISOString(),
      registrationTxid: 'abc123',
    });
    const list = store.listForProject('proj-1');
    expect(list).toHaveLength(1);
    expect(list[0]?.contractId).toBe('ST1PQ.my-app');
  });

  it('finds cached registration', () => {
    store.save({
      contractId: 'ST1PQ.my-app',
      projectId: 'proj-1',
      functions: ['passkey-exec'],
      registeredAt: new Date().toISOString(),
      registrationTxid: 'abc123',
    });
    const found = store.find('proj-1', 'ST1PQ.my-app');
    expect(found?.registrationTxid).toBe('abc123');
  });
});
