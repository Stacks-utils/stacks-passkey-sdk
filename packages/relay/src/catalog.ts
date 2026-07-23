import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface CatalogEntry {
  contractId: string;
  projectId: string;
  functions: string[];
  registeredAt: string;
  registrationTxid?: string;
}

interface CatalogData {
  entries: CatalogEntry[];
  registrationCounts: Record<string, { day: string; count: number }>;
}

export class CatalogStore {
  private readonly filePath: string;
  private data: CatalogData;

  constructor(filePath: string) {
    this.filePath = filePath;
    mkdirSync(dirname(filePath), { recursive: true });
    this.data = this.load();
  }

  private load(): CatalogData {
    if (!existsSync(this.filePath)) {
      return { entries: [], registrationCounts: {} };
    }
    return JSON.parse(readFileSync(this.filePath, 'utf8')) as CatalogData;
  }

  private persist(): void {
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  find(projectId: string, contractId: string): CatalogEntry | null {
    return (
      this.data.entries.find((e) => e.projectId === projectId && e.contractId === contractId) ?? null
    );
  }

  listForProject(projectId: string): CatalogEntry[] {
    return this.data.entries.filter((e) => e.projectId === projectId);
  }

  save(entry: CatalogEntry): CatalogEntry {
    const idx = this.data.entries.findIndex(
      (e) => e.projectId === entry.projectId && e.contractId === entry.contractId
    );
    if (idx >= 0) this.data.entries[idx] = entry;
    else this.data.entries.push(entry);
    this.persist();
    return entry;
  }

  countRegistrationsToday(projectId: string): number {
    const day = new Date().toISOString().slice(0, 10);
    const row = this.data.registrationCounts[projectId];
    if (!row || row.day !== day) return 0;
    return row.count;
  }

  incrementRegistrationsToday(projectId: string): number {
    const day = new Date().toISOString().slice(0, 10);
    const row = this.data.registrationCounts[projectId];
    if (!row || row.day !== day) {
      this.data.registrationCounts[projectId] = { day, count: 1 };
    } else {
      row.count += 1;
    }
    this.persist();
    return this.data.registrationCounts[projectId].count;
  }

  countContracts(projectId: string): number {
    return this.data.entries.filter((e) => e.projectId === projectId).length;
  }
}

export function defaultCatalogPath(): string {
  return join(process.cwd(), 'data', 'catalog.json');
}
