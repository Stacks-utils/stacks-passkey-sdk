import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { apiKeyPrefix, generateApiKey, hashApiKey } from './crypto.js';
import { deriveSponsorAddress, deriveSponsorPrivateKey } from './sponsor-derivation.js';

export interface WalletRecord {
  id: string;
  ownerAddress: string;
  sponsorAddress: string;
  totalSpentMicroStx: bigint;
  reservedMicroStx: bigint;
  txCount: number;
  createdAt: string;
}

export interface ApiKeyRecord {
  id: string;
  walletId: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  revokedAt?: string;
  createdAt: string;
  /** Legacy v1 migration — plaintext lookup only */
  legacyPlaintext?: string;
}

export interface SponsorLogRecord {
  id: string;
  walletId: string;
  apiKeyId?: string;
  txid: string;
  feeMicroStx: bigint;
  billingMode: 'gasless' | 'account-pay';
  at: string;
}

export interface ResolvedApiKey {
  wallet: WalletRecord;
  apiKey: ApiKeyRecord;
  sponsorPrivateKey: string;
}

interface StoreDataV2 {
  version: 2;
  wallets: Array<{
    id: string;
    ownerAddress: string;
    sponsorAddress: string;
    totalSpentMicroStx: string;
    reservedMicroStx: string;
    txCount: number;
    createdAt: string;
  }>;
  apiKeys: Array<{
    id: string;
    walletId: string;
    name: string;
    keyHash: string;
    keyPrefix: string;
    revokedAt?: string;
    createdAt: string;
    legacyPlaintext?: string;
  }>;
  logs: Array<{
    id: string;
    walletId: string;
    apiKeyId?: string;
    txid: string;
    feeMicroStx: string;
    billingMode: 'gasless' | 'account-pay';
    at: string;
  }>;
}

interface LegacyStoreData {
  projects?: Array<{
    id: string;
    name: string;
    apiKey: string;
    gasTankAddress?: string;
    gasBalanceMicroStx: string;
    createdAt: string;
    totalSpentMicroStx: string;
    txCount: number;
  }>;
  logs?: Array<{
    id: string;
    projectId: string;
    txid: string;
    feeMicroStx: string;
    billingMode: 'gasless' | 'account-pay';
    at: string;
  }>;
}

/** @deprecated alias — GasTankStore is now wallet-scoped relay storage */
export type ProjectRecord = WalletRecord & { name?: string; apiKey?: string; gasTankAddress: string; gasBalanceMicroStx: bigint };

/** Local dev: keep plaintext so wallet owners can reveal keys in admin UI. */
export function devStoreApiKeys(): boolean {
  const flag = process.env.RELAY_DEV_STORE_API_KEYS?.trim().toLowerCase();
  if (flag === 'true' || flag === '1') return true;
  if (flag === 'false' || flag === '0') return false;
  return process.env.NODE_ENV !== 'production';
}

export class GasTankStore {
  private readonly filePath: string;
  private data: StoreDataV2;
  private readonly masterSecret: string;
  private readonly network: 'mainnet' | 'testnet';

  constructor(filePath: string, masterSecret: string, network: 'mainnet' | 'testnet' = 'testnet') {
    this.filePath = filePath;
    this.masterSecret = masterSecret;
    this.network = network;
    mkdirSync(dirname(filePath), { recursive: true });
    this.data = this.load();
  }

  private load(): StoreDataV2 {
    if (!existsSync(this.filePath)) {
      return { version: 2, wallets: [], apiKeys: [], logs: [] };
    }
    const raw = JSON.parse(readFileSync(this.filePath, 'utf8')) as StoreDataV2 | LegacyStoreData & StoreDataV2;
    if (raw.version === 2) return raw;
    return this.migrateFromV1(raw as unknown as LegacyStoreData);
  }

  private migrateFromV1(legacy: LegacyStoreData): StoreDataV2 {
    const data: StoreDataV2 = { version: 2, wallets: [], apiKeys: [], logs: [] };
    for (const project of legacy.projects ?? []) {
      const ownerAddress = `legacy:${project.id}`;
      const sponsorAddress =
        project.gasTankAddress ||
        deriveSponsorAddress(this.masterSecret, ownerAddress, this.network);
      const walletId = project.id;
      data.wallets.push({
        id: walletId,
        ownerAddress,
        sponsorAddress,
        totalSpentMicroStx: project.totalSpentMicroStx ?? '0',
        reservedMicroStx: '0',
        txCount: project.txCount ?? 0,
        createdAt: project.createdAt ?? new Date().toISOString(),
      });
      data.apiKeys.push({
        id: randomBytes(6).toString('hex'),
        walletId,
        name: project.name ?? 'Legacy project',
        keyHash: hashApiKey(project.apiKey),
        keyPrefix: apiKeyPrefix(project.apiKey),
        createdAt: project.createdAt ?? new Date().toISOString(),
        legacyPlaintext: project.apiKey,
      });
    }
    for (const log of legacy.logs ?? []) {
      data.logs.push({
        id: log.id,
        walletId: log.projectId,
        apiKeyId: undefined,
        txid: log.txid,
        feeMicroStx: log.feeMicroStx,
        billingMode: log.billingMode,
        at: log.at,
      });
    }
    this.data = data;
    this.persist();
    console.log(`[relay] Migrated ${data.wallets.length} legacy project(s) to wallet model`);
    return data;
  }

