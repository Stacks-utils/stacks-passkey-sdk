import { StrictMode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminFetch,
  fetchHealth,
  microStxToStx,
  truncateAddress,
  type HealthInfo,
  type Project,
  type SponsorLog,
  RELAY_URL,
} from './api.js';
import { useWalletGate } from './hooks/useWallet.js';
import { useWallet, WalletProvider } from './WalletProvider.js';

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

function ConnectGate() {
  const { connecting, error, connectWallet, skipWallet, address, disconnectWallet } = useWallet();

  return (
    <div className="connect-screen">
      <div className="connect-card">
        <div className="connect-logo">SP</div>
        <h1>Relay Admin Portal</h1>
        <p>Manage API keys and gas tanks. Connect the relay sponsor wallet, or continue with your admin API key only.</p>
        <ul className="connect-features">
          <li>Create and manage developer API keys</li>
          <li>Each API key maps to a gas tank deposit address</li>
          <li>View sponsored transaction activity</li>
        </ul>
        {address ? (
          <>
            <div className="wallet-chip" style={{ marginBottom: '1rem', justifyContent: 'center' }}>
              <span className="wallet-dot" />
              <span className="wallet-address">{address}</span>
            </div>
            <button type="button" className="btn btn-secondary" onClick={disconnectWallet} style={{ width: '100%', justifyContent: 'center' }}>
              Disconnect & try another wallet
            </button>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button type="button" className="btn btn-primary" disabled={connecting} onClick={connectWallet} style={{ width: '100%', justifyContent: 'center' }}>
              {connecting && <span className="spinner" />}
              {connecting ? 'Connecting…' : 'Connect Sponsor Wallet'}
            </button>
            <button type="button" className="btn btn-secondary" disabled={connecting} onClick={skipWallet} style={{ width: '100%', justifyContent: 'center' }}>
              Continue with Admin API Key
            </button>
          </div>
        )}
        {error && <div className="connect-error">{error}</div>}
      </div>
    </div>
  );
}

