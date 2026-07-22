import type { PasskeySession } from './types.js';

const SESSION_KEY = 'stacks-passkey-session';

export function saveSession(session: PasskeySession): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession(): PasskeySession | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PasskeySession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
}

export function hasSession(): boolean {
  return loadSession() !== null;
}
