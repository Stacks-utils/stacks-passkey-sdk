import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GasTankStore } from './gas-tank.js';

describe('GasTankStore', () => {
  let dir: string;
  let store: GasTankStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'gas-tank-'));
    store = new GasTankStore(join(dir, 'tank.json'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('creates projects with API keys and balance', () => {
    const project = store.createProject('Test', 2_000_000n);
    expect(project.name).toBe('Test');
    expect(project.apiKey.startsWith('spk_')).toBe(true);
    expect(project.gasBalanceMicroStx).toBe(2_000_000n);
  });

  it('deducts gas tank on gasless sponsor record', () => {
    const project = store.createProject('Test', 1_000_000n);
    const updated = store.recordSponsor(project.id, 50_000n, 'abc123', 'gasless');
    expect(updated.gasBalanceMicroStx).toBe(950_000n);
    expect(updated.totalSpentMicroStx).toBe(50_000n);
  });

  it('does not deduct gas tank on account-pay sponsor record', () => {
    const project = store.createProject('Test', 1_000_000n);
    const updated = store.recordSponsor(project.id, 50_000n, 'abc123', 'account-pay');
    expect(updated.gasBalanceMicroStx).toBe(1_000_000n);
    expect(updated.txCount).toBe(1);
  });

  it('refills project balance', () => {
    const project = store.createProject('Test', 100n);
    const updated = store.refill(project.id, 500n);
    expect(updated.gasBalanceMicroStx).toBe(600n);
  });
});
