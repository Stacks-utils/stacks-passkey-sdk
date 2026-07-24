export { PasskeyClient } from './passkey-client.js';
export type { PasskeyClientOptions } from './passkey-client.js';
export { RelayClient } from './relay-client.js';
export type { RelayClientOptions } from './relay-client.js';
export { broadcastContractCall, estimateRelayFeeMicroStx, resolveAccountPayFeeMicroStx, type FeeOptions } from './fee.js';
export { assertBroadcastTxid, normalizeTxId } from './broadcast.js';
export { createTestPasskey, signWebAuthnAssertion, buildAuthenticatorData, buildClientDataJSON, computeWebAuthnSignedHash, rsToDer } from './webauthn-crypto.js';
export { derToRS, normalizeLowS, compressP256, base64UrlEncode, base64UrlDecode, bufferToHex, hexToBuffer, concatBytes } from './crypto.js';
export { registerPasskey, authenticatePasskey, signWithPasskey, verifyChallengeInClientData } from './webauthn.js';
export { fetchActionHash, buildExecuteFunctionArgs, getExecuteFunctionName, withAccountPayFee, withAccountPayInvokeFee, isPublicKeyAuthorized, isContractRegistered, createInvokeAction, createContractCallAction, buildContractCallArgs } from './actions.js';
export { normalizeContractCallArgs, CONTRACT_CALL_UNUSED_PRINCIPAL, DEFAULT_MAX_FEE_MICRO_STX } from './types.js';
export { saveSession, loadSession, clearSession, hasSession } from './session.js';
export {
  loadOriginPrivateKey,
  saveOriginPrivateKey,
  clearOriginPrivateKey,
  originKeyScope,
} from './origin-key.js';
export { isBadNonceError, withNonceRetry } from './nonce.js';
export {
  loadStoredCredentials,
  saveStoredCredential,
  findStoredCredentials,
  findStoredCredentialsByRpId,
  findStoredCredentialById,
  findStoredCredentialByIdRelaxed,
  findStoredCredentialByIdGlobal,
  normalizeRpId,
  rpIdsEquivalent,
  describeCredentialLookupFailure,
  type StoredCredential,
} from './credentials.js';
export type {
  PasskeyConfig,
  PasskeyCredential,
  PasskeySession,
  PasskeyAction,
  WebAuthnAssertion,
  SponsorResponse,
  SponsorRequestOptions,
  TransferAction,
  AddKeyAction,
  RemoveKeyAction,
  ContractCallAction,
  InvokeAction,
  ContractCallArgs,
  FeeConfig,
  FeeMode,
} from './types.js';
export {
  ACTION_TRANSFER,
  ACTION_ADD_KEY,
  ACTION_REMOVE_KEY,
  ACTION_TRANSFER_WITH_FEE,
  ACTION_CONTRACT_CALL,
  ACTION_INVOKE,
} from './types.js';
export {
  resolveDeployerAddress,
} from './types.js';
export {
  DEFAULT_SMART_ACCOUNT_NAME,
  deriveOriginPrivateKey,
  smartAccountContractId,
  originKeyScopeForAddress,
} from './derive-origin.js';
export { broadcastContractDeploy, isContractDeployed } from './deploy.js';
