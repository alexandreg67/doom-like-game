import { vi } from 'vitest';

// JSDOM ne supporte pas performance.mark et performance.measure, nous les mockons ici
const performanceMock = {
  now: vi.fn(() => Date.now()),
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByName: vi.fn(() => []),
  clearMarks: vi.fn(),
  clearMeasures: vi.fn(),
};

Object.defineProperty(window, 'performance', {
  value: performanceMock,
  writable: true,
});
