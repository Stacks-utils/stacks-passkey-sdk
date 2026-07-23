export interface StoredCredential {
  credentialId: string;
  publicKeyHex: string;
  contractAddress: string;
  contractName: string;
  contractId: string;
  deployerAddress: string;
  rpId: string;
}

const CREDENTIALS_KEY = 'stacks-passkey-credentials';

export function loadStoredCredentials(): StoredCredential[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(CREDENTIALS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as StoredCredential[];
  } catch {
    return [];
  }
}

export function saveStoredCredential(credential: StoredCredential): void {
  if (typeof localStorage === 'undefined') return;
  const existing = loadStoredCredentials();
  const next = existing.filter((item) => item.credentialId !== credential.credentialId);
  next.push(credential);
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(next));
}

export function findStoredCredentials(filter: {
  deployerAddress: string;
  rpId: string;
}): StoredCredential[] {
  return loadStoredCredentials().filter(
    (item) => item.deployerAddress === filter.deployerAddress && item.rpId === filter.rpId
  );
}

export function findStoredCredentialById(
  credentialId: string,
  filter: { deployerAddress: string; rpId: string }
): StoredCredential | null {
  return findStoredCredentials(filter).find((item) => item.credentialId === credentialId) ?? null;
}
