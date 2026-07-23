export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface RelayPolicy {
  allowedContracts?: string[];
  maxFeeMicroStx: bigint;
  rateLimit: RateLimitConfig;
}

export interface RelayConfig {
  sponsorPrivateKey: string;
  registrarPrivateKey?: string;
  masterSecret: string;
  sessionSecret: string;
  network: 'mainnet' | 'testnet' | 'devnet';
  port: number;
  host: string;
  apiKey?: string;
  adminApiKey?: string;
  gasTankPath?: string;
  policy: RelayPolicy;
}

export interface SponsorRequest {
  txHex: string;
}

export interface SponsorResult {
  txid: string;
  status: 'accepted' | 'rejected';
  reason?: string;
}
