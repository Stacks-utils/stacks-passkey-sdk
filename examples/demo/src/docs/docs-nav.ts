import type { ComponentType } from 'react';
import {
  AccountModesSection,
  AdvancedSection,
  AppContractSection,
  CliSection,
  ConfigSection,
  EnvSection,
  FeeModesSection,
  InstallSection,
  InvokeSection,
  OverviewSection,
  PlaygroundSection,
  QuickstartSection,
  ReactHooksSection,
  RelayApiSection,
  RelaySection,
  SecuritySection,
  SelfDeploySection,
  SignupSection,
  TransfersSection,
  TroubleshootingSection,
} from './sections.js';

export type DocPageDef = {
  slug: string;
  label: string;
  title: string;
  Section: ComponentType;
};

export const DOC_PAGES: DocPageDef[] = [
  { slug: 'playground', label: 'Playground', title: 'Playground', Section: PlaygroundSection },
  { slug: 'overview', label: 'Overview', title: 'Overview', Section: OverviewSection },
  { slug: 'install', label: 'Installation', title: 'Installation', Section: InstallSection },
  { slug: 'quickstart', label: 'Quick start (React)', title: 'Quick start (React)', Section: QuickstartSection },
  { slug: 'config', label: 'PasskeyClient config', title: 'PasskeyClient configuration', Section: ConfigSection },
  { slug: 'smart-account', label: 'Smart account', title: 'Smart account', Section: AccountModesSection },
  { slug: 'signup', label: 'Sign-up & sign-in', title: 'Sign-up & sign-in', Section: SignupSection },
  { slug: 'self-deploy', label: 'Self-deploy smart account', title: 'Self-deploy smart account', Section: SelfDeploySection },
  { slug: 'fee-modes', label: 'Fee modes', title: 'Fee modes', Section: FeeModesSection },
  { slug: 'transfers', label: 'Transfers', title: 'Transfers', Section: TransfersSection },
  { slug: 'invoke', label: 'Invoke app contracts', title: 'Invoke app contracts', Section: InvokeSection },
  { slug: 'app-contract', label: 'Your Clarity app', title: 'Your Clarity app contract', Section: AppContractSection },
  { slug: 'relay', label: 'Relay setup', title: 'Relay setup', Section: RelaySection },
  { slug: 'relay-api', label: 'Relay API', title: 'Relay API', Section: RelayApiSection },
  { slug: 'react-hooks', label: 'React hooks', title: 'React hooks', Section: ReactHooksSection },
  { slug: 'advanced', label: 'Advanced APIs', title: 'Advanced APIs', Section: AdvancedSection },
  { slug: 'cli', label: 'spk CLI', title: 'spk CLI', Section: CliSection },
  { slug: 'env', label: 'Environment variables', title: 'Environment variables', Section: EnvSection },
  { slug: 'security', label: 'Security', title: 'Security', Section: SecuritySection },
  { slug: 'troubleshooting', label: 'Troubleshooting', title: 'Troubleshooting', Section: TroubleshootingSection },
];

export const DOC_PAGES_BY_SLUG = Object.fromEntries(DOC_PAGES.map((page) => [page.slug, page])) as Record<
  string,
  DocPageDef
>;

export const DEFAULT_DOC_SLUG = DOC_PAGES[0].slug;
