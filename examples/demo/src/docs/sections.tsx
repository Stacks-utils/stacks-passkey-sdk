import { Link } from 'react-router-dom';
import { HOW_IT_WORKS, PLAYGROUND_FEATURES } from '../content/portal-content.js';
import { Callout, CodeBlock, DocLinkGrid, DocPage, FeatureGrid, StepGuide } from './components.js';

const TESTNET_DEPLOYER = 'ST3XHHZ1CXVCNYXK3FQ1FDGJ9NK6YBJBJK3FVY5KQ';
const DEMO_APP = `${TESTNET_DEPLOYER}.passkey-demo-app`;

export function GettingStartedSection() {
  return (
    <DocPage
      title="Getting started"
      lead="Add passkey smart accounts to your Stacks app in under an hour — no browser wallet extension, no seed phrases."
    >
      <section className="doc-hero-block">
        <h2>Why use this SDK?</h2>
        <FeatureGrid
          items={[
            {
              title: 'Web2-style onboarding',
              description:
                'Users sign up with Face ID, Touch ID, or a security key. No Leather/Xverse install, no 24-word backup.',
            },
            {
              title: 'Gasless by default',
              description:
                'Your relay sponsors network fees from a project gas tank. Users can transact with zero STX for gas.',
            },
            {
              title: 'On-chain passkey verification',
              description:
                'Actions are authorized with WebAuthn and verified in Clarity with secp256r1 — the relay cannot forge signatures.',
            },
            {
              title: 'Call your Clarity app',
              description:
                'Use invoke() to route passkey-signed calls to your contract through the universal passkey-adapter.',
            },
          ]}
        />
      </section>

      <Callout title="What you need from your infra provider" variant="tip">
        <ul>
          <li>
            <strong>Relay URL</strong> — e.g. <code>http://localhost:8787</code> (local) or your hosted relay
          </li>
          <li>
            <strong>API key</strong> — <code>spk_...</code> from the <Link to="/portal">dev portal</Link>
          </li>
          <li>
            <strong>Deployer address</strong> — platform factory + adapter (shared testnet:{' '}
            <code>{TESTNET_DEPLOYER}</code>)
          </li>
        </ul>
        You do <em>not</em> deploy core contracts yourself unless you run the full stack — see{' '}
        <Link to="/docs/relay">Run your own relay</Link>.
      </Callout>

      <h2>Integration path (follow in order)</h2>
      <StepGuide
        steps={[
          {
            title: 'Install packages',
            summary: 'Add @stacks-passkey/core, @stacks-passkey/react, and @stacks/network to your frontend.',
            link: { to: '/docs/install', label: 'Install guide' },
          },
          {
            title: 'Configure PasskeyProvider',
            summary: 'Set relay URL, API key, deployer address, and WebAuthn rpId/origin.',
            link: { to: '/docs/quickstart', label: 'React quick start' },
          },
          {
            title: 'Sign up & sign in',
            summary: 'Call register() once per user; signIn() for returning users. Session persists in localStorage.',
            link: { to: '/docs/signup', label: 'Sign-up guide' },
          },
          {
            title: 'Transfer STX (optional)',
            summary: 'Fund the user smart account, then call transfer(recipient, amount).',
            link: { to: '/docs/transfers', label: 'Transfers guide' },
          },
          {
            title: 'Invoke your app contract',
            summary: 'Call invoke(contractId, functionName, args) — catalog registration is automatic.',
            link: { to: '/docs/invoke', label: 'Invoke guide' },
          },
          {
            title: 'Choose a fee mode',
            summary: 'Gasless (project pays) or account-pay (smart account reimburses relay at a fixed fee).',
            link: { to: '/docs/fee-modes', label: 'Fee modes' },
          },
        ]}
      />

      <h2>Try it first</h2>
      <p>
        Open the <Link to="/demo">live playground</Link> to register a passkey, invoke <code>set-score</code>, and
        transfer STX on testnet — every button maps to a real SDK method.
      </p>
      <FeatureGrid items={PLAYGROUND_FEATURES} />

      <h2>More reference</h2>
      <DocLinkGrid
        links={[
          { to: '/docs/config', title: 'PasskeyClient config', desc: 'Every option explained in one table.' },
          { to: '/docs/react-hooks', title: 'React hooks', desc: 'usePasskeyAccount() return values and methods.' },
          { to: '/docs/app-contract', title: 'Your Clarity app', desc: 'Implement passkey-exec on your contract.' },
          { to: '/docs/troubleshooting', title: 'Troubleshooting', desc: 'Common errors and fixes.' },
        ]}
      />
    </DocPage>
  );
}

