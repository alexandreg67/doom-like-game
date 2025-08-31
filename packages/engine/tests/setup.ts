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

// Mock HTMLCanvasElement et son getContext pour éviter les erreurs Canvas dans jsdom
class MockCanvasRenderingContext2D {
  canvas = { width: 256, height: 256, toDataURL: vi.fn(() => 'data:image/png;base64,mock') };
  fillStyle = '#000000';
  strokeStyle = '#000000';
  lineWidth = 1;

  fillRect = vi.fn();
  strokeRect = vi.fn();
  beginPath = vi.fn();
  closePath = vi.fn();
  moveTo = vi.fn();
  lineTo = vi.fn();
  arc = vi.fn();
  fill = vi.fn();
  stroke = vi.fn();
  clearRect = vi.fn();
  setTransform = vi.fn();
  restore = vi.fn();
  save = vi.fn();
  createLinearGradient = vi.fn(() => ({
    addColorStop: vi.fn(),
  }));
  createRadialGradient = vi.fn(() => ({
    addColorStop: vi.fn(),
  }));
}

// Mock HTMLCanvasElement.prototype.getContext
HTMLCanvasElement.prototype.getContext = vi.fn((contextType) => {
  if (contextType === '2d') {
    return new MockCanvasRenderingContext2D();
  }
  return null;
});

// Mock HTMLCanvasElement.prototype.toDataURL
HTMLCanvasElement.prototype.toDataURL = vi.fn(
  () =>
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
);
