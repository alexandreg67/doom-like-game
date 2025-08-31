// Minimal logger with environment-based debug gating
const isDebug = (() => {
  try {
    const metaEnv = (import.meta as unknown as { env?: { MODE?: string } }).env;
    if (metaEnv && typeof metaEnv.MODE === 'string') return metaEnv.MODE !== 'production';
  } catch {}
  const flag = (globalThis as unknown as { __WEAPONS_DEBUG?: boolean }).__WEAPONS_DEBUG;
  return flag === true;
})();

export const logger = {
  debug: (...args: unknown[]): void => {
    if (isDebug) console.log(...args);
  },
  info: (...args: unknown[]): void => {
    if (isDebug) console.info(...args);
  },
  warn: (...args: unknown[]): void => {
    console.warn(...args);
  },
  error: (...args: unknown[]): void => {
    console.error(...args);
  },
};
