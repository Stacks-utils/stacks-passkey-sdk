import { Link } from 'react-router-dom';
import { PLAYGROUND_FEATURES } from '../content/portal-content.js';
import { CodeBlock, DocPage } from './components.js';

export function PlaygroundSection() {
  return (
    <DocPage title="Playground">
      <p>
        The live demo at <Link to="/demo">/demo</Link> exercises the SDK against testnet contracts in this repo. Each
        action maps to a real method — nothing is simulated in the UI.
      </p>
      <div className="doc-features-grid">
        {PLAYGROUND_FEATURES.map((feature) => (
          <div key={feature.title} className="doc-feature-card">
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </div>
        ))}
      </div>
      <p>
        Demo contract: <code>passkey-demo-app</code> implements <code>passkey-exec</code> with{' '}
        <code>set-score</code>, <code>add-score</code>, and <code>reset-score</code>. The playground calls{' '}
        <code>set-score</code> with a value you choose (passed as <code>arg0</code>) for your origin principal.
      </p>
    </DocPage>
  );
}

export function OverviewSection() {
  return (
    <DocPage
      title="Overview"
      lead="PasskeyClient configuration, relay API reference, and Clarity adapter integration for Stacks passkey smart accounts."
    >
      <p>
        The Stacks Passkey SDK lets users onboard with <strong>WebAuthn passkeys</strong> (Face ID, Touch ID, security
        keys) instead of seed phrases. Each user gets a <strong>Clarity smart account</strong> at{' '}
        <code>STorigin.smart-account</code> that verifies secp256r1 signatures on-chain.
      </p>
      <p>Packages:</p>
      <ul>
        <li>
          <code>@stacks-passkey/core</code> — PasskeyClient, WebAuthn, relay client, actions
        </li>
        <li>
          <code>@stacks-passkey/react</code> — PasskeyProvider, usePasskeyAccount
        </li>
        <li>
          <code>@stacks-passkey/relay</code> — self-hostable gas sponsor + catalog server
        </li>
      </ul>
      <p>
        Your app contract implements <code>passkey-exec</code> and is registered on the universal{' '}
        <code>passkey-adapter</code>. Users sign actions in the browser; the relay co-signs fees.
      </p>
    </DocPage>
  );
}

export function InstallSection() {
  return (
    <DocPage title="Installation">
      <CodeBlock>{`npm install @stacks-passkey/core @stacks-passkey/react @stacks/network`}</CodeBlock>
      <p>
        For local development you also run the relay (<code>npm run dev:relay</code>) or use a hosted relay with an API
        key from the <Link to="/admin">relay admin</Link>.
      </p>
    </DocPage>
  );
}

export function QuickstartSection() {
  return (
    <DocPage title="Quick start (React)">
      <CodeBlock>{`import { PasskeyProvider, usePasskeyAccount } from '@stacks-passkey/react';
import { STACKS_TESTNET } from '@stacks/network';

const config = {
  network: STACKS_TESTNET,
  relayUrl: 'http://localhost:8787',
  relayApiKey: 'spk_...',
  deployerAddress: 'ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ',
  rpId: window.location.hostname,
  rpName: 'My App',
  origin: window.location.origin,
  fee: {
    mode: 'gasless',
    relayUrl: 'http://localhost:8787',
    relayApiKey: 'spk_...',
    maxFeeMicroStx: 100_000n,
  },
};

function App() {
  return (
    <PasskeyProvider config={config}>
      <MyDapp />
    </PasskeyProvider>
  );
}

function MyDapp() {
  const { register, invoke, transfer, session, isRegistered } = usePasskeyAccount();

  if (!isRegistered) {
    return <button onClick={() => register(crypto.randomUUID(), 'User')}>Sign up</button>;
  }

  return (
    <>
      <p>Smart account: {session?.contractId}</p>
      <button onClick={() => transfer('ST...recipient', 1000n)}>Send STX</button>
      <button onClick={() => invoke('ST...my-app', 'my-fn', { arg0: 1n })}>Call app</button>
    </>
  );
}`}</CodeBlock>
    </DocPage>
  );
}

