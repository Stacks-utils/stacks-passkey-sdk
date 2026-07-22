import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface ProjectRecord {
  id: string;
  name: string;
  apiKey: string;
  gasBalanceMicroStx: bigint;
  createdAt: string;
  totalSpentMicroStx: bigint;
  txCount: number;
}

export interface SponsorLogRecord {
  id: string;
  projectId: string;
  txid: string;
  feeMicroStx: bigint;
  billingMode: 'gasless' | 'account-pay';
  at: string;
}

interface StoreData {
  projects: Array<{
    id: string;
    name: string;
    apiKey: string;
    gasBalanceMicroStx: string;
    createdAt: string;
    totalSpentMicroStx: string;
    txCount: number;
  }>;
  logs: Array<{
    id: string;
    projectId: string;
    txid: string;
    feeMicroStx: string;
    billingMode: 'gasless' | 'account-pay';
    at: string;
  }>;
}

export class GasTankStore {
  private readonly filePath: string;
  private data: StoreData;

  constructor(filePath: string) {
    this.filePath = filePath;
    mkdirSync(dirname(filePath), { recursive: true });
    this.data = this.load();
  }

  private load(): StoreData {
    if (!existsSync(this.filePath)) {
      return { projects: [], logs: [] };
    }
    return JSON.parse(readFileSync(this.filePath, 'utf8')) as StoreData;
  }

  private persist(): void {
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  private toProject(row: StoreData['projects'][number]): ProjectRecord {
    return {
      ...row,
      gasBalanceMicroStx: BigInt(row.gasBalanceMicroStx),
      totalSpentMicroStx: BigInt(row.totalSpentMicroStx),
    };
  }

  listProjects(): ProjectRecord[] {
    return this.data.projects.map((p) => this.toProject(p));
  }

  getByApiKey(apiKey: string): ProjectRecord | null {
    const row = this.data.projects.find((p) => p.apiKey === apiKey);
    return row ? this.toProject(row) : null;
  }

  getById(id: string): ProjectRecord | null {
    const row = this.data.projects.find((p) => p.id === id);
    return row ? this.toProject(row) : null;
  }

  createProject(name: string, initialGasMicroStx = 1_000_000n): ProjectRecord {
    const apiKey = `spk_${randomBytes(24).toString('hex')}`;
    const project = {
      id: randomBytes(8).toString('hex'),
      name,
      apiKey,
      gasBalanceMicroStx: initialGasMicroStx.toString(),
      createdAt: new Date().toISOString(),
      totalSpentMicroStx: '0',
      txCount: 0,
    };
    this.data.projects.push(project);
    this.persist();
    return this.toProject(project);
  }

  refill(projectId: string, amountMicroStx: bigint): ProjectRecord {
    const row = this.data.projects.find((p) => p.id === projectId);
    if (!row) throw new Error('Project not found');
    row.gasBalanceMicroStx = (BigInt(row.gasBalanceMicroStx) + amountMicroStx).toString();
    this.persist();
    return this.toProject(row);
  }

  recordSponsor(projectId: string, feeMicroStx: bigint, txid: string, billingMode: 'gasless' | 'account-pay'): ProjectRecord {
    const row = this.data.projects.find((p) => p.id === projectId);
    if (!row) throw new Error('Project not found');

    if (billingMode === 'gasless') {
      const balance = BigInt(row.gasBalanceMicroStx);
      if (balance < feeMicroStx) {
        throw new Error(`Insufficient gas tank balance: have ${balance}, need ${feeMicroStx}`);
      }
      row.gasBalanceMicroStx = (balance - feeMicroStx).toString();
      row.totalSpentMicroStx = (BigInt(row.totalSpentMicroStx) + feeMicroStx).toString();
    }

    row.txCount += 1;
    this.data.logs.unshift({
      id: randomBytes(6).toString('hex'),
      projectId,
      txid,
      feeMicroStx: feeMicroStx.toString(),
      billingMode,
      at: new Date().toISOString(),
    });
    this.data.logs = this.data.logs.slice(0, 500);
    this.persist();
    return this.toProject(row);
  }

  /** @deprecated use recordSponsor */
  charge(projectId: string, feeMicroStx: bigint, txid: string, billingMode: 'gasless' | 'account-pay'): ProjectRecord {
    return this.recordSponsor(projectId, feeMicroStx, txid, billingMode);
  }

  getLogs(projectId?: string): SponsorLogRecord[] {
    return this.data.logs
      .filter((l) => !projectId || l.projectId === projectId)
      .map((l) => ({
        ...l,
        feeMicroStx: BigInt(l.feeMicroStx),
      }));
  }
}

export function defaultStorePath(): string {
  return join(process.cwd(), 'data', 'gas-tank.json');
}
