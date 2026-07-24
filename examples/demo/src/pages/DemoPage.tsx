import { useMemo, useState } from 'react';
import { PasskeyProvider } from '@stacks-passkey/react';
import { STACKS_TESTNET } from '@stacks/network';
import type { FeeMode } from '@stacks-passkey/core';
import { testnetConfig } from '../config.js';
import { DemoApp } from '../demo/DemoApp.js';
import { DEMO_COPY } from '../content/portal-content.js';
import { ScrollReveal } from '../components/ScrollReveal.js';

function ConfigPanel({
  feeMode,
  onFeeMode,
}: {
  feeMode: FeeMode;
  onFeeMode: (mode: FeeMode) => void;
}) {
  return (
    <div className="playground-config">
      <div className="config-row">
        <div className="config-label">
          <strong>Fee mode</strong>
          <span>How network fees are paid for sponsored transactions</span>
        </div>
        <div className="segmented" role="tablist" aria-label="Fee mode">
          {(['gasless', 'account-pay'] as FeeMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={feeMode === mode}
              className={feeMode === mode ? 'active' : ''}
              onClick={() => onFeeMode(mode)}
            >
              {mode === 'gasless' ? 'Gasless' : 'Account pay'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DemoPage() {
  const [feeMode, setFeeMode] = useState<FeeMode>('gasless');
  const relayUrl = testnetConfig.relayUrl;
  const relayApiKey = import.meta.env.VITE_RELAY_API_KEY;

  const config = useMemo(
    () => ({
      network: STACKS_TESTNET,
      relayUrl,
      relayApiKey,
      deployerAddress: testnetConfig.deployerAddress,
      factoryName: testnetConfig.factoryName,
      adapterAddress: testnetConfig.deployerAddress,
      adapterName: 'passkey-adapter',
      rpId: window.location.hostname,
      rpName: DEMO_COPY.rpName,
      origin: window.location.origin,
      fee: {
        mode: feeMode,
        relayUrl,
        relayApiKey,
      },
    }),
    [feeMode, relayApiKey]
  );

  return (
    <div className="playground-page portal-page">
      <header className="portal-page-hero playground-header">
        <ScrollReveal>
          <h1>Try the SDK on testnet</h1>
          <p className="portal-lead">
            Sign up with a passkey, self-deploy a smart account, transfer STX, and invoke{' '}
            <code>set-score</code> on <code>passkey-demo-app</code> — the same SDK calls you wire into your app.
          </p>
          <div className="playground-quickstart">
            <code>npm i @stacks-passkey/core @stacks-passkey/react</code>
          </div>
        </ScrollReveal>
      </header>

      <div className="playground-shell">
        <aside className="playground-sidebar">
          <ConfigPanel feeMode={feeMode} onFeeMode={setFeeMode} />
          <div className="playground-hints forge-panel">
            <h3>What to try</h3>
            <ol>
              <li>Sign up with passkey (Face ID / Touch ID)</li>
              <li>Confirm smart account deploy and factory registration</li>
              <li>Invoke <code>set-score</code> on passkey-demo-app</li>
              <li>Fund the smart account, then transfer 100 µSTX</li>
              <li>Inspect tx status and events in the result panel</li>
            </ol>
          </div>
        </aside>

        <div className="playground-main">
          <PasskeyProvider key={feeMode} config={config}>
            <DemoApp feeMode={feeMode} />
          </PasskeyProvider>
        </div>
      </div>
    </div>
  );
}
