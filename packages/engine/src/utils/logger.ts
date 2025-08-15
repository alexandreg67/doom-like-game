export const logger = {
  info: (message?: any, ...optionalParams: any[]) => {
    // simple wrapper - can be replaced by structured logger later
    // eslint-disable-next-line no-console
    console.info(message, ...optionalParams);
  },
  warn: (message?: any, ...optionalParams: any[]) => {
    // eslint-disable-next-line no-console
    console.warn(message, ...optionalParams);
  },
  error: (message?: any, ...optionalParams: any[]) => {
    // eslint-disable-next-line no-console
    console.error(message, ...optionalParams);
  },
};

export default logger;
