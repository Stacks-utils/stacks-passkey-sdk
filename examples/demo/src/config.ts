import testnet from '../../../config/testnet.json';

export const testnetConfig = {
  network: 'testnet' as const,
  deployer: testnet.deployer,
  relayUrl: import.meta.env.VITE_RELAY_URL ?? 'http://localhost:8787',
  contractAddress: import.meta.env.VITE_CONTRACT_ADDRESS ?? testnet.contracts.passkeyAccount.address,
  contractName: import.meta.env.VITE_CONTRACT_NAME ?? testnet.contracts.passkeyAccount.name,
  passkeyAccountId: testnet.contracts.passkeyAccount.id,
  webauthnVerifierId: testnet.contracts.webauthnVerifier.id,
  passkeyRecoveryId: testnet.contracts.passkeyRecovery.id,
};
