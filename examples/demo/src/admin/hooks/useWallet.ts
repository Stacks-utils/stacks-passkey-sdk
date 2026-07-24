import { useCallback, useEffect, useState } from 'react';
import {
  clearSelectedProviderId,
  disconnect,
  getLocalStorage,
  getSelectedProvider,
  getSelectedProviderId,
  isConnected,
  request,
} from '@stacks/connect';
import { Cl } from '@stacks/transactions';
import {
  clearSessionToken,
  fetchAuthChallenge,
  fetchHealth,
  getSessionAddress,
  getSessionToken,
  setSessionToken,
  verifyAuth,
  type AuthChallenge,
} from '../api.js';
import {
  connectLeatherDirect,
  connectWithModal,
  initConnectUi,
  isBraveBrowser,
  isLeatherAvailable,
  listWalletOptions,
  resolveProvider,
  signLeatherDirect,
  type WalletOption,
} from '../wallet-connect.js';

const SIGN_TIMEOUT_MS = 120_000;
const network = (import.meta.env.VITE_STACKS_NETWORK as string | undefined) === 'mainnet' ? 'mainnet' : 'testnet';

export type WalletPhase = 'idle' | 'connecting' | 'signing';

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function readConnectedAddress(): string | null {
  if (!isConnected()) return null;
  const stored = getLocalStorage();
  return stored?.addresses?.stx?.[0]?.address ?? stored?.addresses?.[0]?.address ?? null;
}

function resolveActiveProvider() {
  const providerId = getSelectedProviderId();
  if (providerId) {
    const resolved = resolveProvider(providerId);
    if (resolved) return resolved;
  }
  return getSelectedProvider() ?? null;
}

function buildClarityFromChallenge(challenge: AuthChallenge) {
  const domain = Cl.tuple({
    name: Cl.stringAscii(challenge.domain.name),
    version: Cl.stringAscii(challenge.domain.version),
    'chain-id': Cl.uint(challenge.domain['chain-id']),
  });
  const message = Cl.tuple({
    action: Cl.stringAscii(challenge.message.action),
    address: Cl.stringAscii(challenge.message.address),
    nonce: Cl.stringAscii(challenge.message.nonce),
    expires: Cl.uint(challenge.message.expires),
  });
  return { domain, message };
}

async function signChallenge(stxAddress: string): Promise<void> {
  const connected = readConnectedAddress();
  if (connected && connected !== stxAddress) {
    throw new Error(
      `Wallet mismatch: UI shows ${stxAddress.slice(0, 8)}… but Leather is on ${connected.slice(0, 8)}…. Disconnect and connect again.`
    );
  }

  const challenge = await fetchAuthChallenge(stxAddress);
  const { domain, message } = buildClarityFromChallenge(challenge);

  let signature: string;
  let publicKey: string;
  let mode: 'structured' | 'plain' = 'structured';

  const provider = resolveActiveProvider();
  if (!provider && !isBraveBrowser()) {
    throw new Error('No wallet selected. Click Connect wallet and choose Leather.');
  }

  if (isBraveBrowser()) {
    const signed = await signLeatherDirect(challenge.plainMessage);
    signature = signed.signature;
    publicKey = signed.publicKey;
    mode = 'plain';
  } else {
    const requestOpts = { provider: provider as never, forceWalletSelect: false, enableOverrides: true };
    try {
      const structured = await request(requestOpts, 'stx_signStructuredMessage', { message, domain });
      signature = structured.signature;
      publicKey = structured.publicKey;
    } catch {
      const plain = await request(requestOpts, 'stx_signMessage', { message: challenge.plainMessage });
      signature = plain.signature;
      publicKey = plain.publicKey;
      mode = 'plain';
    }
  }

  const session = await verifyAuth({
    address: stxAddress,
    signature,
    publicKey,
    nonce: challenge.nonce,
    expiresAt: challenge.expiresAt,
    mode,
    plainMessage: challenge.plainMessage,
  });
  setSessionToken(session.sessionToken, session.expiresAt, session.address);
}