export function PlaygroundSection() {
  return (
    <DocPage
      title="Live playground"
      lead="Exercise the SDK against real testnet contracts — nothing is mocked in the UI."
    >
      <Callout variant="tip">
        Open <Link to="/demo">/demo</Link> in another tab and follow along with the integration guide.
      </Callout>
      <FeatureGrid items={PLAYGROUND_FEATURES} />
      <h3>Demo contract</h3>
      <p>
        <code>{DEMO_APP}</code> implements <code>passkey-exec</code> with <code>set-score</code>,{' '}
        <code>add-score</code>, and <code>reset-score</code>. The playground calls <code>set-score</code> with a value
        you choose (<code>arg0</code>) for your origin principal.
      </p>
      <h3>What each playground action calls</h3>
      <div className="doc-table-wrap">
        <table className="doc-table">
          <thead>
            <tr>
              <th>UI action</th>
              <th>SDK method</th>
              <th>On-chain function</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Sign up with passkey</td>
              <td>
                <code>register()</code>
              </td>
              <td>
                Deploy <code>smart-account</code> + <code>register</code> + factory
              </td>
            </tr>
            <tr>
              <td>Invoke set-score</td>
              <td>
                <code>invoke(app, &apos;set-score&apos;, args)</code>
              </td>
              <td>
                <code>execute-via-adapter</code> → adapter → app
              </td>
            </tr>
            <tr>
              <td>Transfer 100 µSTX</td>
              <td>
                <code>transfer(deployer, 100n)</code>
              </td>
              <td>
                <code>transfer-stx</code> or <code>transfer-stx-with-fee</code>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </DocPage>
  );
}

export function OverviewSection() {
  return (
    <DocPage title="What & why" lead="Passkey smart accounts on Stacks — how the pieces fit together.">
      <h2>The problem this solves</h2>
      <p>
        Browser wallet extensions create friction: install, connect, approve every tx, manage seed phrases. Passkey smart
        accounts give you <strong>biometric sign-in</strong> and <strong>sponsored gas</strong> while keeping
        authorization on-chain.
      </p>

      <h2>Architecture in 30 seconds</h2>
      <ol className="doc-numbered-list">
        {HOW_IT_WORKS.map((step) => (
          <li key={step.num}>
            <strong>{step.title}</strong> — {step.desc}
          </li>
        ))}
      </ol>

      <h2>Packages</h2>
      <div className="doc-table-wrap">
        <table className="doc-table">
          <thead>
            <tr>
              <th>Package</th>
              <th>You use it for</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>@stacks-passkey/core</code>
              </td>
              <td>PasskeyClient, WebAuthn, transfer(), invoke(), relay client</td>
            </tr>
            <tr>
              <td>
                <code>@stacks-passkey/react</code>
              </td>
              <td>PasskeyProvider + usePasskeyAccount() hooks</td>
            </tr>
            <tr>
              <td>
                <code>@stacks-passkey/relay</code>
              </td>
              <td>Self-hosted gas sponsor (optional — use a hosted relay + API key instead)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>On-chain contracts (shared testnet)</h2>
      <ul>
        <li>
          <code>{TESTNET_DEPLOYER}.passkey-factory</code> — maps passkey pubkey → smart account
        </li>
        <li>
          <code>{TESTNET_DEPLOYER}.passkey-adapter</code> — registry + forward to your app
        </li>
        <li>
          <code>{'{origin}'}.smart-account</code> — per-user contract (self-deployed at sign-up)
        </li>
      </ul>

      <Callout title="Security model" variant="info">
        Passkey private keys never leave the device. The relay only co-signs fees — it cannot authorize transfers or
        invokes without a valid WebAuthn signature verified on-chain.
      </Callout>
    </DocPage>
  );
}

