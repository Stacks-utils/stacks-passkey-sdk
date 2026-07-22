import { StrictMode, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PasskeyProvider, usePasskeyAccount, usePasskeyClient } from '@stacks-passkey/react';
import { STACKS_TESTNET } from '@stacks/network';
import type { FeeMode } from '@stacks-passkey/core';
import { testnetConfig } from './config.js';
import { addressExplorerUrl, contractExplorerUrl, txExplorerUrl } from './explorer.js';
type ContractInteraction = {
  label: string;
  functionName: string;
  txid: string;
  at: string;
  status?: string;
  feeMode: FeeMode;
};

const INTERACTIONS_KEY = 'passkey-demo-interactions';
const TERMINAL_TX_STATUSES = new Set(['success', 'abort_by_response', 'failed']);

function loadStoredInteractions(): ContractInteraction[] {
  try {
    const raw = sessionStorage.getItem(INTERACTIONS_KEY);
    return raw ? (JSON.parse(raw) as ContractInteraction[]) : [];
  } catch {
    return [];
  }
}

function storeInteractions(items: ContractInteraction[]) {
  sessionStorage.setItem(INTERACTIONS_KEY, JSON.stringify(items));
}

function isTerminalTxStatus(status?: string): boolean {
  return status !== undefined && TERMINAL_TX_STATUSES.has(status);
}