export function ConfigSection() {
  return (
    <DocPage title="PasskeyClient configuration">
      <p>
        All options on <code>PasskeyClient</code> / <code>PasskeyProvider</code>:
      </p>
      <div className="doc-table-wrap">
        <table className="doc-table">
          <thead>
            <tr>
              <th>Option</th>
              <th>Required</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>network</code>
              </td>
              <td>Yes</td>
              <td>STACKS_TESTNET or STACKS_MAINNET</td>
            </tr>
            <tr>
              <td>
                <code>relayUrl</code>
              </td>
              <td>Yes</td>
              <td>Relay base URL for sponsor + catalog + factory registry</td>
            </tr>
            <tr>
              <td>
                <code>relayApiKey</code>
              </td>
              <td>For gasless</td>
              <td>
                Project API key (<code>Authorization: Bearer spk_...</code>)
              </td>
            </tr>
            <tr>
              <td>
                <code>deployerAddress</code>
              </td>
              <td>Yes</td>
              <td>Platform deployer (factory + adapter contracts)</td>
            </tr>
            <tr>
              <td>
                <code>factoryName</code>
              </td>
              <td>No</td>
              <td>
                Default <code>passkey-factory</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>adapterAddress</code>
              </td>
              <td>No</td>
              <td>Defaults to deployerAddress</td>
            </tr>
            <tr>
              <td>
                <code>adapterName</code>
              </td>
              <td>No</td>
              <td>
                Default <code>passkey-adapter</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>smartAccountName</code>
              </td>
              <td>No</td>
              <td>
                Contract name for self-deploy (default <code>smart-account</code>)
              </td>
            </tr>
            <tr>
              <td>
                <code>rpId</code>
              </td>
              <td>Yes</td>
              <td>WebAuthn RP ID — typically your domain</td>
            </tr>
            <tr>
              <td>
                <code>rpName</code>
              </td>
              <td>Yes</td>
              <td>Display name shown in passkey prompts</td>
            </tr>
            <tr>
              <td>
                <code>origin</code>
              </td>
              <td>Yes</td>
              <td>Full origin URL for WebAuthn clientDataJSON</td>
            </tr>
            <tr>
              <td>
                <code>fee</code>
              </td>
              <td>Recommended</td>
              <td>
                FeeConfig — see <Link to="/docs/fee-modes">Fee modes</Link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Change fee mode at runtime: <code>client.setFeeConfig(fee)</code> or update <code>PasskeyProvider</code> config
        (provider re-applies fee on change).
      </p>
    </DocPage>
  );
}

export function AccountModesSection() {
  return (
    <DocPage title="Smart account">
      <p>
        Every user gets a passkey-controlled Clarity smart account at{' '}
        <code>{'{origin}'}.smart-account</code>. The SDK derives a deterministic origin private key from the WebAuthn
        public key, self-deploys the contract via the relay, and signs all actions with passkey WebAuthn assertions.
      </p>
      <CodeBlock>{`const client = new PasskeyClient({ ...config });
await client.register(userId, displayName);
// session.contractId → STorigin.smart-account

await client.transfer('ST...recipient', 100n);
await client.invoke('ST...my-app', 'my-fn', { arg0: 1n, arg2: client.getOriginAddress() });`}</CodeBlock>
    </DocPage>
  );
}

export function SignupSection() {
  return (
    <DocPage title="Sign-up & sign-in">
      <h3>register(userId, userName)</h3>
      <p>
        Creates a WebAuthn credential, self-deploys the smart account, registers the pubkey, and calls relay factory ensure.
      </p>
      <h3>signIn()</h3>
      <p>
        Re-authenticates with an existing passkey from browser storage / credential list. Restores session from
        localStorage.
      </p>
      <h3>logout()</h3>
      <p>Clears session and stored passkey credentials for this app.</p>
      <p>
        Sessions persist in <code>localStorage</code> (credentialId, publicKeyHex, contractId, originAddress, feeMode).
        Origin private keys are stored separately per origin address scope.
      </p>
    </DocPage>
  );
}

export function SelfDeploySection() {
  return (
    <DocPage title="Self-deploy smart account">
      <p>
        Flow inside <code>register()</code>:
      </p>
      <ol>
        <li>WebAuthn registration → compressed secp256r1 public key</li>
        <li>Derive origin ST private key from pubkey + rpId + chainId</li>
        <li>
          Fetch contract template: <code>GET /v1/accounts/template</code>
        </li>
        <li>
          Sponsored deploy of <code>smart-account</code> from origin key
        </li>
        <li>
          Passkey-signed <code>register</code> on the smart account
        </li>
        <li>
          Relay <code>POST /v1/accounts/ensure</code> with originAddress + pubkey → factory registry
        </li>
      </ol>
      <p>
        The relay injects fully-qualified <code>passkey-adapter</code> references into the template so user-origin deploys
        resolve the platform adapter correctly.
      </p>
    </DocPage>
  );
}

