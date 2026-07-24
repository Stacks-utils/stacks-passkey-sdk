import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  cacheApiKey,
  getCachedApiKey,
  microStxToStx,
  removeCachedApiKey,
  revealApiKey,
  truncateAddress,
  walletFetch,
  type ApiKeyCreated,
  type ApiKeySummary,
  type SponsorLog,
  type WalletInfo,
} from './api.js';
import { addressExplorerUrl, explorerNetwork, txExplorerUrl } from '../explorer.js';
import { MobileMenuButton } from '../components/MobileMenuButton.js';
import { useEscapeKey, useScrollLock } from '../hooks/useScrollLock.js';
import { useWallet } from './WalletProvider.js';
import { Logo } from '../components/Logo.js';

type Tab = 'overview' | 'keys' | 'activity';

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button type="button" className="btn btn-secondary btn-sm" onClick={copy}>
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function ApiKeyValue({ keyId, keyPrefix, retrievable }: { keyId: string; keyPrefix: string; retrievable?: boolean }) {
  const [revealed, setRevealed] = useState<string | null>(() => getCachedApiKey(keyId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const show = async () => {
    setError(null);
    const cached = getCachedApiKey(keyId);
    if (cached) {
      setRevealed(cached);
      return;
    }
    if (!retrievable) {
      setError('Not saved in this browser — revoke and create a new key to get a copy.');
      return;
    }
    setLoading(true);
    try {
      const apiKey = await revealApiKey(keyId);
      setRevealed(apiKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reveal key');
    } finally {
      setLoading(false);
    }
  };

  if (revealed) {
    return (
      <div className="api-key-cell">
        <code className="mono">{revealed}</code>
        <CopyButton value={revealed} />
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRevealed(null)}>
          Hide
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="api-key-cell">
        <code className="mono">{keyPrefix}…</code>
        <button type="button" className="btn btn-secondary btn-sm" disabled={loading} onClick={() => void show()}>
          {loading ? 'Loading…' : 'Reveal'}
        </button>
      </div>
      {error && <p className="connect-error" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>{error}</p>}
    </div>
  );
}

function ConnectGate() {
  const {
    phase,
    error,
    connectWallet,
    signIn,
    address,
    authorized,
    connecting,
    detectedCount,
    isBrave,
    leatherReady,
    signReady,
    refreshWallets,
    disconnectWallet,
    walletOptions,
  } = useWallet();

  const needsSignRetry = Boolean(address) && !authorized;

  const primaryLabel =
    phase === 'connecting'
      ? 'Opening wallet…'
      : phase === 'signing'
        ? 'Approve in wallet…'
        : needsSignRetry
          ? 'Retry sign in'
          : isBrave
            ? 'Connect with Leather'
            : 'Connect wallet';

  return (
    <div className="connect-screen">
      <div className="connect-card">
        <Logo size={56} />
        <h1>Dev portal</h1>
        <p>
          Gas tanks &amp; API keys — connect your Stacks wallet to manage gas sponsorship. Each wallet gets a
          dedicated sponsor address derived from your wallet; deposit STX there (not to your wallet) to fund all
          API keys under your account.
        </p>
        <Link to="/docs/relay" className="btn btn-outline btn-sm connect-guide-link">
          Relay setup guide
        </Link>

        {isBrave && (
          <div className="connect-brave-notice">
            <strong>Brave + Leather tips</strong>
            <ol>
              <li>
                At <code>brave://settings/web3</code>, keep <strong>Default Ethereum wallet</strong> on{' '}
                <strong>Extensions (Brave Wallet fallback)</strong> — that is the correct setting (see Brave Web3 settings).
              </li>
              <li>Restart Brave or open a <strong>new tab</strong> after changing wallet settings</li>
              <li>Unlock <strong>Leather</strong> in the toolbar, set <strong>Testnet</strong>, then use Connect → Sign in</li>
            </ol>
            <p className="connect-brave-footnote">
              Leather uses its own extension API — not Ethereum wallet settings. If connect still fails in Brave, use Chrome for the dev portal.
            </p>
          </div>
        )}

        <ol className="connect-steps">
          <li className={address ? 'done' : phase === 'connecting' ? 'active' : ''}>
            <span>1</span>
            Connect wallet
          </li>
          <li className={authorized ? 'done' : phase === 'signing' ? 'active' : ''}>
            <span>2</span>
            Sign in with wallet
          </li>
        </ol>

        <p className="connect-detected">
          {isBrave
            ? leatherReady
              ? 'Leather extension detected'
              : 'Leather not detected — unlock the extension in your toolbar, then click Refresh'
            : detectedCount > 0
              ? `Detected ${detectedCount} wallet extension${detectedCount === 1 ? '' : 's'}: ${walletOptions
                  .filter((w) => w.available)
                  .map((w) => w.name)
                  .join(', ')}`
              : 'No wallet extension detected yet — unlock Leather in your toolbar, then click Refresh'}
        </p>

        {address && (
          <div className="wallet-chip connect-wallet-chip">
            <span className="wallet-dot" />
            <span className="wallet-address">{address}</span>
          </div>
        )}

        <div className="connect-actions">
          <button
            type="button"
            className="btn btn-primary connect-primary-btn"
            disabled={connecting || (isBrave && !leatherReady && !address) || (needsSignRetry && !signReady)}
            onClick={() => {
              if (needsSignRetry) {
                void signIn().catch(() => undefined);
              } else {
                connectWallet();
              }
            }}
          >
            {(phase === 'connecting' || phase === 'signing') && <span className="spinner" />}
            {primaryLabel}
          </button>
          {(address || needsSignRetry) && (
            <button
              type="button"
              className="btn btn-secondary connect-secondary-btn"
              disabled={connecting}
              onClick={disconnectWallet}
            >
              Disconnect
            </button>
          )}
          {!address && (
            <button
              type="button"
              className="btn btn-secondary connect-secondary-btn"
              disabled={connecting}
              onClick={refreshWallets}
            >
              Refresh wallet detection
            </button>
          )}
        </div>

        <p className="connect-hint">
          {phase === 'connecting'
            ? isBrave
              ? 'Leather should open from your toolbar. If not, click the Leather icon — it may be waiting for approval.'
              : 'Pick a wallet in the popup, then approve in your extension.'
            : phase === 'signing'
              ? 'Approve the sign-in message in your wallet to finish.'
              : needsSignRetry
                ? 'Connection succeeded but sign-in did not. Click Retry sign in.'
                : 'Set your wallet to Testnet before connecting. Sign-in opens automatically after connect.'}
        </p>

        {error && <div className="connect-error">{error}</div>}
      </div>
    </div>
  );
}

function Dashboard() {
  const wallet = useWallet();
  const [tab, setTab] = useState<Tab>('overview');
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [logs, setLogs] = useState<SponsorLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [keyName, setKeyName] = useState('Demo app');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [me, keyList, logList] = await Promise.all([
        walletFetch<WalletInfo>('/v1/wallet/me'),
        walletFetch<{ keys: ApiKeySummary[] }>('/v1/wallet/keys'),
        walletFetch<{ logs: SponsorLog[] }>('/v1/wallet/logs'),
      ]);
      setWalletInfo(me);
      setKeys(keyList.keys);
      setLogs(logList.logs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (wallet.authorized) {
      void load();
      return;
    }
    setWalletInfo(null);
    setKeys([]);
    setLogs([]);
    setNewKey(null);
    setLoading(false);
    setError(null);
  }, [wallet.authorized, load]);

  const createKey = async () => {
    setCreating(true);
    setError(null);
    setNewKey(null);
    try {
      const created = await walletFetch<ApiKeyCreated>('/v1/wallet/keys', {
        method: 'POST',
        body: JSON.stringify({ name: keyName }),
      });
      cacheApiKey(created.id, created.apiKey);
      setNewKey(created.apiKey);
      await load();
      setTab('keys');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create key failed');
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (id: string) => {
    setError(null);
    try {
      await walletFetch(`/v1/wallet/keys/${id}`, { method: 'DELETE' });
      removeCachedApiKey(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Revoke failed');
    }
  };

  const gasPercent = useMemo(() => {
    if (!walletInfo) return 100;
    const balance = BigInt(walletInfo.gasBalanceMicroStx);
    const spent = BigInt(walletInfo.totalSpentMicroStx);
    const total = balance + spent;
    if (total === 0n) return 100;
    return Number((balance * 100n) / total);
  }, [walletInfo]);

  const chain = explorerNetwork(wallet.network);

  const tabTitle =
    tab === 'overview' ? 'Gas tank' : tab === 'keys' ? 'API Keys' : 'Activity';

  const selectTab = (next: Tab) => {
    setTab(next);
    setSidebarOpen(false);
  };

  useScrollLock(sidebarOpen);
  useEscapeKey(() => setSidebarOpen(false), sidebarOpen);

  return (
    <div className="admin-layout">
      <button
        type="button"
        className={`mobile-drawer-backdrop portal-drawer-backdrop${sidebarOpen ? ' is-open' : ''}`}
        aria-label="Close portal menu"
        onClick={() => setSidebarOpen(false)}
      />
      <div className="mobile-only-bar portal-mobile-bar">
        <MobileMenuButton
          open={sidebarOpen}
          onClick={() => setSidebarOpen((open) => !open)}
          label="Open portal menu"
        />
        <span className="mobile-only-bar-title">{tabTitle}</span>
      </div>
      <aside className={`sidebar portal-sidebar-drawer${sidebarOpen ? ' is-drawer-open' : ''}`}>
        <div className="sidebar-brand">
          <Logo size={28} />
          <span>Dev portal</span>
        </div>
        <nav className="sidebar-nav">
          <button type="button" className={`nav-item${tab === 'overview' ? ' active' : ''}`} onClick={() => selectTab('overview')}>
            Overview
          </button>
          <button type="button" className={`nav-item${tab === 'keys' ? ' active' : ''}`} onClick={() => selectTab('keys')}>
            API Keys
          </button>
          <button type="button" className={`nav-item${tab === 'activity' ? ' active' : ''}`} onClick={() => selectTab('activity')}>
            Activity
          </button>
        </nav>
        <div className="sidebar-footer">
          {wallet.address && (
            <div className="wallet-chip">
              <span className="wallet-dot" />
              <span className="wallet-address" title={wallet.address}>
                {truncateAddress(wallet.address)}
              </span>
            </div>
          )}
          <button type="button" className="btn btn-danger btn-sm" style={{ width: '100%' }} onClick={wallet.disconnectWallet}>
            Disconnect
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="page-header">
          <h1>
            {tab === 'overview' && 'Gas tank'}
            {tab === 'keys' && 'API Keys'}
            {tab === 'activity' && 'Activity'}
          </h1>
          <p>
            {tab === 'overview' && 'Deposit STX to your sponsor address. All API keys share this on-chain balance.'}
            {tab === 'keys' && 'Create keys for your apps. Revoke any key instantly without losing your gas tank.'}
            {tab === 'activity' && 'Sponsored transaction history for your wallet.'}
          </p>
        </header>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="alert alert-info">Loading…</div>
        ) : walletInfo ? (
          <>
            {tab === 'overview' && (
              <>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-label">On-chain balance</div>
                    <div className="stat-value">{microStxToStx(walletInfo.gasBalanceMicroStx)} STX</div>
                    <div className="stat-sub">At sponsor address</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Available</div>
                    <div className="stat-value">{microStxToStx(walletInfo.availableMicroStx)} STX</div>
                    <div className="stat-sub">
                      Reserved {microStxToStx(walletInfo.reservedMicroStx)} STX in-flight
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Total spent</div>
                    <div className="stat-value">{microStxToStx(walletInfo.totalSpentMicroStx)} STX</div>
                    <div className="stat-sub">{walletInfo.txCount} sponsored txs</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">API keys</div>
                    <div className="stat-value">{keys.length}</div>
                    <div className="stat-sub">Active keys</div>
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-header">
                    <h2 className="panel-title">Deposit gas</h2>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => void load()}>
                      Refresh balance
                    </button>
                  </div>
                  <div className="panel-body">
                    <p style={{ marginTop: 0, color: 'var(--text-secondary)' }}>
                      Send testnet STX to your dedicated sponsor address (not your connected wallet). This
                      address co-signs all sponsored transactions for your API keys.
                    </p>
                    <div className="form-field">
                      <label>Sponsor gas tank (derived for your wallet)</label>
                      <div className="api-key-cell">
                        <code className="mono">{walletInfo.sponsorAddress}</code>
                        <CopyButton value={walletInfo.sponsorAddress} />
                        <a
                          className="btn btn-secondary btn-sm"
                          href={addressExplorerUrl(walletInfo.sponsorAddress, chain)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Explorer
                        </a>
                      </div>
                    </div>
                    <div className="alert alert-info">
                      Tank usage: ~{gasPercent.toFixed(0)}% of deposited STX remains (
                      {microStxToStx(walletInfo.gasBalanceMicroStx)} STX on-chain).
                    </div>
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-header">
                    <h2 className="panel-title">Create API key</h2>
                  </div>
                  <div className="panel-body">
                    <div className="form-grid">
                      <div className="form-field">
                        <label htmlFor="key-name">Key name</label>
                        <input id="key-name" value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="Production app" />
                      </div>
                      <button type="button" className="btn btn-primary" disabled={creating} onClick={createKey}>
                        {creating && <span className="spinner" />}
                        Create API key
                      </button>
                    </div>
                    {newKey && (
                      <div className="alert alert-warning" style={{ marginTop: '1rem' }}>
                        <strong>New API key (copy now — shown once):</strong>
                        <div className="api-key-cell" style={{ marginTop: '0.5rem' }}>
                          <code className="mono">{newKey}</code>
                          <CopyButton value={newKey} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {tab === 'keys' && (
              <>
                <div className="panel">
                  <div className="panel-header">
                    <h2 className="panel-title">Create API key</h2>
                  </div>
                  <div className="panel-body">
                    <div className="form-grid">
                      <div className="form-field">
                        <label htmlFor="keys-tab-key-name">Key name</label>
                        <input
                          id="keys-tab-key-name"
                          value={keyName}
                          onChange={(e) => setKeyName(e.target.value)}
                          placeholder="Production app"
                        />
                      </div>
                      <button type="button" className="btn btn-primary" disabled={creating} onClick={createKey}>
                        {creating && <span className="spinner" />}
                        Create API key
                      </button>
                    </div>
                    {newKey && (
                      <div className="alert alert-warning" style={{ marginTop: '1rem' }}>
                        <strong>New API key — copy now:</strong>
                        <div className="api-key-cell" style={{ marginTop: '0.5rem' }}>
                          <code className="mono">{newKey}</code>
                          <CopyButton value={newKey} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-header">
                    <h2 className="panel-title">Your API keys</h2>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => void load()}>
                      Refresh
                    </button>
                  </div>
                  {keys.length === 0 ? (
                    <div className="empty-state">
                      <p>No API keys yet. Create one above after funding your gas tank.</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="projects-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>API key</th>
                            <th>Created</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {keys.map((k) => (
                            <tr key={k.id}>
                              <td>{k.name}</td>
                              <td>
                                <ApiKeyValue keyId={k.id} keyPrefix={k.keyPrefix} retrievable={k.retrievable} />
                              </td>
                              <td>{new Date(k.createdAt).toLocaleString()}</td>
                              <td>
                                <button type="button" className="btn btn-danger btn-sm" onClick={() => void revokeKey(k.id)}>
                                  Revoke
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="alert alert-info" style={{ margin: '1rem' }}>
                    Click <strong>Reveal</strong> to show the full key (saved in this browser and on the relay in local
                    dev). Production keys are show-once only — store them in your backend env, not in client bundles.
                  </div>
                </div>
              </>
            )}

            {tab === 'activity' && (
              <div className="panel">
                <div className="panel-header">
                  <h2 className="panel-title">Sponsorship logs</h2>
                </div>
                <div className="panel-body">
                  {logs.length === 0 ? (
                    <div className="empty-state">
                      <p>No sponsored transactions yet. Activity appears after your app uses the relay.</p>
                    </div>
                  ) : (
                    <div className="logs-list">
                      {logs.map((log) => (
                        <div key={log.id} className="log-item">
                          <a href={txExplorerUrl(log.txid, chain)} target="_blank" rel="noreferrer">
                            {truncateAddress(log.txid)}
                          </a>
                          <span className={`tag tag-${log.billingMode === 'gasless' ? 'gasless' : 'account'}`}>
                            {log.billingMode}
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            {microStxToStx(log.feeMicroStx)} STX · {new Date(log.at).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}

export function AdminShell() {
  const wallet = useWallet();
  if (!wallet.authorized) return <ConnectGate />;
  return <Dashboard />;
}

export function AdminDashboard() {
  return <AdminShell />;
}
