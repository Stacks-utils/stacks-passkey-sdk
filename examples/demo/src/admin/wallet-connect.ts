import {
  connect,
  DEFAULT_PROVIDERS,
  request,
  clearSelectedProviderId,
  setSelectedProviderId,
} from '@stacks/connect';
import { getInstalledProviders, getProviderFromId } from '@stacks/connect-ui';
import { defineCustomElements } from '@stacks/connect-ui/loader';

export type WalletOption = {
  id: string;
  name: string;
  available: boolean;
};

declare global {
  interface Window {
    LeatherProvider?: ProviderLike;
    leather?: ProviderLike;
    StacksProvider?: ProviderLike;
    wbip_providers?: Array<{ id: string; name: string }>;
    webbtc_stx_providers?: Array<{ id: string; name: string }>;
  }
}

type ProviderLike = {
  request?: (method: string, params?: unknown) => Promise<unknown>;
  isLeather?: boolean;
};

type AddressResult = {
  addresses: Array<{ address: string; symbol?: string; publicKey?: string }>;
};

export const APPROVED_WALLET_IDS = ['LeatherProvider', 'XverseProviders.BitcoinProvider'] as const;

export const PRIMARY_WALLET_IDS = APPROVED_WALLET_IDS;

let uiReady: Promise<void> | undefined;

export async function ensureConnectUiReady(): Promise<void> {
  if (typeof window === 'undefined') return;
  uiReady ??= defineCustomElements(window).then(() => undefined);
  await uiReady;
  await customElements.whenDefined('connect-modal');
}

export function initConnectUi(): void {
  void ensureConnectUiReady();
}

export function isBraveBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return Boolean((navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } }).brave);
}

export function resolveProvider(providerId: string): ProviderLike | null {
  if (typeof window === 'undefined') return null;

  const fromConnect = getProviderFromId(providerId) as ProviderLike | undefined;
  if (fromConnect?.request) return fromConnect;

  if (providerId === 'LeatherProvider') {
    return window.LeatherProvider ?? window.leather ?? null;
  }

  if (providerId === 'StacksProvider') {
    return window.StacksProvider ?? null;
  }

  const nested = providerId.split('.').reduce<unknown>(
    (acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined),
    window as unknown
  );
  if (nested && typeof nested === 'object' && 'request' in nested) {
    return nested as ProviderLike;
  }

  return fromConnect ?? null;
}

export function listWalletOptions(): WalletOption[] {
  const byId = new Map<string, WalletOption>();

  for (const wallet of DEFAULT_PROVIDERS) {
    if (wallet.id === 'WalletConnectProvider') continue;
    if (!(APPROVED_WALLET_IDS as readonly string[]).includes(wallet.id)) continue;
    byId.set(wallet.id, {
      id: wallet.id,
      name: wallet.name,
      available: Boolean(resolveProvider(wallet.id)),
    });
  }

  for (const wallet of [...(window.wbip_providers ?? []), ...(window.webbtc_stx_providers ?? [])]) {
    if (!wallet.id || wallet.id === 'WalletConnectProvider') continue;
    if (!(APPROVED_WALLET_IDS as readonly string[]).includes(wallet.id)) continue;
    byId.set(wallet.id, {
      id: wallet.id,
      name: wallet.name,
      available: Boolean(resolveProvider(wallet.id)),
    });
  }

  return [...byId.values()].sort((a, b) => Number(b.available) - Number(a.available));
}

function pickStxAddress(result: AddressResult): string {
  const stx =
    result.addresses.find((a) => a.symbol === 'STX') ??
    result.addresses.find((a) => /^ST[0-9A-Z]/i.test(a.address) || /^SP[0-9A-Z]/i.test(a.address)) ??
    result.addresses[0];
  if (!stx?.address) throw new Error('No STX address returned from wallet');
  return stx.address;
}

function providerRequestOpts(provider: ProviderLike) {
  return {
    provider: provider as never,
    forceWalletSelect: false,
    enableLocalStorage: true,
    enableOverrides: true,
  };
}

/** Single wallet request — no method retries (each retry opens another Leather popup). */
async function requestAddresses(providerId: string, network: string): Promise<string> {
  const provider = resolveProvider(providerId);
  if (!provider) {
    throw new Error(`${providerId} is not installed. Unlock the wallet extension and refresh this page.`);
  }

  setSelectedProviderId(providerId);
  const result = await request(providerRequestOpts(provider), 'getAddresses', { network });
  return pickStxAddress(result);
}

export function isLeatherAvailable(): boolean {
  return Boolean(resolveProvider('LeatherProvider'));
}

/** Brave: one direct Leather call on button click. */
export function connectLeatherDirect(network: string): Promise<string> {
  clearSelectedProviderId();
  const provider = resolveProvider('LeatherProvider');
  if (!provider?.request) {
    throw new Error(
      'Leather extension not reachable. Unlock Leather in your toolbar, then refresh this page.'
    );
  }

  setSelectedProviderId('LeatherProvider');
  return Promise.resolve(provider.request('getAddresses', { network })).then((result) =>
    pickStxAddress(result as AddressResult)
  );
}

type SignResult = { signature: string; publicKey: string };

export function signLeatherDirect(plainMessage: string): Promise<SignResult> {
  const provider = resolveProvider('LeatherProvider');
  if (!provider?.request) {
    throw new Error('Leather extension not reachable. Unlock Leather and try again.');
  }

  setSelectedProviderId('LeatherProvider');
  return Promise.resolve(
    provider.request('stx_signMessage', { message: plainMessage })
  ).then((result) => result as SignResult);
}

/** Chrome/other: one Stacks Connect modal + one getAddresses call. */
export async function connectWithModal(network: string): Promise<string> {
  await ensureConnectUiReady();
  clearSelectedProviderId();
  const result = await connect({
    forceWalletSelect: true,
    enableLocalStorage: true,
    enableOverrides: true,
    approvedProviderIds: [...APPROVED_WALLET_IDS],
    network: network as 'testnet' | 'mainnet',
  });
  return pickStxAddress(result);
}

export async function connectWithProvider(providerId: string, network: string): Promise<string> {
  clearSelectedProviderId();
  return requestAddresses(providerId, network);
}

export function listInstalledProviderNames(): string[] {
  const defaults = DEFAULT_PROVIDERS.filter((p) => p.id !== 'WalletConnectProvider');
  return filterApprovedProviders(getInstalledProviders(defaults)).map((p) => p.name);
}

function filterApprovedProviders<T extends { id: string }>(providers: T[]): T[] {
  return providers.filter((p) => (APPROVED_WALLET_IDS as readonly string[]).includes(p.id));
}