export function InstallSection() {
  return (
    <DocPage title="Install packages" lead="Step 1 of the integration guide.">
      <StepGuide
        steps={[
          {
            title: 'Add npm packages',
            summary: 'Install core, React bindings, and Stacks network constants.',
            detail: <CodeBlock>{`npm install @stacks-passkey/core @stacks-passkey/react @stacks/network`}</CodeBlock>,
          },
          {
            title: 'Get relay credentials',
            summary: 'Obtain relay URL + spk_ API key from your operator, or run the relay locally.',
            detail: (
              <p>
                Local dev: <code>npm run dev:relay</code> then create a key in{' '}
                <Link to="/portal">dev portal</Link>.
              </p>
            ),
          },
          {
            title: 'Set environment variables',
            summary: 'Add relay URL, API key, and deployer address to your .env file.',
            link: { to: '/docs/env', label: 'Full env reference' },
          },
        ]}
      />
    </DocPage>
  );
}

export function QuickstartSection() {
  return (
    <DocPage title="Wire up React" lead="Step 2 — minimal PasskeyProvider setup.">
      <h3>1. Environment (.env)</h3>
      <CodeBlock>{`VITE_RELAY_URL=http://localhost:8787
VITE_RELAY_API_KEY=spk_your_project_key
VITE_DEPLOYER_ADDRESS=${TESTNET_DEPLOYER}`}</CodeBlock>

      <h3>2. Wrap your app</h3>
      <CodeBlock>{`import { PasskeyProvider } from '@stacks-passkey/react';
import { STACKS_TESTNET } from '@stacks/network';

const passkeyConfig = {
  network: STACKS_TESTNET,
  relayUrl: import.meta.env.VITE_RELAY_URL,
  relayApiKey: import.meta.env.VITE_RELAY_API_KEY,
  deployerAddress: import.meta.env.VITE_DEPLOYER_ADDRESS,
  rpId: window.location.hostname,
  rpName: 'My App',
  origin: window.location.origin,
  fee: {
    mode: 'gasless',
    relayUrl: import.meta.env.VITE_RELAY_URL,
    relayApiKey: import.meta.env.VITE_RELAY_API_KEY,
  },
};

export function App() {
  return (
    <PasskeyProvider config={passkeyConfig}>
      <MyDapp />
    </PasskeyProvider>
  );
}`}</CodeBlock>

      <h3>3. Use the hook</h3>
      <CodeBlock>{`import { usePasskeyAccount } from '@stacks-passkey/react';

function MyDapp() {
  const { register, signIn, invoke, transfer, session, isRegistered, loading, error } =
    usePasskeyAccount();

  if (!isRegistered) {
    return (
      <>
        <button disabled={loading} onClick={() => register(crypto.randomUUID(), 'User')}>
          Sign up with passkey
        </button>
        <button disabled={loading} onClick={() => signIn()}>Sign in</button>
        {error && <p>{error}</p>}
      </>
    );
  }

  return (
    <>
      <p>Smart account: {session?.contractId}</p>
      <p>Origin: {session?.originAddress}</p>
    </>
  );
}`}</CodeBlock>

      <Callout variant="tip">
        Next: <Link to="/docs/signup">Sign-up & sign-in</Link> for the full flow, then{' '}
        <Link to="/docs/invoke">invoke your app</Link>.
      </Callout>
      <p>
        Full config options: <Link to="/docs/config">PasskeyClient configuration</Link>.
      </p>
    </DocPage>
  );
}

export function ConfigSection() {
  return (
    <DocPage title="PasskeyClient configuration" lead="All PasskeyProvider / PasskeyClient options.">
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
              <td>
                <code>STACKS_TESTNET</code> or <code>STACKS_MAINNET</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>relayUrl</code>
              </td>
              <td>Yes</td>
              <td>Relay base URL for sponsor + catalog + factory</td>
            </tr>
            <tr>
              <td>
                <code>relayApiKey</code>
              </td>
              <td>For gasless / account-pay</td>
              <td>
                Project key — <code>Authorization: Bearer spk_...</code>
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
                <code>rpId</code> / <code>rpName</code> / <code>origin</code>
              </td>
              <td>Yes</td>
              <td>WebAuthn relying party — use your domain on production (HTTPS required)</td>
            </tr>
            <tr>
              <td>
                <code>fee.mode</code>
              </td>
              <td>Recommended</td>
              <td>
                <code>gasless</code> or <code>account-pay</code> — see{' '}
                <Link to="/docs/fee-modes">Fee modes</Link>
              </td>
            </tr>
            <tr>
              <td>
                <code>fee.maxFeeMicroStx</code>
              </td>
              <td>No</td>
              <td>
                Override fixed account-pay reimbursement (default: relay <code>sponsorFeeMicroStx</code>)
              </td>
            </tr>
            <tr>
              <td>
                <code>smartAccountName</code>
              </td>
              <td>No</td>
              <td>
                Default <code>smart-account</code>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Switch fee mode at runtime: <code>client.setFeeConfig(fee)</code> or remount <code>PasskeyProvider</code> with a
        new <code>fee.mode</code>.
      </p>
    </DocPage>
  );
}

