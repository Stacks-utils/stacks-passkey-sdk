export function isBadNonceError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null
        ? JSON.stringify(error)
        : String(error);
  return /BadNonce/i.test(message);
}

export async function withNonceRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isBadNonceError(error) || attempt === maxAttempts - 1) {
        throw error;
      }
    }
  }
  throw lastError;
}
