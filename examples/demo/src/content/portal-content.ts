export const PORTAL_TOOLS = [
  {
    to: '/demo',
    title: 'Live playground',
    desc: 'Register with a passkey, transfer STX, and invoke passkey-demo-app on testnet.',
    badge: 'Playground',
    accent: 'var(--playground)',
  },
  {
    to: '/docs/getting-started',
    title: 'Developer docs',
    desc: 'Step-by-step SDK integration — install, sign-up, invoke, fee modes, and API reference.',
    badge: 'Guide',
    accent: 'var(--forge-accent)',
  },
  {
    to: '/admin',
    title: 'Relay admin',
    desc: 'Create API keys, fund gas tanks, and review sponsored transaction logs.',
    badge: 'Operations',
    accent: 'var(--text)',
  },
  {
    to: '/docs/overview',
    title: 'Architecture',
    desc: 'Self-deploy smart accounts, passkey-adapter routing, and relay sponsorship.',
    badge: 'Deep dive',
    accent: 'var(--primary)',
  },
] as const;

export const PLAYGROUND_FEATURES = [
  {
    title: 'Passkey sign-up & sign-in',
    description:
      'WebAuthn registration creates a credential. The SDK derives an origin key and restores sessions from browser storage.',
  },
  {
    title: 'Self-deploy smart account',
    description:
      'On sign-up, the relay sponsors deploy of STorigin.smart-account and registers the pubkey on passkey-factory.',
  },
  {
    title: 'Gasless & account-pay',
    description:
      'Switch fee mode in the playground. Gasless uses your project gas tank; account-pay reimburses the relay from the smart account.',
  },
  {
    title: 'STX transfer',
    description:
      'Passkey-signed transfer from the smart account (100 µSTX to the demo deployer in this app). Fund the smart account on testnet first.',
  },
  {
    title: 'invoke() demo contract',
    description:
      'Calls set-score on passkey-demo-app through passkey-adapter. Score is stored per origin principal and shown in the UI.',
  },
] as const;

export const HOW_IT_WORKS = [
  {
    num: 1,
    title: 'Passkey',
    desc: 'User registers WebAuthn (Face ID, Touch ID, or security key). SDK extracts secp256r1 public key.',
  },
  {
    num: 2,
    title: 'Self-deploy',
    desc: 'Origin key deploys STorigin.smart-account. Relay injects adapter references into the contract template.',
  },
  {
    num: 3,
    title: 'Gas sponsorship',
    desc: 'Relay co-signs transactions using the sponsor key. Project gas tank balance is tied to your API key.',
  },
  {
    num: 4,
    title: 'Adapter invoke',
    desc: 'Signed actions hit execute-via-adapter on the smart account; passkey-adapter forwards to your passkey-exec contract.',
  },
] as const;

export const DEMO_COPY = {
  rpName: 'Stacks Passkey Demo',
  signupTitle: 'Sign up with a passkey',
  signupLead:
    'Create a WebAuthn credential, self-deploy your smart account on testnet, and sign transactions without a browser wallet extension.',
  accountLabel: 'Smart account',
  statLabel: 'Demo score',
  primaryAction: 'Invoke set-score',
  secondaryAction: 'Transfer 100 µSTX',
  flowTitle: 'Passkey smart account flow',
} as const;