export function AccountModesSection() {
  return (
    <DocPage title="Smart account model">
      <p>
        Every user gets a passkey-controlled Clarity contract at <code>{'{origin}'}.smart-account</code>:
      </p>
      <ul>
        <li>
          <strong>Origin key</strong> (secp256k1, SDK-derived) — signs the outer Stacks transaction envelope
        </li>
        <li>
          <strong>Passkey</strong> (P-256, device enclave) — authorizes each action via WebAuthn + on-chain verify
        </li>
        <li>
          <strong>Contract STX balance</strong> — used for transfers and account-pay fees (not for outer tx gas)
        </li>
      </ul>
      <CodeBlock>{`await client.register(userId, displayName);
// → session.contractId = "STorigin.smart-account"
// → session.originAddress = "STorigin"

await client.transfer('ST...recipient', 100n);
await client.invoke('ST...my-app', 'my-fn', {
  arg0: 1n,
  arg2: client.getOriginAddress(),
});`}</CodeBlock>
      <p>
        Under the hood: <Link to="/docs/self-deploy">Self-deploy flow</Link>.
      </p>
    </DocPage>
  );
}

export function SignupSection() {
  return (
    <DocPage title="Sign-up & sign-in" lead="Step 3 — onboard users with WebAuthn.">
      <StepGuide
        steps={[
          {
            title: 'Sign up (first time)',
            summary: 'Creates passkey, deploys smart account, registers on-chain.',
            detail: (
              <>
                <CodeBlock>{`const { register } = usePasskeyAccount();

await register(crypto.randomUUID(), 'Display Name');
// Returns: { credentialId, contractAddress, contractName, contractId, txid }`}</CodeBlock>
                <p>What happens:</p>
                <ol>
                  <li>WebAuthn creates credential (biometric prompt)</li>
                  <li>SDK derives origin key from passkey public key</li>
                  <li>Relay sponsors deploy of <code>smart-account</code></li>
                  <li>Passkey-signed <code>register</code> on the smart account</li>
                  <li>Relay registers pubkey on <code>passkey-factory</code></li>
                </ol>
              </>
            ),
          },
          {
            title: 'Sign in (returning user)',
            summary: 'Re-authenticates with stored passkey — no new deploy.',
            detail: (
              <CodeBlock>{`const { signIn } = usePasskeyAccount();
const session = await signIn();
// session.contractId, session.originAddress restored`}</CodeBlock>
            ),
          },
          {
            title: 'Log out',
            summary: 'Clears session and stored credentials for this app.',
            detail: <CodeBlock>{`const { logout } = usePasskeyAccount();
logout();`}</CodeBlock>,
          },
        ]}
      />
      <Callout variant="info">
        Session persists in <code>localStorage</code> (credentialId, contractId, originAddress). Origin private keys are
        stored separately per address scope.
      </Callout>
    </DocPage>
  );
}

export function SelfDeploySection() {
  return (
    <DocPage title="Self-deploy flow">
      <p>Inside <code>register()</code> — you do not call these steps manually:</p>
      <ol className="doc-numbered-list">
        <li>WebAuthn registration → compressed secp256r1 public key</li>
        <li>Derive origin ST private key from pubkey + rpId + chainId</li>
        <li>
          Fetch template: <code>GET /v1/accounts/template</code>
        </li>
        <li>Sponsored deploy of <code>smart-account</code> from origin key</li>
        <li>Passkey-signed <code>register(pubkey)</code> on the smart account</li>
        <li>
          Relay <code>POST /v1/accounts/ensure</code> → factory registry
        </li>
      </ol>
      <p>
        The relay injects fully-qualified <code>passkey-adapter</code> references so user-origin deploys resolve the
        platform adapter correctly.
      </p>
    </DocPage>
  );
}

