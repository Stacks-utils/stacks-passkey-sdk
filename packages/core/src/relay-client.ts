import type { SponsorRequestOptions, SponsorResponse } from './types.js';
import { normalizeTxId } from './broadcast.js';

export interface RelayClientOptions {
  relayUrl: string;
  apiKey?: string;
}

export class RelayClient {
  private readonly relayUrl: string;
  private readonly apiKey?: string;

  constructor(options: RelayClientOptions) {
    this.relayUrl = options.relayUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
  }

  async sponsorTransaction(txHex: string, options?: SponsorRequestOptions): Promise<SponsorResponse> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    const response = await fetch(`${this.relayUrl}/sponsor`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ txHex, ...options }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Relay rejected transaction: ${response.status} ${body}`);
    }

    const result = (await response.json()) as SponsorResponse;
    if (result.status !== 'accepted' || !result.txid) {
      throw new Error(result.reason ?? 'Relay did not accept transaction');
    }
    return { ...result, txid: normalizeTxId(result.txid) };
  }

  async healthCheck(): Promise<{
    ok: boolean;
    sponsorAddress?: string;
    registrarAddress?: string;
    sponsorFeeMicroStx?: string;
    network?: string;
  }> {
    const response = await fetch(`${this.relayUrl}/health`);
    if (!response.ok) return { ok: false };
    return response.json() as Promise<{
      ok: boolean;
      sponsorAddress?: string;
      registrarAddress?: string;
      sponsorFeeMicroStx?: string;
      network?: string;
    }>;
  }

  async getProjectBalance(): Promise<{
    gasBalanceMicroStx: string;
    projectName?: string;
    gasTankAddress?: string;
    sponsorFeeMicroStx?: string;
  } | null> {
    if (!this.apiKey) return null;
    const response = await fetch(`${this.relayUrl}/v1/project`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!response.ok) return null;
    return response.json() as Promise<{
      gasBalanceMicroStx: string;
      projectName?: string;
      gasTankAddress?: string;
      sponsorFeeMicroStx?: string;
    }>;
  }

  async fetchAccountTemplate(): Promise<{
    contractName: string;
    source: string;
    clarityVersion: number;
  }> {
    const response = await fetch(`${this.relayUrl}/v1/accounts/template`);
    if (!response.ok) {
      throw new Error(`Failed to fetch account contract template: ${response.status}`);
    }
    return response.json() as Promise<{ contractName: string; source: string; clarityVersion: number }>;
  }

  async ensureContract(contractId: string): Promise<{
    contractId: string;
    registered: boolean;
    alreadyRegistered: boolean;
    functions: string[];
    registrationTxid?: string;
  }> {
    if (!this.apiKey) {
      throw new Error('ensureContract requires relayApiKey');
    }
    const response = await fetch(`${this.relayUrl}/v1/catalog/ensure`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ contractId }),
    });
    const body = (await response.json()) as { error?: string; contractId?: string };
    if (!response.ok) {
      throw new Error(body.error ?? `Catalog ensure failed: ${response.status}`);
    }
    return body as {
      contractId: string;
      registered: boolean;
      alreadyRegistered: boolean;
      functions: string[];
      registrationTxid?: string;
    };
  }

  async ensureAccount(
    publicKeyHex: string,
    options: {
      originAddress: string;
      contractName?: string;
    }
  ): Promise<{
    contractAddress: string;
    contractName: string;
    contractId: string;
    alreadyRegistered: boolean;
    originAddress: string;
    registerTxid?: string;
    factoryTxid?: string;
  }> {
    if (!this.apiKey) {
      throw new Error('ensureAccount requires relayApiKey');
    }
    const response = await fetch(`${this.relayUrl}/v1/accounts/ensure`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        publicKeyHex,
        originAddress: options.originAddress,
        contractName: options.contractName,
      }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(body.error ?? `Account ensure failed: ${response.status}`);
    }
    return body as {
      contractAddress: string;
      contractName: string;
      contractId: string;
      alreadyRegistered: boolean;
      originAddress: string;
      registerTxid?: string;
      factoryTxid?: string;
    };
  }
}