export function FeeModesSection() {
  return (
    <DocPage title="Fee modes">
      <h3>gasless</h3>
      <p>
        User signs a sponsored tx (fee = 0). Relay co-signs and pays from the <strong>project gas tank</strong> linked to
        your API key. Users need zero STX for gas.
      </p>
      <CodeBlock>{`fee: {
  mode: 'gasless',
  relayUrl: 'https://relay.example.com',
  relayApiKey: 'spk_...',
  maxFeeMicroStx: 100_000n,
}`}</CodeBlock>

      <h3>account-pay</h3>
      <p>
        Relay still sponsors the broadcast, but the smart account executes <code>transfer-stx-with-fee</code> to reimburse
        the relayer on-chain. Requires STX in the smart account.
      </p>
      <CodeBlock>{`fee: {
  mode: 'account-pay',
  relayUrl: 'https://relay.example.com',
  relayApiKey: 'spk_...',
  feeRecipient: 'ST...relaySponsor', // from GET /health sponsorAddress
  maxFeeMicroStx: 100_000n,
}`}</CodeBlock>
      <p>Registration txs always use gasless sponsorship even in account-pay mode (users may not have STX yet).</p>
    </DocPage>
  );
}

export function TransfersSection() {
  return (
    <DocPage title="Transfers">
      <p>Passkey-signed STX transfer from the smart account:</p>
      <CodeBlock>{`// React hook
await transfer('ST...recipient', 100n);

// PasskeyClient low-level
await client.executeAction(
  { type: 'transfer', recipient: 'ST...', amount: 1000n },
  publicKeyBytes,
  credentialId
);`}</CodeBlock>
      <p>
        Fund <code>{'{origin}'}.smart-account</code> on testnet/mainnet for transfers. The origin address itself does not
        hold user STX for smart-account operations.
      </p>
    </DocPage>
  );
}

export function InvokeSection() {
  return (
    <DocPage title="Invoke app contracts">
      <p>
        Calls your app through the adapter: smart account → <code>execute-via-adapter</code> → adapter{' '}
        <code>forward-invoke</code> → your <code>passkey-exec</code>.
      </p>
      <CodeBlock>{`await client.invoke(
  'ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ.passkey-demo-app',
  'set-score',
  { arg0: 42n, arg2: client.getOriginAddress() }
);`}</CodeBlock>
      <p>
        Before first invoke, SDK calls <code>relay.ensureContract(contractId)</code> to register your app on the adapter
        (if not already registered).
      </p>
      <p>
        <strong>Explorer note:</strong> Hiro shows the outer tx as <code>execute-via-adapter</code> on the smart account.
        Your app&apos;s logic appears under the transaction <strong>Events</strong> tab, not as a separate top-level tx
        on the app contract page.
      </p>
      <h3>Invoke args (passkey-exec slots)</h3>
      <p>All invoke args map to five Clarity slots on the target contract:</p>
      <CodeBlock>{`{ arg0?: bigint, arg1?: bigint, arg2?: principal, arg3?: principal, arg4?: Uint8Array }`}</CodeBlock>
    </DocPage>
  );
}

export function AppContractSection() {
  return (
    <DocPage title="Your Clarity app contract">
      <p>
        Implement the adapter trait and route functions in <code>passkey-exec</code>:
      </p>
      <CodeBlock>{`(impl-trait 'STdeployer.passkey-adapter.passkey-exec-trait)

(define-public (passkey-exec
    (function-name (string-ascii 128))
    (arg0 uint) (arg1 uint)
    (arg2 principal) (arg3 principal)
    (arg4 (buff 1024))
  )
  ;; dispatch on function-name, use arg0–arg4
  ...
)`}</CodeBlock>
      <p>
        Add a <code>passkey.manifest.json</code> describing callable functions (used by tooling). Register on testnet via
        relay catalog or <code>npx spk ensure ST...my-app</code>.
      </p>
      <p>
        See <code>examples/demo/contracts/passkey-demo-app.clar</code> for a working example.
      </p>
    </DocPage>
  );
}