export function FeeModesSection() {
  return (
    <DocPage title="Fee modes" lead="Step 6 — who pays network fees.">
      <div className="doc-table-wrap">
        <table className="doc-table">
          <thead>
            <tr>
              <th>Mode</th>
              <th>Who pays miner fee</th>
              <th>User needs STX?</th>
              <th>Best for</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>gasless</code>
              </td>
              <td>Project gas tank (relay sponsor)</td>
              <td>No (for gas)</td>
              <td>Onboarding, invokes, most dApps</td>
            </tr>
            <tr>
              <td>
                <code>account-pay</code>
              </td>
              <td>Relay sponsors; smart account reimburses gas tank</td>
              <td>Yes (~0.1 STX/action in smart account)</td>
              <td>Users who hold STX in their smart account</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>Gasless (recommended)</h3>
      <CodeBlock>{`fee: {
  mode: 'gasless',
  relayUrl: import.meta.env.VITE_RELAY_URL,
  relayApiKey: import.meta.env.VITE_RELAY_API_KEY,
}`}</CodeBlock>
      <p>Each tx debits up to relay <code>MAX_FEE_MICRO_STX</code> from your project gas tank. Fund the tank in the dev portal.</p>

      <h3>Account-pay</h3>
      <CodeBlock>{`fee: {
  mode: 'account-pay',
  relayUrl: import.meta.env.VITE_RELAY_URL,
  relayApiKey: import.meta.env.VITE_RELAY_API_KEY,
  // feeRecipient auto-resolved from /v1/project → gasTankAddress
  // fixed fee auto-synced from relay sponsorFeeMicroStx (~0.1 STX)
}`}</CodeBlock>
      <p>
        Relay still co-signs the outer tx. The smart account executes <code>transfer-stx-with-fee</code> or{' '}
        <code>execute-via-adapter-with-fee</code> to reimburse the gas tank at a <strong>fixed fee</strong> (not a
        dynamic estimate).
      </p>
      <Callout variant="warn">
        Registration always uses gasless sponsorship — even in account-pay mode — because new users may not have STX yet.
      </Callout>
    </DocPage>
  );
}

export function TransfersSection() {
  return (
    <DocPage title="Transfer STX" lead="Step 4 — passkey-signed STX from the smart account.">
      <StepGuide
        steps={[
          {
            title: 'Fund the smart account',
            summary: 'Send testnet STX to session.contractId (not the origin address).',
            detail: (
              <p>
                Check balance via explorer or Hiro. The playground shows balance on the account card after sign-up.
              </p>
            ),
          },
          {
            title: 'Call transfer()',
            summary: 'Amount is in micro-STX (1 STX = 1_000_000 µSTX).',
            detail: (
              <CodeBlock>{`const { transfer } = usePasskeyAccount();

// Send 1000 µSTX (0.001 STX)
await transfer('ST...recipient', 1000n);`}</CodeBlock>
            ),
          },
          {
            title: 'Account-pay adds a fee transfer',
            summary: 'In account-pay mode, transfer-stx-with-fee also reimburses the relay.',
            link: { to: '/docs/fee-modes', label: 'Fee modes' },
          },
        ]}
      />
    </DocPage>
  );
}

export function InvokeSection() {
  return (
    <DocPage title="Invoke your app contract" lead="Step 5 — call your Clarity logic with passkey authorization.">
      <StepGuide
        steps={[
          {
            title: 'Implement passkey-exec on your contract',
            summary: 'Your app routes function-name + arg slots to your logic.',
            link: { to: '/docs/app-contract', label: 'Clarity app guide' },
          },
          {
            title: 'Call invoke()',
            summary: 'SDK auto-registers your contract on passkey-adapter via relay catalog.',
            detail: (
              <CodeBlock>{`const { invoke, session } = usePasskeyAccount();

await invoke(
  '${DEMO_APP}',
  'set-score',
  { arg0: 42n, arg2: session?.originAddress }
);`}</CodeBlock>
            ),
          },
          {
            title: 'Read results on-chain',
            summary: 'Outer tx calls execute-via-adapter on the smart account. Your app events appear in the tx Events tab.',
          },
        ]}
      />

      <h3>Invoke arg slots (passkey-exec)</h3>
      <p>All invoke args map to five Clarity slots on your target contract:</p>
      <CodeBlock>{`{
  arg0?: bigint,       // e.g. score, amount
  arg1?: bigint,
  arg2?: principal,    // e.g. user address
  arg3?: principal,
  arg4?: Uint8Array,
}`}</CodeBlock>

      <Callout title="Explorer tip" variant="tip">
        Hiro shows the outer tx as <code>execute-via-adapter</code> on the smart account. Your app&apos;s{' '}
        <code>print</code> events are under the transaction <strong>Events</strong> tab — not as a separate top-level
        tx on the app contract page.
      </Callout>
    </DocPage>
  );
}

