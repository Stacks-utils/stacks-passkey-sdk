import type { ComponentType } from 'react';
import {
  AccountModesSection,
  AdvancedSection,
  AppContractSection,
  CliSection,
  ConfigSection,
  EnvSection,
  FeeModesSection,
  GettingStartedSection,
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
  group?: string;
};

export const DOC_PAGES: DocPageDef[] = [
  { slug: 'getting-started', label: 'Getting started', title: 'Getting started', Section: GettingStartedSection, group: 'Start here' },
  { slug: 'playground', label: 'Live playground', title: 'Live playground', Section: PlaygroundSection, group: 'Start here' },
  { slug: 'overview', label: 'What & why', title: 'What & why', Section: OverviewSection, group: 'Start here' },

  { slug: 'install', label: '1. Install', title: 'Install packages', Section: InstallSection, group: 'Integration guide' },
  { slug: 'quickstart', label: '2. Wire up React', title: 'Wire up React', Section: QuickstartSection, group: 'Integration guide' },
  { slug: 'signup', label: '3. Sign-up & sign-in', title: 'Sign-up & sign-in', Section: SignupSection, group: 'Integration guide' },
  { slug: 'transfers', label: '4. Transfer STX', title: 'Transfer STX', Section: TransfersSection, group: 'Integration guide' },
  { slug: 'invoke', label: '5. Invoke your app', title: 'Invoke your app contract', Section: InvokeSection, group: 'Integration guide' },
  { slug: 'fee-modes', label: '6. Fee modes', title: 'Fee modes', Section: FeeModesSection, group: 'Integration guide' },

  { slug: 'config', label: 'PasskeyClient config', title: 'PasskeyClient configuration', Section: ConfigSection, group: 'Reference' },
  { slug: 'smart-account', label: 'Smart account model', title: 'Smart account model', Section: AccountModesSection, group: 'Reference' },
  { slug: 'self-deploy', label: 'Self-deploy flow', title: 'Self-deploy flow', Section: SelfDeploySection, group: 'Reference' },
  { slug: 'app-contract', label: 'Your Clarity app', title: 'Your Clarity app contract', Section: AppContractSection, group: 'Reference' },
  { slug: 'react-hooks', label: 'React hooks', title: 'React hooks', Section: ReactHooksSection, group: 'Reference' },
  { slug: 'relay-api', label: 'Relay API', title: 'Relay API', Section: RelayApiSection, group: 'Reference' },
  { slug: 'advanced', label: 'Advanced APIs', title: 'Advanced APIs', Section: AdvancedSection, group: 'Reference' },

  { slug: 'relay', label: 'Run your own relay', title: 'Relay setup', Section: RelaySection, group: 'Operations' },
  { slug: 'cli', label: 'spk CLI', title: 'spk CLI', Section: CliSection, group: 'Operations' },
  { slug: 'env', label: 'Environment variables', title: 'Environment variables', Section: EnvSection, group: 'Operations' },
  { slug: 'security', label: 'Security', title: 'Security', Section: SecuritySection, group: 'Operations' },
  { slug: 'troubleshooting', label: 'Troubleshooting', title: 'Troubleshooting', Section: TroubleshootingSection, group: 'Operations' },
];

export const DOC_PAGES_BY_SLUG = Object.fromEntries(DOC_PAGES.map((page) => [page.slug, page])) as Record<
  string,
  DocPageDef
>;

export const DEFAULT_DOC_SLUG = 'getting-started';

export const DOC_NAV_GROUPS = [...new Set(DOC_PAGES.map((p) => p.group).filter(Boolean))] as string[];

export function docPagesInGroup(group: string): DocPageDef[] {
  return DOC_PAGES.filter((p) => p.group === group);
}