export function RelaySection() {
  return (
    <DocPage title="Relay setup">
      <p>Self-host the relay for gas sponsorship and catalog:</p>
      <CodeBlock>{`cp packages/relay/.env.example packages/relay/.env
./scripts/setup-relay-key.sh
npm run dev:relay`}</CodeBlock>
      <p>Minimum env vars:</p>
      <CodeBlock>{`PASSKEY_FACTORY_ADDRESS=ST...
PASSKEY_ADAPTER_ADDRESS=ST...
PASSKEY_DEPLOYER_ADDRESS=ST...
ALLOWED_CONTRACTS=ST...          # platform deployer; *.smart-account auto-allowed
SPONSOR_PRIVATE_KEY_FILE=./sponsor.key
RELAY_API_KEY=...                # or use BOOTSTRAP_DEMO_PROJECT=true`}</CodeBlock>
      <p>
        Create project API keys in the <Link to="/admin">relay admin</Link>. Each project gets an isolated gas tank address
        to fund.
      </p>
    </DocPage>
  );
}

export function RelayApiSection() {
  return (
    <DocPage title="Relay API">
      <div className="doc-table-wrap">
        <table className="doc-table">
          <thead>
            <tr>
              <th>Endpoint</th>
              <th>Auth</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>GET /health</code>
              </td>
              <td>None</td>
              <td>Relay status, sponsorAddress, network</td>
            </tr>
            <tr>
              <td>
                <code>GET /v1/project</code>
              </td>
              <td>Bearer API key</td>
              <td>Project gas balance + gas tank address</td>
            </tr>
            <tr>
              <td>
                <code>GET /v1/accounts/template</code>
              </td>
              <td>None</td>
              <td>Smart account Clarity source for self-deploy</td>
            </tr>
            <tr>
              <td>
                <code>POST /v1/accounts/ensure</code>
              </td>
              <td>Bearer API key</td>
              <td>Factory registry after client deploy ({`{ publicKeyHex, originAddress }`})</td>
            </tr>
            <tr>
              <td>
                <code>POST /v1/catalog/ensure</code>
              </td>
              <td>Bearer API key</td>
              <td>Register app on passkey-adapter</td>
            </tr>
            <tr>
              <td>
                <code>POST /sponsor</code>
              </td>
              <td>Bearer API key</td>
              <td>Co-sign sponsored tx ({`{ txHex, billingMode }`})</td>
            </tr>
            <tr>
              <td>
                <code>GET/POST /v1/admin/*</code>
              </td>
              <td>X-Admin-Key</td>
              <td>Project + gas tank management</td>
            </tr>
          </tbody>
        </table>
      </div>
    </DocPage>
  );
}

export function ReactHooksSection() {
  return (
    <DocPage title="React hooks">
      <p>
        <code>usePasskeyAccount()</code> returns:
      </p>
      <ul>
        <li>
          <code>session</code>, <code>isRegistered</code>, <code>loading</code>, <code>error</code>
        </li>
        <li>
          <code>register</code>, <code>signIn</code>, <code>logout</code>
        </li>
        <li>
          <code>transfer(recipient, amount)</code>, <code>invoke(contract, fn, args)</code>
        </li>
        <li>
          <code>gasBalance</code>, <code>gasTankAddress</code>, <code>feeMode</code>
        </li>
      </ul>
      <p>
        <code>usePasskeyClient()</code> exposes the underlying <code>PasskeyClient</code> for advanced use.
      </p>
    </DocPage>
  );
}

export function AdvancedSection() {
  return (
    <DocPage title="Advanced APIs">
      <h3>PasskeyClient methods</h3>
      <ul>
        <li>
          <code>transfer(recipient, amount)</code> — passkey-signed STX transfer from the smart account
        </li>
        <li>
          <code>invoke(contract, fn, args)</code> — passkey-signed adapter invoke
        </li>
        <li>
          <code>executeAction(action, publicKey, credentialId)</code> — low-level passkey-signed action
        </li>
        <li>
          <code>submitSignedAction</code> — broadcast pre-signed WebAuthn assertion
        </li>
        <li>
          <code>getOriginAddress()</code>, <code>getAccountContractId()</code>, <code>getSmartAccountName()</code>
        </li>
        <li>
          <code>getRelayClient()</code> — RelayClient for direct API access
        </li>
        <li>
          <code>setFeeConfig(fee)</code> — switch gasless / account-pay at runtime
        </li>
      </ul>
      <h3>Action types (executeAction)</h3>
      <ul>
        <li>
          <code>{`{ type: 'transfer', recipient, amount }`}</code>
        </li>
        <li>
          <code>{`{ type: 'transfer', recipient, amount, feeRecipient, feeAmount }`}</code> — account-pay
        </li>
        <li>
          <code>{`{ type: 'invoke', contract, function, args }`}</code>
        </li>
        <li>
          <code>{`{ type: 'add-key', newPublicKey }`}</code> — multi-device
        </li>
        <li>
          <code>{`{ type: 'remove-key', targetPublicKey }`}</code>
        </li>
      </ul>
      <h3>Testing helpers</h3>
      <CodeBlock>{`import { createTestPasskey, signWebAuthnAssertion } from '@stacks-passkey/core';

const testPasskey = createTestPasskey();
await client.registerWithTestPasskey({ testPasskey, userId, userName });
await client.executeActionWithTestPasskey(action, testPasskey);`}</CodeBlock>
      <h3>Read-only helpers</h3>
      <ul>
        <li>
          <code>fetchActionHash(network, contract, action, sender)</code>
        </li>
        <li>
          <code>isPublicKeyAuthorized(...)</code>
        </li>
        <li>
          <code>isContractRegistered(adapter, contractId)</code>
        </li>
        <li>
          <code>isContractDeployed(network, address, name)</code>
        </li>
      </ul>
    </DocPage>
  );
}

export function CliSection() {
  return (
    <DocPage title="spk CLI">
      <CodeBlock>{`npx spk init                              # create passkey.manifest.json
npx spk ensure ST...my-app                # register app via relay catalog

# Env for CLI
export SPK_RELAY_URL=http://localhost:8787
export SPK_RELAY_API_KEY=spk_...`}</CodeBlock>
    </DocPage>
  );
}

export function EnvSection() {
  return (
    <DocPage title="Environment variables">
      <h3>Frontend (Vite demo / your app)</h3>
      <CodeBlock>{`VITE_RELAY_URL=http://localhost:8787
VITE_RELAY_API_KEY=spk_...
VITE_DEPLOYER_ADDRESS=ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ
VITE_RELAY_ADMIN_API_KEY=admin-...       # admin portal only
VITE_ADMIN_ADDRESSES=ST...,ST...         # optional admin wallet allowlist`}</CodeBlock>
      <h3>Relay server</h3>
      <p>
        See <code>packages/relay/.env.example</code> for sponsor keys, factory addresses, rate limits, and gas tank path.
      </p>
    </DocPage>
  );
}

export function SecuritySection() {
  return (
    <DocPage title="Security">
      <ul>
        <li>Passkey private keys never leave the device secure enclave</li>
        <li>Relay holds sponsor key only — cannot forge WebAuthn signatures</li>
        <li>Adapter registry limits which contracts are reachable via invoke</li>
        <li>Action hashes bind nonce + function + args (sign-count replay protection)</li>
        <li>
          <strong>Production:</strong> do not embed relay API keys in public frontends — proxy sponsor requests through
          your backend
        </li>
      </ul>
    </DocPage>
  );
}

export function TroubleshootingSection() {
  return (
    <DocPage title="Troubleshooting">
      <h3>abort_by_response on sign-up</h3>
      <p>
        Usually a bad smart-account deploy (adapter references). Ensure relay serves injected template from{' '}
        <code>/v1/accounts/template</code> and restart relay after updates.
      </p>
      <h3>Unexpected action hash from read-only call</h3>
      <p>
        Update to latest SDK — fixes parsing of <code>(ok buff)</code> responses from compute-*-hash functions.
      </p>
      <h3>Transfer fails / insufficient balance</h3>
      <p>Fund the smart account contract address, not the origin ST address.</p>
      <h3>Invoke succeeds but app contract page shows no tx</h3>
      <p>Expected — check outer tx Events tab for your app&apos;s print events.</p>
      <h3>Relay rejected transaction</h3>
      <p>Check ALLOWED_CONTRACTS, gas tank balance, and API key project limits.</p>
    </DocPage>
  );
}
