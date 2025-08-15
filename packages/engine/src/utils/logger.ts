export const logger = {
  info: (message?: string, ...optionalParams: unknown[]) => {
    // simple wrapper - can be replaced by structured logger later
    // eslint-disable-next-line no-console
    console.info(message, ...optionalParams);
  },
  warn: (message?: string, ...optionalParams: unknown[]) => {
    // eslint-disable-next-line no-console
    console.warn(message, ...optionalParams);
  },
  error: (message?: string, ...optionalParams: unknown[]) => {
    // eslint-disable-next-line no-console
    console.error(message, ...optionalParams);
  },
  debug: (message?: string, ...optionalParams: unknown[]) => {
    // eslint-disable-next-line no-console
    console.debug(message, ...optionalParams);
  },
};

// Also export as Logger for consistency
export const Logger = logger;

export default logger;
