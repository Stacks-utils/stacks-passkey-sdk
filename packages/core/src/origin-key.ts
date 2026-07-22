const ORIGIN_KEY_PREFIX = 'stacks-passkey-origin:';

export function originKeyScope(contractAddress: string, contractName: string, network: string): string {
  return `${contractAddress}.${contractName}:${network}`;
}

export function loadOriginPrivateKey(scope: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(`${ORIGIN_KEY_PREFIX}${scope}`);
}

export function saveOriginPrivateKey(scope: string, privateKey: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(`${ORIGIN_KEY_PREFIX}${scope}`, privateKey);
}

export function clearOriginPrivateKey(scope: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(`${ORIGIN_KEY_PREFIX}${scope}`);
}
