import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface AccountRecord {
  publicKeyHex: string;
  contractAddress: string;
  contractName: string;
  contractId: string;
  projectId: string;
  registerTxid?: string;
  factoryTxid?: string;
  createdAt: string;
}

interface AccountStoreFile {
  accounts: AccountRecord[];
}

export function defaultAccountsPath(): string {
  return join(process.cwd(), 'data', 'accounts.json');
}

export class AccountStore {
  constructor(private readonly path: string) {}

  private load(): AccountStoreFile {
    if (!existsSync(this.path)) return { accounts: [] };
    return JSON.parse(readFileSync(this.path, 'utf8')) as AccountStoreFile;
  }

  private persist(data: AccountStoreFile): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, `${JSON.stringify(data, null, 2)}\n`);
  }

  find(projectId: string, publicKeyHex: string): AccountRecord | undefined {
    const normalized = publicKeyHex.toLowerCase().replace(/^0x/, '');
    return this.load().accounts.find(
      (a) => a.projectId === projectId && a.publicKeyHex.toLowerCase() === normalized
    );
  }

  save(record: AccountRecord): void {
    const data = this.load();
    const normalized = record.publicKeyHex.toLowerCase().replace(/^0x/, '');
    const next = data.accounts.filter(
      (a) => !(a.projectId === record.projectId && a.publicKeyHex.toLowerCase() === normalized)
    );
    next.push({ ...record, publicKeyHex: normalized });
    this.persist({ accounts: next });
  }

  count(projectId: string): number {
    return this.load().accounts.filter((a) => a.projectId === projectId).length;
  }
}