async function fetchTxStatusOnce(txid: string): Promise<string | null> {
  const id = txid.startsWith('0x') ? txid.slice(2) : txid;
  try {
    const res = await fetch(`${STACKS_TESTNET.client.baseUrl}/extended/v1/tx/${id}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { tx_status: string };
    return data.tx_status;
  } catch {
    return null;
  }
}

async function pollTxStatus(txid: string, maxAttempts = 45, intervalMs = 2000): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await fetchTxStatusOnce(txid);
    if (status && isTerminalTxStatus(status)) return status;
    if (attempt < maxAttempts - 1) await new Promise((r) => setTimeout(r, intervalMs));
  }
  const last = await fetchTxStatusOnce(txid);
  if (last && isTerminalTxStatus(last)) return last;
  return last ?? 'not found';
}

function StatusPill({ status }: { status?: string }) {
  const display =
    !status || status === 'pending' ? 'confirming…' : status === 'not found' ? 'not found' : status;
  const variant =
    status === 'success'
      ? 'status-success'
      : status === 'abort_by_response' || status === 'failed'
        ? 'status-failed'
        : status === 'not found'
          ? 'status-failed'
          : !status || status === 'pending'
            ? 'status-pending'
            : 'status-unknown';
  return <span className={`status-pill ${variant}`}>{display}</span>;
}

function ExplorerLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="detail-row">
      <label>{label}</label>
      <div className="value">{value}</div>
    </div>
  );
}

function PasskeyIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M7 11v1a5 5 0 0 0 10 0v-1" />
      <path d="M12 17v3" />
      <path d="M8 20h8" />
      <rect x="3" y="11" width="18" height="10" rx="2" />
    </svg>
  );
}

function DemoApp({ feeMode }: { feeMode: FeeMode }) {
  const client = usePasskeyClient();
  const { session, isRegistered, loading, error, register, signIn, logout, transfer, gasBalance } =
    usePasskeyAccount();
  const [interactions, setInteractions] = useState<ContractInteraction[]>(() => loadStoredInteractions());
  const [contractBalance, setContractBalance] = useState<string | null>(null);
  const pollingTxids = useRef(new Set<string>());

  const contractId = `${testnetConfig.contractAddress}.${testnetConfig.contractName}`;
  const originAddress = client.getOriginAddress();

  const fetchContractBalance = useCallback(async () => {
    try {
      const res = await fetch(`${STACKS_TESTNET.client.baseUrl}/extended/v1/address/${contractId}/stx`);
      if (!res.ok) return;
      const data = (await res.json()) as { balance: string };
      setContractBalance(`${Number(BigInt(data.balance)) / 1_000_000} STX`);
    } catch {
      setContractBalance(null);
    }
  }, [contractId]);

  const updateInteractionStatus = useCallback((txid: string, status: string) => {
    setInteractions((prev) => {
      const next = prev.map((item) => (item.txid === txid ? { ...item, status } : item));
      storeInteractions(next);
      return next;
    });
  }, []);

  const startPollingTx = useCallback(
    (txid: string) => {
      if (pollingTxids.current.has(txid)) return;
      pollingTxids.current.add(txid);
      void pollTxStatus(txid).then((status) => {
        pollingTxids.current.delete(txid);
        updateInteractionStatus(txid, status);
      });
    },
    [updateInteractionStatus]
  );

  useEffect(() => {
    if (isRegistered) fetchContractBalance();
  }, [isRegistered, interactions.length, fetchContractBalance]);

  useEffect(() => {
    for (const item of interactions) {
      if (!isTerminalTxStatus(item.status) && item.status !== 'not found') {
        startPollingTx(item.txid);
      }
    }
  }, [interactions, startPollingTx]);

  const addInteraction = (label: string, functionName: string, txid: string) => {
    setInteractions((prev) => {
      const next = [
        { label, functionName, txid, at: new Date().toLocaleString(), feeMode, status: 'pending' },
        ...prev,
      ];
      storeInteractions(next);
      return next;
    });
    startPollingTx(txid);
  };

  const handleRegister = async () => {
    const credential = await register(crypto.randomUUID(), 'Demo User');
    if (credential.txid !== 'already-registered') {
      addInteraction('Sign up with passkey', 'register', credential.txid);
    }
  };

  const handleTransfer = async () => {
    try {
      const txid = await transfer(testnetConfig.deployer, 100n);
      addInteraction(
        'Transfer STX to deployer',
        feeMode === 'account-pay' ? 'transfer-stx-with-fee' : 'transfer-stx',
        txid
      );
      await fetchContractBalance();
    } catch {
      // surfaced via usePasskeyAccount().error
    }
  };

  const feeModeHelp: Record<FeeMode, string> = {
    gasless: 'Relay pays network fees from your project gas tank. Users need zero STX in their smart account for gas.',
    'account-pay':
      'Relay sponsors the transaction; the smart account reimburses the relayer from its own STX balance on-chain.',
  };

  return (
    <>
      <div className="fee-banner">
        <svg className="fee-banner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        <div>
          <strong>Fee mode: {feeMode}</strong>
          <p>{feeModeHelp[feeMode]}</p>
          {gasBalance && feeMode === 'gasless' && (
            <span className="gas-pill">Project gas tank: {(Number(gasBalance) / 1_000_000).toFixed(4)} STX</span>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {!isRegistered ? (
        <div className="card auth-card">
          <div className="auth-icon">
            <PasskeyIcon />
          </div>
          <h2>Get started with Passkeys</h2>
          <p>
            Create a seedless Stacks smart account using Face ID, Touch ID, or your device&apos;s built-in
            authenticator. No browser extension required.
          </p>
          <div className="btn-row">
            <button className="btn btn-primary" disabled={loading} onClick={handleRegister}>
              {loading && <span className="spinner" />}
              {loading ? 'Working…' : 'Sign up with Passkey'}
            </button>
            <button className="btn btn-secondary" disabled={loading} onClick={() => signIn()}>
              Sign in
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Account details</h2>
              <StatusPill status="success" />
            </div>
            <div className="detail-grid">
              <DetailRow
                label="Smart account"
                value={<ExplorerLink href={contractExplorerUrl(contractId)}>{contractId}</ExplorerLink>}
              />
              <DetailRow label="Public key" value={session?.publicKeyHex} />
              <DetailRow label="Passkey credential ID" value={session?.credentialId} />
              <DetailRow
                label="Origin address"
                value={<ExplorerLink href={addressExplorerUrl(originAddress)}>{originAddress}</ExplorerLink>}
              />
              <DetailRow label="Contract STX balance" value={contractBalance ?? 'Loading…'} />
            </div>
            {contractBalance && Number.parseFloat(contractBalance) === 0 && (
              <div className="alert alert-warning" style={{ marginTop: '1rem', marginBottom: 0 }}>
                Contract has no STX — transfers will fail. Fund {contractId} on testnet first.
              </div>
            )}
          </div>

          <div className="actions-row">
            <button className="btn btn-primary" disabled={loading} onClick={handleTransfer}>
              {loading && <span className="spinner" />}
              Transfer 100 µSTX
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                logout();
                setContractBalance(null);
              }}
            >
              Log out
            </button>
          </div>

          {interactions.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Transaction history</h2>
              </div>
              <ul className="tx-list">
                {interactions.map((item) => (
                  <li key={`${item.txid}-${item.at}`} className="tx-item">
                    <div className="tx-item-header">
                      <span className="tx-item-title">{item.label}</span>
                      <StatusPill status={item.status} />
                    </div>
                    <div className="tx-meta">
                      <code>{item.functionName}</code> · {item.at} · {item.feeMode}
                    </div>
                    {item.status === 'not found' && (
                      <div className="alert alert-warning" style={{ margin: 0, padding: '0.5rem 0.75rem' }}>
                        Tx not indexed after ~90s — check relay is running or try the explorer link.
                      </div>
                    )}
                    {item.txid && item.txid !== 'already-registered' && (
                      <ExplorerLink href={txExplorerUrl(item.txid)}>View on explorer →</ExplorerLink>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </>
  );
}

export function App() {
  const [feeMode, setFeeMode] = useState<FeeMode>('gasless');
  const relayUrl = testnetConfig.relayUrl;
  const relayApiKey = import.meta.env.VITE_RELAY_API_KEY;

  const config = useMemo(
    () => ({
      network: STACKS_TESTNET,
      relayUrl,
      relayApiKey,
      contractAddress: testnetConfig.contractAddress,
      contractName: testnetConfig.contractName,
      rpId: window.location.hostname,
      rpName: 'Stacks Passkey Demo',
      origin: window.location.origin,
      fee: {
        mode: feeMode,
        relayUrl,
        relayApiKey,
        maxFeeMicroStx: 100_000n,
      },
    }),
    [feeMode, relayApiKey]
  );

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="badge">
          <span className="badge-dot" />
          Stacks Testnet
        </div>
        <h1>Passkey Smart Accounts</h1>
        <p>
          Wallet-less onboarding for Stacks — biometric sign-up, gasless transactions, and on-chain secp256r1
          verification.
        </p>
        <p className="hero-meta">
          Contract: <code>{testnetConfig.contractName}</code>
        </p>
      </header>

      <div className="fee-tabs">
        {(['gasless', 'account-pay'] as FeeMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            className={`fee-tab${feeMode === mode ? ' active' : ''}`}
            onClick={() => setFeeMode(mode)}
          >
            {mode === 'gasless' ? 'Gasless' : 'Account Pay'}
          </button>
        ))}
      </div>

      <PasskeyProvider config={config}>
        <DemoApp feeMode={feeMode} />
      </PasskeyProvider>
    </div>
  );
}