  private persist(): void {
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  private toWallet(row: StoreDataV2['wallets'][number]): WalletRecord {
    return {
      ...row,
      totalSpentMicroStx: BigInt(row.totalSpentMicroStx),
      reservedMicroStx: BigInt(row.reservedMicroStx),
    };
  }

  private toApiKey(row: StoreDataV2['apiKeys'][number]): ApiKeyRecord {
    return { ...row };
  }

  ensureWallet(ownerAddress: string): WalletRecord {
    const existing = this.data.wallets.find(
      (w) => w.ownerAddress.toLowerCase() === ownerAddress.toLowerCase()
    );
    if (existing) return this.toWallet(existing);

    const sponsorAddress = deriveSponsorAddress(this.masterSecret, ownerAddress, this.network);
    const wallet = {
      id: randomBytes(8).toString('hex'),
      ownerAddress,
      sponsorAddress,
      totalSpentMicroStx: '0',
      reservedMicroStx: '0',
      txCount: 0,
      createdAt: new Date().toISOString(),
    };
    this.data.wallets.push(wallet);
    this.persist();
    return this.toWallet(wallet);
  }

  getWalletByOwner(ownerAddress: string): WalletRecord | null {
    const row = this.data.wallets.find(
      (w) => w.ownerAddress.toLowerCase() === ownerAddress.toLowerCase()
    );
    return row ? this.toWallet(row) : null;
  }

  /** @deprecated use getWalletById */
  getById(id: string): WalletRecord | null {
    return this.getWalletById(id);
  }

  getWalletById(id: string): WalletRecord | null {
    const row = this.data.wallets.find((w) => w.id === id);
    return row ? this.toWallet(row) : null;
  }

  listWallets(): WalletRecord[] {
    return this.data.wallets.map((w) => this.toWallet(w));
  }

  /** @deprecated use listWallets */
  listProjects(): WalletRecord[] {
    return this.listWallets();
  }

  listApiKeys(walletId: string): ApiKeyRecord[] {
    return this.data.apiKeys
      .filter((k) => k.walletId === walletId && !k.revokedAt)
      .map((k) => this.toApiKey(k));
  }

  createApiKey(walletId: string, name: string): { apiKey: string; record: ApiKeyRecord } {
    const wallet = this.getWalletById(walletId);
    if (!wallet) throw new Error('Wallet not found');
    const apiKey = generateApiKey();
    const record = {
      id: randomBytes(6).toString('hex'),
      walletId,
      name,
      keyHash: hashApiKey(apiKey),
      keyPrefix: apiKeyPrefix(apiKey),
      createdAt: new Date().toISOString(),
      ...(devStoreApiKeys() ? { legacyPlaintext: apiKey } : {}),
    };
    this.data.apiKeys.push(record);
    this.persist();
    return { apiKey, record: this.toApiKey(record) };
  }

  canRevealApiKey(walletId: string, keyId: string): boolean {
    const row = this.data.apiKeys.find((k) => k.id === keyId && k.walletId === walletId && !k.revokedAt);
    return Boolean(row?.legacyPlaintext);
  }

  revealApiKey(walletId: string, keyId: string): string {
    const row = this.data.apiKeys.find((k) => k.id === keyId && k.walletId === walletId && !k.revokedAt);
    if (!row?.legacyPlaintext) {
      throw new Error('API key not retrievable — create a new key or use a copy saved at creation time');
    }
    return row.legacyPlaintext;
  }

  revokeApiKey(walletId: string, keyId: string): ApiKeyRecord {
    const row = this.data.apiKeys.find((k) => k.id === keyId && k.walletId === walletId);
    if (!row) throw new Error('API key not found');
    if (row.revokedAt) throw new Error('API key already revoked');
    row.revokedAt = new Date().toISOString();
    this.persist();
    return this.toApiKey(row);
  }

  resolveApiKey(apiKey: string): ResolvedApiKey | null {
    const hash = hashApiKey(apiKey);
    const row =
      this.data.apiKeys.find((k) => k.keyHash === hash && !k.revokedAt) ??
      this.data.apiKeys.find((k) => k.legacyPlaintext === apiKey && !k.revokedAt);
    if (!row) return null;
    const walletRow = this.data.wallets.find((w) => w.id === row.walletId);
    if (!walletRow) return null;
    const wallet = this.toWallet(walletRow);
    return {
      wallet,
      apiKey: this.toApiKey(row),
      sponsorPrivateKey: deriveSponsorPrivateKey(this.masterSecret, wallet.ownerAddress),
    };
  }

  /** @deprecated use resolveApiKey */
  getByApiKey(apiKey: string): ProjectRecord | null {
    const resolved = this.resolveApiKey(apiKey);
    if (!resolved) return null;
    return {
      ...resolved.wallet,
      id: resolved.wallet.id,
      name: resolved.apiKey.name,
      apiKey,
      gasTankAddress: resolved.wallet.sponsorAddress,
      gasBalanceMicroStx: 0n,
    };
  }

  reserveGas(walletId: string, amountMicroStx: bigint): WalletRecord {
    const row = this.data.wallets.find((w) => w.id === walletId);
    if (!row) throw new Error('Wallet not found');
    row.reservedMicroStx = (BigInt(row.reservedMicroStx) + amountMicroStx).toString();
    this.persist();
    return this.toWallet(row);
  }

  releaseReservation(walletId: string, amountMicroStx: bigint): WalletRecord {
    const row = this.data.wallets.find((w) => w.id === walletId);
    if (!row) throw new Error('Wallet not found');
    const next = BigInt(row.reservedMicroStx) - amountMicroStx;
    row.reservedMicroStx = (next > 0n ? next : 0n).toString();
    this.persist();
    return this.toWallet(row);
  }

  recordSponsor(
    walletId: string,
    feeMicroStx: bigint,
    txid: string,
    billingMode: 'gasless' | 'account-pay',
    apiKeyId?: string,
    reservedMicroStx?: bigint
  ): WalletRecord {
    const row = this.data.wallets.find((w) => w.id === walletId);
    if (!row) throw new Error('Wallet not found');

    if (reservedMicroStx && reservedMicroStx > 0n) {
      const next = BigInt(row.reservedMicroStx) - reservedMicroStx;
      row.reservedMicroStx = (next > 0n ? next : 0n).toString();
    }

    if (billingMode === 'gasless') {
      row.totalSpentMicroStx = (BigInt(row.totalSpentMicroStx) + feeMicroStx).toString();
    }

    row.txCount += 1;
    this.data.logs.unshift({
      id: randomBytes(6).toString('hex'),
      walletId,
      apiKeyId,
      txid,
      feeMicroStx: feeMicroStx.toString(),
      billingMode,
      at: new Date().toISOString(),
    });
    this.data.logs = this.data.logs.slice(0, 500);
    this.persist();
    return this.toWallet(row);
  }

  /** @deprecated virtual refill removed — deposit STX to sponsor address */
  refill(_walletId: string, _amountMicroStx: bigint): WalletRecord {
    throw new Error('Virtual refill is disabled. Deposit STX to your sponsor gas tank address on-chain.');
  }

  /** @deprecated use ensureWallet + createApiKey */
  createProject(name: string, _initialGasMicroStx = 0n, _gasTankAddress = ''): ProjectRecord {
    const ownerAddress = `legacy:${randomBytes(8).toString('hex')}`;
    const wallet = this.ensureWallet(ownerAddress);
    const { apiKey } = this.createApiKey(wallet.id, name);
    return {
      ...wallet,
      name,
      apiKey,
      gasTankAddress: wallet.sponsorAddress,
      gasBalanceMicroStx: 0n,
    };
  }

  getLogs(walletId?: string): SponsorLogRecord[] {
    return this.data.logs
      .filter((l) => !walletId || l.walletId === walletId)
      .map((l) => ({
        ...l,
        feeMicroStx: BigInt(l.feeMicroStx),
      }));
  }

  availableBalance(onChainMicroStx: bigint, wallet: WalletRecord): bigint {
    const available = onChainMicroStx - wallet.reservedMicroStx;
    return available > 0n ? available : 0n;
  }

  getSponsorCredentials(walletId: string): {
    wallet: WalletRecord;
    sponsorPrivateKey: string;
    sponsorAddress: string;
  } | null {
    const wallet = this.getWalletById(walletId);
    if (!wallet) return null;
    return {
      wallet,
      sponsorPrivateKey: deriveSponsorPrivateKey(this.masterSecret, wallet.ownerAddress),
      sponsorAddress: wallet.sponsorAddress,
    };
  }
}

export function defaultStorePath(): string {
  return join(process.cwd(), 'data', 'gas-tank.json');
}