export function useWalletGate() {
  const [address, setAddress] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [phase, setPhase] = useState<WalletPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [networkName, setNetworkName] = useState<string | undefined>();
  const [walletOptions, setWalletOptions] = useState<WalletOption[]>([]);
  const [isBrave] = useState(() => isBraveBrowser());
  const [leatherReady, setLeatherReady] = useState(() => isLeatherAvailable());

  const refreshWallets = useCallback(() => {
    initConnectUi();
    setWalletOptions(listWalletOptions());
    setLeatherReady(isLeatherAvailable());
  }, []);

  const restoreSession = useCallback(async () => {
    refreshWallets();
    try {
      const health = await fetchHealth();
      setNetworkName(health.network);
    } catch {
      setNetworkName(undefined);
    }

    const token = getSessionToken();
    const sessionAddress = getSessionAddress();
    const connected = readConnectedAddress();

    if (token && connected && sessionAddress && sessionAddress === connected) {
      setAddress(connected);
      setAuthorized(true);
      setError(null);
      return;
    }

    if (token) clearSessionToken();
    if (connected) setAddress(connected);
  }, [refreshWallets]);

  useEffect(() => {
    void restoreSession();
    const timer = window.setInterval(refreshWallets, 800);
    const stop = window.setTimeout(() => window.clearInterval(timer), 8000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [restoreSession, refreshWallets]);

  const runSignIn = useCallback(async (stxAddress: string) => {
    setPhase('signing');
    setError(null);
    try {
      await withTimeout(
        signChallenge(stxAddress),
        SIGN_TIMEOUT_MS,
        'Signing timed out. Approve the sign-in message in Leather.'
      );
      setAddress(stxAddress);
      setAuthorized(true);
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Sign in failed';
      setError(message);
      setAuthorized(false);
      clearSessionToken();
      throw e;
    } finally {
      setPhase('idle');
    }
  }, []);

  const signIn = useCallback(
    async (stxAddress?: string) => {
      const target = stxAddress ?? address;
      if (!target) throw new Error('Connect a wallet first');
      await runSignIn(target);
    },
    [address, runSignIn]
  );

  const connectWallet = useCallback(() => {
    setError(null);
    setPhase('connecting');
    clearSessionToken();
    setAuthorized(false);

    void fetchHealth()
      .then((health) => setNetworkName(health.network))
      .catch(() => undefined);

    const walletPromise = isBrave ? connectLeatherDirect(network) : connectWithModal(network);

    void withTimeout(
      walletPromise,
      SIGN_TIMEOUT_MS,
      'Connection timed out. Approve the request in Leather, then try again.'
    )
      .then(async (stx) => {
        setAddress(stx);
        setPhase('signing');
        // Brief pause so the extension can finish the connect flow before sign opens.
        await new Promise((resolve) => window.setTimeout(resolve, 300));
        await runSignIn(stx);
      })
      .catch((e) => {
        const message = e instanceof Error ? e.message : 'Wallet connection failed';
        setError(message);
        setAuthorized(false);
        clearSessionToken();
        setPhase('idle');
      });
  }, [isBrave, runSignIn]);

  const disconnectWallet = useCallback(() => {
    disconnect();
    clearSelectedProviderId();
    clearSessionToken();
    setAddress(null);
    setAuthorized(false);
    setError(null);
    setPhase('idle');
  }, []);

  const busy = phase !== 'idle';
  const detectedCount = walletOptions.filter((w) => w.available).length;
  const signReady = Boolean(address) && !authorized && phase !== 'signing';

  return {
    address,
    authorized,
    connecting: busy,
    phase,
    error,
    network: networkName,
    walletOptions,
    detectedCount,
    isBrave,
    leatherReady,
    signReady,
    connectWallet,
    refreshWallets,
    signIn,
    disconnectWallet,
  };
}
