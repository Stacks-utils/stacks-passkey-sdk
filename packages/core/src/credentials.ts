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

/** Loopback hostnames share one WebAuthn identity in local dev. */
export function normalizeRpId(hostname: string): string {
  const host = hostname.trim().toLowerCase();
  if (host === '127.0.0.1' || host === '[::1]' || host === '0.0.0.0') {
    return 'localhost';
  }
  return hostname;
}

export function rpIdsEquivalent(a: string, b: string): boolean {
  return normalizeRpId(a) === normalizeRpId(b);
}

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
  next.push({
    ...credential,
    rpId: normalizeRpId(credential.rpId),
  });
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(next));
}

export function findStoredCredentials(filter: {
  deployerAddress: string;
  rpId: string;
}): StoredCredential[] {
  return loadStoredCredentials().filter(
    (item) =>
      item.deployerAddress === filter.deployerAddress && rpIdsEquivalent(item.rpId, filter.rpId)
  );
}

/** Same app host — deployer may have changed in config between sessions. */
export function findStoredCredentialsByRpId(rpId: string): StoredCredential[] {
  return loadStoredCredentials().filter((item) => rpIdsEquivalent(item.rpId, rpId));
}

export function findStoredCredentialById(
  credentialId: string,
  filter: { deployerAddress: string; rpId: string }
): StoredCredential | null {
  return findStoredCredentials(filter).find((item) => item.credentialId === credentialId) ?? null;
}

export function findStoredCredentialByIdRelaxed(
  credentialId: string,
  rpId: string
): StoredCredential | null {
  return findStoredCredentialsByRpId(rpId).find((item) => item.credentialId === credentialId) ?? null;
}

export function findStoredCredentialByIdGlobal(credentialId: string): StoredCredential | null {
  return loadStoredCredentials().find((item) => item.credentialId === credentialId) ?? null;
}

export function describeCredentialLookupFailure(filter: {
  deployerAddress: string;
  rpId: string;
}): string {
  const all = loadStoredCredentials();
  if (all.length === 0) {
    return ' No passkey index in browser storage — use the same browser you signed up with.';
  }

  const rpMatches = findStoredCredentialsByRpId(filter.rpId);
  if (rpMatches.length === 0) {
    const seen = [...new Set(all.map((item) => normalizeRpId(item.rpId)))];
    return ` Passkeys are stored for ${seen.join(', ')} but this page uses ${normalizeRpId(filter.rpId)}. Open the same URL as sign-up (e.g. always http://localhost:3000, not 127.0.0.1).`;
  }

  const deployerMatches = rpMatches.filter((item) => item.deployerAddress === filter.deployerAddress);
  if (deployerMatches.length === 0) {
    return ` Passkeys exist for this host but under deployer ${rpMatches[0]?.deployerAddress ?? 'unknown'} (current: ${filter.deployerAddress}). Check VITE_DEPLOYER_ADDRESS matches sign-up.`;
  }

  return '';
}
