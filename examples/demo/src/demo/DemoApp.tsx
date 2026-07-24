import { useCallback, useEffect, useRef, useState } from 'react';
import { usePasskeyAccount } from '@stacks-passkey/react';
import { STACKS_TESTNET } from '@stacks/network';
import type { FeeMode } from '@stacks-passkey/core';
import { testnetConfig } from '../config.js';
import { addressExplorerUrl, contractExplorerUrl } from '../explorer.js';
import { fetchDemoScore } from '../read-demo-app.js';
import { CodeValue, Spinner, StatusBadge } from '../components/ui.js';
import { OnChainResult } from './OnChainResult.js';
import { Logo } from '../components/Logo.js';
import { DEMO_COPY } from '../content/portal-content.js';

type ContractInteraction = {
  label: string;
  functionName: string;
  txid: string;
  at: string;
  status?: string;
  feeMode: FeeMode;
};

type InteractionStore = Record<string, ContractInteraction[]>;

const INTERACTIONS_KEY = 'passkey-demo-interactions';
const TERMINAL_TX_STATUSES = new Set(['success', 'abort_by_response', 'failed']);

function loadInteractionStore(): InteractionStore {
  try {
    const raw = sessionStorage.getItem(INTERACTIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as InteractionStore | ContractInteraction[];
    if (Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

function loadStoredInteractions(contractId: string | null): ContractInteraction[] {
  if (!contractId) return [];
  return loadInteractionStore()[contractId] ?? [];
}

function storeInteractions(contractId: string, items: ContractInteraction[]) {
  const store = loadInteractionStore();
  store[contractId] = items;
  sessionStorage.setItem(INTERACTIONS_KEY, JSON.stringify(store));
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

const FLOW_STEPS = [
  { label: 'Passkey sign-up → derive origin key', key: 'signup' },
  { label: 'Deploy STorigin.smart-account (sponsored)', key: 'deploy' },
  { label: 'Register pubkey + passkey-factory', key: 'register' },
  { label: 'Sign transfers & invokes via WebAuthn', key: 'sign' },
  { label: 'Adapter forwards to passkey-exec', key: 'adapter' },
] as const;

function FlowPanel({ isRegistered }: { isRegistered: boolean }) {
  return (
    <div className="flow-checklist-card">
      <h3>{DEMO_COPY.flowTitle}</h3>
      <ul className="flow-checklist">
        {FLOW_STEPS.map((step) => (
          <li key={step.key} className={isRegistered ? 'done' : 'pending'}>
            <span className="flow-check" aria-hidden />
            {step.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DemoApp({ feeMode }: { feeMode: FeeMode }) {
  const demo = DEMO_COPY;
  const {
    session,
    isRegistered,
    loading,
    error,
    register,
    signIn,
    logout,
    transfer,
    invoke,
    gasBalance,
    gasTankAddress,
  } = usePasskeyAccount();

  const [interactions, setInteractions] = useState<ContractInteraction[]>([]);
  const [contractBalance, setContractBalance] = useState<string | null>(null);
  const [demoScore, setDemoScore] = useState<string | null>(null);
  const [demoScoreError, setDemoScoreError] = useState<string | null>(null);
  const [demoScoreLoading, setDemoScoreLoading] = useState(false);
  const [scoreInput, setScoreInput] = useState('42');
  const [actionLoading, setActionLoading] = useState<'invoke' | 'transfer' | null>(null);
  const pollingTxids = useRef(new Set<string>());

  const originAddress = session?.originAddress ?? '';
  const smartAccountId =
    session?.contractId ?? (originAddress ? `${originAddress}.smart-account` : null);

  useEffect(() => {
    setInteractions(smartAccountId ? loadStoredInteractions(smartAccountId) : []);
  }, [smartAccountId]);

  const fetchContractBalance = useCallback(async () => {
    if (!smartAccountId) return;
    try {
      const res = await fetch(`${STACKS_TESTNET.client.baseUrl}/extended/v1/address/${smartAccountId}/stx`);
      if (!res.ok) return;
      const data = (await res.json()) as { balance: string };
      setContractBalance((Number(BigInt(data.balance)) / 1_000_000).toFixed(4));
    } catch {
      setContractBalance(null);
    }
  }, [smartAccountId]);

  const refreshDemoScore = useCallback(async () => {
    if (!originAddress) return;
    setDemoScoreLoading(true);
    setDemoScoreError(null);
    try {
      const score = await fetchDemoScore(STACKS_TESTNET, originAddress);
      setDemoScore(score.toString());
    } catch (err) {
      setDemoScore(null);
      setDemoScoreError(err instanceof Error ? err.message : 'Failed to read demo score');
    } finally {
      setDemoScoreLoading(false);
    }
  }, [originAddress]);

  const updateInteractionStatus = useCallback((txid: string, status: string) => {
    setInteractions((prev) => {
      const next = prev.map((item) => (item.txid === txid ? { ...item, status } : item));
      if (smartAccountId) storeInteractions(smartAccountId, next);
      return next;
    });
  }, [smartAccountId]);

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
    if (isRegistered && originAddress) refreshDemoScore();
  }, [isRegistered, originAddress, refreshDemoScore]);

  useEffect(() => {
    const hasPendingInvoke = interactions.some(
      (item) =>
        (item.functionName === 'execute-via-adapter' ||
          item.functionName === 'execute-via-adapter-with-fee') &&
        item.status !== 'success' &&
        item.status !== 'abort_by_response' &&
        item.status !== 'failed' &&
        item.status !== 'not found'
    );
    const latestInvoke = interactions.find(
      (item) =>
        item.functionName === 'execute-via-adapter' ||
        item.functionName === 'execute-via-adapter-with-fee'
    );
    if (!hasPendingInvoke && latestInvoke?.status === 'success') {
      void refreshDemoScore();
    }
  }, [interactions, refreshDemoScore]);

  useEffect(() => {
    for (const item of interactions) {
      if (!isTerminalTxStatus(item.status) && item.status !== 'not found') {
        startPollingTx(item.txid);
      }
    }
  }, [interactions, startPollingTx]);

  const addInteraction = (label: string, functionName: string, txid: string, contractId?: string) => {
    const accountId = contractId ?? smartAccountId;
    if (!accountId) return;
    setInteractions((prev) => {
      const next = [
        { label, functionName, txid, at: new Date().toLocaleString(), feeMode, status: 'pending' },
        ...prev,
      ];
      storeInteractions(accountId, next);
      return next;
    });
    startPollingTx(txid);
  };

  const handleRegister = async () => {
    const credential = await register(crypto.randomUUID(), 'Demo User');
    if (credential.txid !== 'already-registered') {
      addInteraction('Sign up with passkey', 'register', credential.txid, credential.contractId);
    }
  };

  const handleInvokeScore = async () => {
    const trimmed = scoreInput.trim();
    if (!/^\d+$/.test(trimmed)) return;
    const score = BigInt(trimmed);
    if (score <= 0n) return;

    setActionLoading('invoke');
    try {
      const txid = await invoke(testnetConfig.passkeyDemoAppId, 'set-score', {
        arg0: score,
        arg2: originAddress,
      });
      addInteraction(
        `Invoke demo app (set-score = ${score.toString()})`,
        feeMode === 'account-pay' ? 'execute-via-adapter-with-fee' : 'execute-via-adapter',
        txid
      );
    } catch {
      // surfaced via usePasskeyAccount().error
    } finally {
      setActionLoading(null);
    }
  };

  const handleTransfer = async () => {
    setActionLoading('transfer');
    try {
      const txid = await transfer(testnetConfig.deployer, 100n);
      addInteraction(
        'Transfer STX (passkey-signed)',
        feeMode === 'account-pay' ? 'transfer-stx-with-fee' : 'transfer-stx',
        txid
      );
      await fetchContractBalance();
    } catch {
      // surfaced via usePasskeyAccount().error
    } finally {
      setActionLoading(null);
    }
  };

  if (!isRegistered) {
    return (
      <div className="demo-auth">
        {error && <div className="alert alert-error">{error}</div>}
        <div className="demo-auth-card">
          <Logo size={56} />
          <h2>{demo.signupTitle}</h2>
          <p>{demo.signupLead}</p>
          <ol className="flow-steps">
            <li>
              <span>1</span>
              Create a WebAuthn passkey (Face ID / Touch ID / security key)
            </li>
            <li>
              <span>2</span>
              SDK derives origin key and deploys STorigin.smart-account
            </li>
            <li>
              <span>3</span>
              Register passkey on-chain via relay + passkey-factory
            </li>
          </ol>
          <div className="btn-row">
            <button className="btn btn-primary" disabled={loading} onClick={handleRegister}>
              {loading && <Spinner />}
              {loading ? 'Working…' : 'Sign up with passkey'}
            </button>
            <button className="btn btn-outline" disabled={loading} onClick={() => signIn()}>
              Sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  const needsFunding =
    smartAccountId && contractBalance !== null && Number.parseFloat(contractBalance) === 0;
  const latestTx = interactions[0];
  const scoreValid = /^\d+$/.test(scoreInput.trim()) && BigInt(scoreInput.trim()) > 0n;
  const actionBusy = actionLoading !== null;

  return (
    <div className="demo-dashboard">
      {error && <div className="alert alert-error">{error}</div>}

      {feeMode === 'gasless' && gasBalance !== undefined && (
        <div className="gas-tank-card">
          <span className="gas-tank-label">Project gas tank</span>
          <strong>{(Number(gasBalance) / 1_000_000).toFixed(4)} STX</strong>
          {gasTankAddress && <code>{gasTankAddress}</code>}
        </div>
      )}

      {feeMode === 'account-pay' && (
        <div className="alert alert-info">
          Account pay: the relay co-signs the outer transaction; your smart account reimburses a fixed fee
          (matching relay <code>MAX_FEE_MICRO_STX</code>, typically ~0.1 STX) to the project gas tank on each
          transfer or invoke. Fund the smart account contract first.
        </div>
      )}

      <div className="demo-grid">
        <div className="demo-main">
          <div className="account-card">
            <h3>{demo.accountLabel}</h3>
            <div className="account-stats">
              <div>
                <label>{demo.accountLabel} balance</label>
                <strong>{contractBalance ?? '…'} STX</strong>
              </div>
              <div>
                <label>{demo.statLabel}</label>
                <strong>{demoScoreLoading ? '…' : demoScoreError ? '—' : demoScore ?? '—'}</strong>
              </div>
            </div>
            <div className="account-details">
              <div className="detail-item">
                <label>Origin address</label>
                <CodeValue value={originAddress} href={addressExplorerUrl(originAddress)} truncate />
              </div>
              {smartAccountId && (
                <div className="detail-item">
                  <label>Smart account contract</label>
                  <CodeValue value={smartAccountId} href={contractExplorerUrl(smartAccountId)} truncate />
                </div>
              )}
              {session?.publicKeyHex && (
                <div className="detail-item">
                  <label>Passkey public key</label>
                  <CodeValue value={session.publicKeyHex} truncate />
                </div>
              )}
            </div>
            {needsFunding && (
              <div className="alert alert-warning">
                Fund {smartAccountId} on testnet
                {feeMode === 'account-pay' ? ' for account-pay fees and transfers' : ' for STX transfers'}.
              </div>
            )}
          </div>

          <div className="sdk-actions-card">
            <h3>Actions</h3>
            <div className="sdk-actions-grid">
              <div className="sdk-invoke-row">
                <label htmlFor="score-input">set-score value (arg0)</label>
                <div className="sdk-invoke-controls">
                  <input
                    id="score-input"
                    type="number"
                    min={1}
                    step={1}
                    value={scoreInput}
                    onChange={(e) => setScoreInput(e.target.value)}
                    disabled={actionBusy}
                  />
                  <button
                    className="sdk-action-btn sdk-action-primary"
                    disabled={actionBusy || !scoreValid}
                    onClick={handleInvokeScore}
                  >
                    {actionLoading === 'invoke' && <Spinner />}
                    Invoke set-score
                  </button>
                </div>
                {!scoreValid && scoreInput.trim() !== '' && (
                  <p className="sdk-invoke-hint">Enter a whole number greater than 0.</p>
                )}
              </div>
              <button
                className="sdk-action-btn"
                disabled={actionBusy}
                onClick={handleTransfer}
              >
                {actionLoading === 'transfer' && <Spinner />}
                {demo.secondaryAction}
              </button>
              <button
                className="sdk-action-btn"
                disabled={demoScoreLoading || !originAddress}
                onClick={() => void refreshDemoScore()}
              >
                Refresh {demo.statLabel.toLowerCase()}
              </button>
              <button
                className="sdk-action-btn sdk-action-ghost"
                onClick={() => {
                  logout();
                  setContractBalance(null);
                  setDemoScore(null);
                  setDemoScoreError(null);
                }}
              >
                Log out
              </button>
            </div>
          </div>
        </div>

        <div className="demo-side">
          <FlowPanel isRegistered={isRegistered} />
          <OnChainResult txid={latestTx?.txid} status={latestTx?.status} label={latestTx?.label} />

          {interactions.length > 0 && (
            <div className="activity-mini">
              <h3>Session activity</h3>
              {smartAccountId && (
                <p className="activity-mini-account">
                  <code>{smartAccountId}</code>
                </p>
              )}
              <ul>
                {interactions.slice(0, 5).map((item) => (
                  <li key={`${item.txid}-${item.at}`}>
                    <span>{item.label}</span>
                    <StatusBadge status={item.status} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
