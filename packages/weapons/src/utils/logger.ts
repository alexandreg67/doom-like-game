// Minimal logger with environment-based debug gating
const isDebug = (() => {
  try {
    const meta = (import.meta as unknown as { env?: { MODE?: string } })?.env;
    if (meta && typeof meta.MODE === 'string') return meta.MODE !== 'production';
  } catch {}
  const flag = (globalThis as unknown as { __WEAPONS_DEBUG?: boolean }).__WEAPONS_DEBUG;
  return flag === true;
})();

export const logger = {
  debug: (...args: unknown[]): void => {
    if (isDebug) console.log(...(args as []));
  },
  info: (...args: unknown[]): void => {
    if (isDebug) console.info(...(args as []));
  },
  warn: (...args: unknown[]): void => {
    console.warn(...(args as []));
  },
  error: (...args: unknown[]): void => {
    console.error(...(args as []));
  },
};
