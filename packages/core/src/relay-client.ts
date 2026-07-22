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

  async healthCheck(): Promise<{ ok: boolean; sponsorAddress?: string; network?: string }> {
    const response = await fetch(`${this.relayUrl}/health`);
    if (!response.ok) return { ok: false };
    return response.json() as Promise<{ ok: boolean; sponsorAddress?: string; network?: string }>;
  }

  async getProjectBalance(): Promise<{ gasBalanceMicroStx: string; projectName?: string } | null> {
    if (!this.apiKey) return null;
    const response = await fetch(`${this.relayUrl}/v1/project`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!response.ok) return null;
    return response.json() as Promise<{ gasBalanceMicroStx: string; projectName?: string }>;
  }
}