function Dashboard() {
  const wallet = useWallet();
  const [tab, setTab] = useState<Tab>('overview');
  const [projects, setProjects] = useState<Project[]>([]);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('My App');
  const [initialGas, setInitialGas] = useState('5000000');
  const [refillAmount, setRefillAmount] = useState('1000000');
  const [creating, setCreating] = useState(false);

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [logs, setLogs] = useState<SponsorLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [healthRes, projectsRes] = await Promise.all([
        fetchHealth(),
        adminFetch<{ projects: Project[] }>('/v1/admin/projects'),
      ]);
      setHealth(healthRes);
      setProjects(projectsRes.projects);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (wallet.authorized || wallet.adminReady) void load();
  }, [wallet.authorized, wallet.adminReady, load]);

  const loadLogs = useCallback(async (projectId: string) => {
    setLogsLoading(true);
    try {
      const res = await adminFetch<{ logs: SponsorLog[] }>(`/v1/admin/projects/${projectId}/logs`);
      setLogs(res.logs.slice().reverse());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load logs');
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProjectId) void loadLogs(selectedProjectId);
  }, [selectedProjectId, loadLogs]);

  const totals = useMemo(() => {
    let gas = 0n;
    let spent = 0n;
    let txs = 0;
    for (const p of projects) {
      gas += BigInt(p.gasBalanceMicroStx);
      spent += BigInt(p.totalSpentMicroStx);
      txs += p.txCount;
    }
    return { gas, spent, txs, count: projects.length };
  }, [projects]);

  const createProject = async () => {
    setCreating(true);
    setError(null);
    try {
      await adminFetch('/v1/admin/projects', {
        method: 'POST',
        body: JSON.stringify({ name, initialGasMicroStx: initialGas }),
      });
      await load();
      setTab('keys');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const refill = async (id: string) => {
    setError(null);
    try {
      await adminFetch(`/v1/admin/projects/${id}/refill`, {
        method: 'POST',
        body: JSON.stringify({ amountMicroStx: refillAmount }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refill failed');
    }
  };

  const toggleReveal = (id: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const maskKey = (key: string) => `${key.slice(0, 8)}${'•'.repeat(24)}${key.slice(-4)}`;

  const txExplorer = (txid: string) => {
    const id = txid.startsWith('0x') ? txid.slice(2) : txid;
    const base = health?.network === 'mainnet' ? 'https://explorer.hiro.so/txid' : 'https://explorer.hiro.so/txid?chain=testnet';
    return `${base}/${id}`;
  };

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">SP</div>
          <span>Passkey Relay</span>
        </div>
        <nav className="sidebar-nav">
          <button type="button" className={`nav-item${tab === 'overview' ? ' active' : ''}`} onClick={() => setTab('overview')}>
            Overview
          </button>
          <button type="button" className={`nav-item${tab === 'keys' ? ' active' : ''}`} onClick={() => setTab('keys')}>
            API Keys
          </button>
          <button type="button" className={`nav-item${tab === 'activity' ? ' active' : ''}`} onClick={() => setTab('activity')}>
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
            {tab === 'overview' && 'Dashboard'}
            {tab === 'keys' && 'API Keys'}
            {tab === 'activity' && 'Activity'}
          </h1>
          <p>
            {tab === 'overview' && 'Monitor relay health, gas tanks, and project usage.'}
            {tab === 'keys' && 'Create API keys and manage per-project gas tanks for gasless mode.'}
            {tab === 'activity' && 'Review sponsored transaction logs by project.'}
          </p>
        </header>

        {error && <div className="alert alert-error">{error}</div>}

        {loading && tab === 'overview' ? (
          <div className="alert alert-info">Loading dashboard…</div>
        ) : (
          <>
            {tab === 'overview' && (
              <>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-label">Projects</div>
                    <div className="stat-value">{totals.count}</div>
                    <div className="stat-sub">Active API keys</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Total gas remaining</div>
                    <div className="stat-value">{microStxToStx(totals.gas)} STX</div>
                    <div className="stat-sub">Across all tanks</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Total spent</div>
                    <div className="stat-value">{microStxToStx(totals.spent)} STX</div>
                    <div className="stat-sub">{totals.txs} sponsored txs</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Relay</div>
                    <div className="stat-value" style={{ fontSize: '0.95rem' }}>
                      {health?.network ?? '—'}
                    </div>
                    <div className="stat-sub mono" title={health?.sponsorAddress}>
                      Sponsor {health?.sponsorAddress ? truncateAddress(health.sponsorAddress) : '—'}
                    </div>
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-header">
                    <h2 className="panel-title">Relay configuration</h2>
                  </div>
                  <div className="panel-body">
                    <div className="detail-grid" style={{ display: 'grid', gap: '0.75rem', fontSize: '0.875rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Endpoint</span>
                        <div className="mono">{RELAY_URL}</div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Sponsor address</span>
                        <div className="mono">{health?.sponsorAddress ?? '—'}</div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Connected admin</span>
                        <div className="mono">{wallet.address}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-header">
                    <h2 className="panel-title">Quick create project</h2>
                  </div>
                  <div className="panel-body">
                    <div className="form-grid">
                      <div className="form-field">
                        <label htmlFor="project-name">Project name</label>
                        <input id="project-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My App" />
                      </div>
                      <div className="form-field">
                        <label htmlFor="initial-gas">Initial gas (µSTX)</label>
                        <input id="initial-gas" value={initialGas} onChange={(e) => setInitialGas(e.target.value)} />
                        <div className="form-hint">5,000,000 µSTX = 5 STX</div>
                      </div>
                      <button type="button" className="btn btn-primary" disabled={creating} onClick={createProject}>
                        {creating && <span className="spinner" />}
                        Create API key
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {tab === 'keys' && (
              <>
                <div className="panel">
                  <div className="panel-header">
                    <h2 className="panel-title">Projects</h2>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Refill amount (µSTX)
                        <input
                          value={refillAmount}
                          onChange={(e) => setRefillAmount(e.target.value)}
                          style={{ marginLeft: 8, width: 140, padding: '0.35rem 0.5rem', background: 'var(--bg)', border: '1px solid var(--border-strong)', borderRadius: 4, color: 'var(--text)' }}
                        />
                      </label>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
                        Refresh
                      </button>
                    </div>
                  </div>
                  {projects.length === 0 ? (
                    <div className="empty-state">
                      <p>No projects yet. Create your first API key from the Overview tab.</p>
                      <button type="button" className="btn btn-primary" onClick={() => setTab('overview')}>
                        Go to Overview
                      </button>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="projects-table">
                        <thead>
                          <tr>
                            <th>Project</th>
                            <th>API Key</th>
                            <th>Gas tank address</th>
                            <th>Gas balance</th>
                            <th>Spent</th>
                            <th>Txs</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {projects.map((p) => (
                            <tr key={p.id}>
                              <td>
                                <div className="project-name">{p.name}</div>
                                <div className="mono" style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>
                                  {p.id}
                                </div>
                              </td>
                              <td>
                                <div className="api-key-cell">
                                  <span className="mono">{revealedKeys.has(p.id) ? p.apiKey : maskKey(p.apiKey)}</span>
                                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => toggleReveal(p.id)}>
                                    {revealedKeys.has(p.id) ? 'Hide' : 'Reveal'}
                                  </button>
                                  <CopyButton value={p.apiKey} />
                                </div>
                              </td>
                              <td>
                                <div className="mono" style={{ fontSize: '0.72rem' }} title={p.gasTankAddress}>
                                  {p.gasTankAddress ? truncateAddress(p.gasTankAddress) : '—'}
                                </div>
                              </td>
                              <td>
                                <div className="balance-bar">
                                  <span>{microStxToStx(p.gasBalanceMicroStx)} STX</span>
                                  <div className="balance-fill">
                                    <div
                                      className="balance-fill-inner"
                                      style={{
                                        width: `${Math.min(100, (Number(p.gasBalanceMicroStx) / Number(initialGas || '5000000')) * 100)}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td>{microStxToStx(p.totalSpentMicroStx)} STX</td>
                              <td>{p.txCount}</td>
                              <td>
                                <div style={{ display: 'flex', gap: '0.35rem' }}>
                                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => refill(p.id)}>
                                    Refill
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => {
                                      setSelectedProjectId(p.id);
                                      setTab('activity');
                                    }}
                                  >
                                    Logs
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="alert alert-info">
                  Use API keys in your app as <code>VITE_RELAY_API_KEY</code> or pass to{' '}
                  <code>PasskeyClient</code> via <code>relayApiKey</code>. Never expose keys in public client bundles
                  for production — proxy through your backend.
                </div>
              </>
            )}

            {tab === 'activity' && (
              <div className="panel">
                <div className="panel-header">
                  <h2 className="panel-title">Sponsorship logs</h2>
                  <select
                    value={selectedProjectId ?? ''}
                    onChange={(e) => setSelectedProjectId(e.target.value || null)}
                    style={{ padding: '0.4rem 0.6rem', background: 'var(--bg)', border: '1px solid var(--border-strong)', borderRadius: 4, color: 'var(--text)', fontSize: '0.85rem' }}
                  >
                    <option value="">Select project…</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="panel-body">
                  {!selectedProjectId ? (
                    <div className="empty-state">
                      <p>Select a project to view sponsored transaction activity.</p>
                    </div>
                  ) : logsLoading ? (
                    <div className="alert alert-info">Loading logs…</div>
                  ) : logs.length === 0 ? (
                    <div className="empty-state">
                      <p>No sponsorship activity recorded for this project yet.</p>
                    </div>
                  ) : (
                    <div className="logs-list">
                      {logs.map((log) => (
                        <div key={log.id} className="log-item">
                          <a href={txExplorer(log.txid)} target="_blank" rel="noreferrer">
                            {log.txid}
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
        )}
      </main>
    </div>
  );
}

function AppShell() {
  const wallet = useWallet();

  if (!wallet.authorized && !wallet.adminReady) {
    return <ConnectGate />;
  }

  return <Dashboard />;
}

export function App() {
  return (
    <WalletProvider>
      <AppShell />
    </WalletProvider>
  );
}
