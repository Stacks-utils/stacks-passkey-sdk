if (typeof globalThis.self === 'undefined') {
  Object.defineProperty(globalThis, 'self', { value: globalThis, writable: true });
}
