import testnet from '../../../config/testnet.json';

const deployer = testnet.deployer;

/** Public testnet relay hosted on Render (default for portal demo + docs). */
export const HOSTED_RELAY_URL = 'https://stacks-passkey-relay.onrender.com';

/** Local relay from `npm run dev:relay`. */
export const LOCAL_RELAY_URL = 'http://localhost:8787';

export const testnetConfig = {
  network: 'testnet' as const,
  deployer,
  relayUrl: import.meta.env.VITE_RELAY_URL ?? HOSTED_RELAY_URL,
  deployerAddress: import.meta.env.VITE_DEPLOYER_ADDRESS ?? deployer,
  factoryName: import.meta.env.VITE_FACTORY_NAME ?? testnet.contracts.passkeyFactory.name,
  passkeyAdapterId: testnet.contracts.passkeyAdapter.id,
  passkeyDemoAppId: testnet.contracts.passkeyDemoApp.id,
  passkeyFactoryId: testnet.contracts.passkeyFactory.id,
  webauthnVerifierId: testnet.contracts.webauthnVerifier.id,
  passkeyRecoveryId: testnet.contracts.passkeyRecovery.id,
};