export function AppContractSection() {
  return (
    <DocPage title="Your Clarity app contract">
      <StepGuide
        steps={[
          {
            title: 'Implement the trait',
            summary: 'Route passkey-exec calls to your public functions.',
            detail: (
              <CodeBlock>{`(impl-trait 'STdeployer.passkey-adapter.passkey-exec-trait)

(define-public (passkey-exec
    (function-name (string-ascii 128))
    (arg0 uint) (arg1 uint)
    (arg2 principal) (arg3 principal)
    (arg4 (buff 1024))
  )
  (match function-name
    "set-score" (set-score arg0 arg2)
    "reset-score" (reset-score arg2)
    (err u404)
  )
)`}</CodeBlock>
            ),
          },
          {
            title: 'Deploy to testnet',
            summary: 'Use Clarinet or your existing deploy pipeline.',
          },
          {
            title: 'Register on adapter',
            summary: 'Automatic on first invoke(), or run npx spk ensure ST...my-app.',
            link: { to: '/docs/cli', label: 'spk CLI' },
          },
        ]}
      />
      <p>
        Working example: <code>examples/demo/contracts/passkey-demo-app.clar</code>
      </p>
    </DocPage>
  );
}

export function RelaySection() {
  return (
    <DocPage title="Relay setup" lead="Self-host gas sponsorship and catalog (optional).">
      <CodeBlock>{`cp packages/relay/.env.example packages/relay/.env
./scripts/setup-relay-key.sh
npm run dev:relay`}</CodeBlock>
      <p>Minimum env vars:</p>
      <CodeBlock>{`PASSKEY_DEPLOYER_ADDRESS=${TESTNET_DEPLOYER}
PASSKEY_ADAPTER_ADDRESS=${TESTNET_DEPLOYER}
ALLOWED_CONTRACTS=${TESTNET_DEPLOYER}
MAX_FEE_MICRO_STX=100000
SPONSOR_PRIVATE_KEY_FILE=./sponsor.key`}</CodeBlock>
      <p>
        Create project API keys in the <Link to="/portal">dev portal</Link>. Each project gets an isolated gas tank address.
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
              <td>Status, sponsorAddress, sponsorFeeMicroStx, network</td>
            </tr>
            <tr>
              <td>
                <code>GET /v1/project</code>
              </td>
              <td>Bearer spk_...</td>
              <td>Gas tank balance, gasTankAddress, sponsorFeeMicroStx</td>
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
              <td>Bearer spk_...</td>
              <td>Factory registry after client deploy</td>
            </tr>
            <tr>
              <td>
                <code>POST /v1/catalog/ensure</code>
              </td>
              <td>Bearer spk_...</td>
              <td>Register app on passkey-adapter</td>
            </tr>
            <tr>
              <td>
                <code>POST /sponsor</code>
              </td>
              <td>Bearer spk_...</td>
              <td>Co-sign sponsored tx</td>
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
      <h3>usePasskeyAccount()</h3>
      <div className="doc-table-wrap">
        <table className="doc-table">
          <thead>
            <tr>
              <th>Property / method</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>session</code>
              </td>
              <td>
                contractId, originAddress, publicKeyHex, credentialId (null when logged out)
              </td>
            </tr>
            <tr>
              <td>
                <code>isRegistered</code>, <code>loading</code>, <code>error</code>
              </td>
              <td>UI state</td>
            </tr>
            <tr>
              <td>
                <code>register(userId, name)</code>
              </td>
              <td>Sign up — deploy + register</td>
            </tr>
            <tr>
              <td>
                <code>signIn()</code>, <code>logout()</code>
              </td>
              <td>Returning user / clear session</td>
            </tr>
            <tr>
              <td>
                <code>transfer(recipient, amount)</code>
              </td>
              <td>Passkey-signed STX transfer (µSTX)</td>
            </tr>
            <tr>
              <td>
                <code>invoke(contract, fn, args?)</code>
              </td>
              <td>Passkey-signed adapter invoke</td>
            </tr>
            <tr>
              <td>
                <code>gasBalance</code>, <code>gasTankAddress</code>
              </td>
              <td>Project gas tank (from API key)</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        <code>usePasskeyClient()</code> — direct access to <code>PasskeyClient</code> for advanced use.
      </p>
    </DocPage>
  );
}

