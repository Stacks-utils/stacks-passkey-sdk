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
    to: '/portal',
    title: 'Dev portal',
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

export const LANDING_HERO = {
  headline: 'The passkey layer for Stacks smart accounts',
  subheadline:
    'Empower your dApp with wallet-less onboarding — biometric sign-in, self-deployed accounts, gasless transactions, and adapter-based contract calls.',
  primaryCta: 'Explore the playground',
  secondaryCta: 'Watch demo video',
  secondaryCtaHref: 'https://screen.studio/share/SKH9qyds',
  trustItems: ['No seed phrase', 'WebAuthn on device', 'Relay-sponsored gas'],
} as const;

export const LANDING_HERO_CARD = {
  badge: 'npm v0.1.0',
  title: 'Interactive SDK playground',
  description: 'Sign up with a passkey, deploy a smart account, invoke passkey-demo-app, and inspect real transactions.',
  linkTo: '/demo',
  linkLabel: 'Open playground',
} as const;

export const LANDING_STATS = [
  { value: '0', suffix: ' seed words', label: 'Users never manage a recovery phrase' },
  { value: '1', suffix: ' passkey sign', label: 'Authorizes each on-chain action via WebAuthn' },
  { value: '100%', suffix: '', label: 'SDK coverage for sign-up, transfer, and invoke' },
] as const;

export const LANDING_STICKY_FEATURES = [
  {
    title: 'Passkey sign-up & session restore',
    description:
      'register() creates a WebAuthn credential, derives an origin key, and self-deploys STorigin.smart-account. signIn() restores the session from browser storage — no wallet popup.',
    visualKey: 'passkey',
  },
  {
    title: 'Gasless & account-pay fee modes',
    description:
      'Gasless mode bills your project gas tank through the relay. Account-pay reimburses a fixed fee from the smart account STX balance — users stay wallet-less while you control economics.',
    visualKey: 'fees',
  },
  {
    title: 'invoke() through passkey-adapter',
    description:
      'Call any registered app contract with invoke(contract, fn, args). The SDK computes action hashes, collects a passkey signature, and routes execute-via-adapter on-chain.',
    visualKey: 'invoke',
  },
  {
    title: 'Dev portal & API keys',
    description:
      'Fund gas tanks, create spk_ API keys, and audit sponsored transactions from the relay dashboard — scoped per wallet on testnet.',
    visualKey: 'relay',
  },
] as const;

export const TRUST_LOGOS = ['Stacks', 'Bitcoin L2', 'Clarity 5', 'WebAuthn', 'Hiro', 'Passkey Adapter', 'Smart Accounts'] as const;

export const USE_CASE_PILLS = [
  'Consumer dApps',
  'Gaming',
  'DeFi onboarding',
  'NFT minting',
  'Social apps',
  'Enterprise pilots',
  'Hackathons',
  'Mobile-first',
] as const;

export const LANDING_TESTIMONIAL = {
  quote:
    'Passkey accounts finally make Stacks feel like a modern consumer product — sign up with Face ID, invoke your contract, done. No extension, no twelve words.',
  author: 'SDK integrator',
  role: 'Reference architecture · testnet portal',
} as const;

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