export function AdvancedSection() {
  return (
    <DocPage title="Advanced APIs">
      <h3>PasskeyClient (vanilla / advanced)</h3>
      <CodeBlock>{`import { PasskeyClient } from '@stacks-passkey/core';

const client = new PasskeyClient({ ...config });
await client.init(); // resolves feeRecipient for account-pay

await client.register(userId, userName);
await client.signIn();
await client.transfer('ST...', 100n);
await client.invoke('ST...app', 'fn', { arg0: 1n });

// Low-level
await client.executeAction({ type: 'transfer', recipient, amount }, publicKey, credentialId);`}</CodeBlock>
      <h3>Action types</h3>
      <ul>
        <li>
          <code>{`{ type: 'transfer', recipient, amount }`}</code>
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
      <h3>Testing without WebAuthn</h3>
      <CodeBlock>{`import { createTestPasskey } from '@stacks-passkey/core';

const testPasskey = createTestPasskey();
await client.registerWithTestPasskey({ contractAddress, contractName });
await client.executeActionWithTestPasskey(action, testPasskey);`}</CodeBlock>
    </DocPage>
  );
}

export function CliSection() {
  return (
    <DocPage title="spk CLI">
      <CodeBlock>{`npx spk init                              # create passkey.manifest.json
npx spk ensure ST...my-app                # register app via relay catalog

export SPK_RELAY_URL=http://localhost:8787
export SPK_RELAY_API_KEY=spk_...`}</CodeBlock>
    </DocPage>
  );
}

export function EnvSection() {
  return (
    <DocPage title="Environment variables">
      <h3>Frontend (Vite / your app)</h3>
      <CodeBlock>{`VITE_RELAY_URL=http://localhost:8787
VITE_RELAY_API_KEY=spk_...
VITE_DEPLOYER_ADDRESS=${TESTNET_DEPLOYER}
VITE_RELAY_ADMIN_API_KEY=admin-...   # admin portal only`}</CodeBlock>
      <h3>Relay server</h3>
      <p>
        See <code>packages/relay/.env.example</code> — sponsor keys, factory addresses, MAX_FEE_MICRO_STX, gas tank path.
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
        <li>Action hashes bind nonce + args; sign-count prevents replay</li>
        <li>
          <strong>Production:</strong> proxy relay API keys through your backend — do not ship{' '}
          <code>spk_...</code> in public client bundles
        </li>
      </ul>
    </DocPage>
  );
}

export function TroubleshootingSection() {
  return (
    <DocPage title="Troubleshooting">
      <div className="doc-table-wrap">
        <table className="doc-table">
          <thead>
            <tr>
              <th>Symptom</th>
              <th>Fix</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Sign-up fails with <code>(err none)</code></td>
              <td>
                Smart-account deploy failed — restart relay so <code>/v1/accounts/template</code> has correct adapter
                refs. Sign up with a new passkey.
              </td>
            </tr>
            <tr>
              <td>
                <code>feeRecipient</code> error in account-pay
              </td>
              <td>
                Set <code>relayApiKey</code> so SDK can read <code>gasTankAddress</code> from{' '}
                <code>/v1/project</code>
              </td>
            </tr>
            <tr>
              <td>Transfer fails / insufficient balance</td>
              <td>Fund <code>session.contractId</code> (smart account), not origin address</td>
            </tr>
            <tr>
              <td>Invoke works but app page shows no tx</td>
              <td>Expected — check outer tx Events tab for your app prints</td>
            </tr>
            <tr>
              <td>Relay rejected transaction</td>
              <td>Check gas tank balance, ALLOWED_CONTRACTS, valid API key</td>
            </tr>
            <tr>
              <td>No passkeys found on sign-in</td>
              <td>Use same browser/domain as sign-up; check rpId matches hostname</td>
            </tr>
          </tbody>
        </table>
      </div>
    </DocPage>
  );
}
