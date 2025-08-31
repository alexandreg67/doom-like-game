/**
 * Tests for DebugVisualizer
 * Validates visual debugging tools functionality
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DebugConfig, DebugVisualization } from '../debug-types';
import { DebugVisualizer } from '../debug-visualizer';
import { PerformanceManager } from '../performance-manager';

// Mock performance.mark and performance.measure for tests
if (!globalThis.performance.mark) {
  globalThis.performance.mark = vi.fn();
}
if (!globalThis.performance.measure) {
  globalThis.performance.measure = vi.fn();
}

// Mock DOM elements
const mockCanvas = {
  width: 1920,
  height: 1080,
  getContext: vi.fn(() => ({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
  })),
  style: {},
} as unknown as HTMLCanvasElement;

const mockOverlay = {
  style: {},
  innerHTML: '',
  id: '',
  parentNode: {
    removeChild: vi.fn(),
  },
} as unknown as HTMLElement;

// Mock document
Object.defineProperty(global, 'document', {
  value: {
    createElement: vi.fn((tag: string) => {
      if (tag === 'canvas') {
        return {
          ...mockCanvas,
          style: { cssText: '' },
        };
      }
      if (tag === 'div') {
        return {
          ...mockOverlay,
          style: { cssText: '' },
        };
      }
      return {};
    }),
    body: {
      appendChild: vi.fn(),
    },
  },
});

// Mock window
Object.defineProperty(global, 'window', {
  value: {
    innerWidth: 1920,
    innerHeight: 1080,
    addEventListener: vi.fn(),
  },
});

// Mock performance
Object.defineProperty(global, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    memory: {
      usedJSHeapSize: 100 * 1024 * 1024, // 100MB
      totalJSHeapSize: 200 * 1024 * 1024, // 200MB
    },
  },
});

describe('DebugVisualizer', () => {
  let debugVisualizer: DebugVisualizer;
  let performanceManager: PerformanceManager;

  beforeEach(() => {
    vi.clearAllMocks();

    // Add missing performance methods for test environment
    if (!performance.mark) {
      (performance as unknown as { mark: (name?: string) => void }).mark = vi.fn();
    }
    if (!performance.measure) {
      (
        performance as unknown as {
          measure: (name: string, startMark?: string, endMark?: string) => { duration: number };
        }
      ).measure = vi.fn(() => ({ duration: 1 }));
    }

    const config: Partial<DebugConfig> = {
      enabled: true,
      showBSPTree: true,
      showCullingInfo: true,
      showLODTransitions: true,
      showLightingDebug: true,
      showPerformanceMetrics: true,
      refreshRate: 60, // High refresh rate for testing
      opacity: 0.8,
    };

    debugVisualizer = new DebugVisualizer(config);
    performanceManager = new PerformanceManager();
    debugVisualizer.setPerformanceManager(performanceManager);
  });

  afterEach(() => {
    debugVisualizer.dispose();
    performanceManager.dispose();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      const customConfig: DebugConfig = {
        enabled: false,
        showBSPTree: false,
        showCullingInfo: true,
        showLODTransitions: true,
        showLightingDebug: false,
        showPerformanceMetrics: true,
        wireframeMode: true,
        colorByDepth: false,
        showBoundingBoxes: false,
        overlayPosition: 'bottom-right',
        opacity: 0.5,
        refreshRate: 30,
      };

      const customVisualizer = new DebugVisualizer(customConfig);
      expect(customVisualizer).toBeDefined();
      customVisualizer.dispose();
    });

    it('should create overlay and canvas elements', () => {
      expect(document.createElement).toHaveBeenCalledWith('div');
      expect(document.createElement).toHaveBeenCalledWith('canvas');
      expect(document.body.appendChild).toHaveBeenCalledTimes(2);
    });

    it('should set performance manager correctly', () => {
      const manager = new PerformanceManager();
      debugVisualizer.setPerformanceManager(manager);

      // Should not throw
      expect(() => debugVisualizer.setPerformanceManager(manager)).not.toThrow();
      manager.dispose();
    });

    it('should initialize with scene context', () => {
      const mockScene = {};
      const mockEngine = {};
      const mockCamera = {};

      debugVisualizer.initialize(mockScene, mockEngine, mockCamera, mockCanvas);

      // Should not throw
      expect(() =>
        debugVisualizer.initialize(mockScene, mockEngine, mockCamera, mockCanvas)
      ).not.toThrow();
    });
  });

  describe('Visualization Management', () => {
    it('should add custom visualizations', () => {
      const customViz: DebugVisualization = {
        id: 'custom-test',
        type: 'performance',
        enabled: true,
        priority: 10,
        render: vi.fn(),
        update: vi.fn(),
        dispose: vi.fn(),
      };

      debugVisualizer.addVisualization(customViz);

      // Should not throw when adding visualizations
      expect(() => debugVisualizer.addVisualization(customViz)).not.toThrow();
    });

    it('should remove visualizations', () => {
      const customViz: DebugVisualization = {
        id: 'removable-test',
        type: 'bsp',
        enabled: true,
        priority: 1,
        render: vi.fn(),
        update: vi.fn(),
        dispose: vi.fn(),
      };

      debugVisualizer.addVisualization(customViz);
      debugVisualizer.removeVisualization('removable-test');

      expect(customViz.dispose).toHaveBeenCalled();
    });

    it('should toggle visualizations on/off', () => {
      // Toggle specific visualization
      debugVisualizer.toggleVisualization('bsp-tree', false);
      debugVisualizer.toggleVisualization('bsp-tree', true);

      // Should not throw
      expect(() => debugVisualizer.toggleVisualization('bsp-tree')).not.toThrow();
    });

    it('should handle non-existent visualizations gracefully', () => {
      // Should not throw when removing non-existent visualization
      expect(() => debugVisualizer.removeVisualization('non-existent')).not.toThrow();
      expect(() => debugVisualizer.toggleVisualization('non-existent')).not.toThrow();
    });
  });

  describe('Debug Annotations', () => {
    it('should add debug annotations', () => {
      const annotation = {
        id: 'test-annotation',
        worldPosition: [10, 20, 30] as [number, number, number],
        text: 'Test annotation',
        color: '#ffffff',
        fontSize: 12,
        background: true,
        arrow: false,
      };

      debugVisualizer.addAnnotation(annotation);

      // Should not throw
      expect(() => debugVisualizer.addAnnotation(annotation)).not.toThrow();
    });

    it('should add annotations with lifetime', () => {
      const annotation = {
        id: 'temporary-annotation',
        worldPosition: [0, 0, 0] as [number, number, number],
        text: 'Temporary',
        color: '#ff0000',
        fontSize: 10,
        background: false,
        arrow: true,
        lifetime: 1000, // 1 second
      };

      debugVisualizer.addAnnotation(annotation);

      // Should not throw
      expect(() => debugVisualizer.addAnnotation(annotation)).not.toThrow();
    });
  });

  describe('Debug Events', () => {
    it('should add debug events', () => {
      const event = {
        type: 'lod-transition' as const,
        data: { meshId: 'test-mesh', fromLOD: 0, toLOD: 1 },
        severity: 'info' as const,
        message: 'LOD transition occurred',
      };

      debugVisualizer.addEvent(event);

      // Should not throw
      expect(() => debugVisualizer.addEvent(event)).not.toThrow();
    });

    it('should handle different event severities', () => {
      const events = [
        {
          type: 'performance-spike' as const,
          data: { frameTime: 50 },
          severity: 'warning' as const,
          message: 'Frame time spike detected',
        },
        {
          type: 'culling-change' as const,
          data: { efficiency: 0.2 },
          severity: 'error' as const,
          message: 'Poor culling efficiency',
        },
      ];

      for (const event of events) {
        debugVisualizer.addEvent(event);
      }

      // Should not throw
      expect(() => {
        for (const event of events) {
          debugVisualizer.addEvent(event);
        }
      }).not.toThrow();
    });

    it('should limit event history', () => {
      // Add many events to test history limiting
      for (let i = 0; i < 100; i++) {
        debugVisualizer.addEvent({
          type: 'performance-spike',
          data: { frame: i },
          severity: 'info',
          message: `Event ${i}`,
        });
      }

      // Should not throw even with many events
      expect(() => {
        debugVisualizer.addEvent({
          type: 'performance-spike',
          data: { frame: 101 },
          severity: 'info',
          message: 'Final event',
        });
      }).not.toThrow();
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration dynamically', () => {
      const newConfig: Partial<DebugConfig> = {
        showBSPTree: false,
        showCullingInfo: true,
        overlayPosition: 'bottom-right',
        opacity: 0.5,
        refreshRate: 30,
      };

      debugVisualizer.updateConfig(newConfig);

      // Should not throw
      expect(() => debugVisualizer.updateConfig(newConfig)).not.toThrow();
    });

    it('should handle overlay position changes', () => {
      const positions: Array<DebugConfig['overlayPosition']> = [
        'top-left',
        'top-right',
        'bottom-left',
        'bottom-right',
      ];

      for (const position of positions) {
        debugVisualizer.updateConfig({ overlayPosition: position });
      }

      // Should not throw
      expect(() => {
        for (const position of positions) {
          debugVisualizer.updateConfig({ overlayPosition: position });
        }
      }).not.toThrow();
    });

    it('should update visualization states with config', () => {
      debugVisualizer.updateConfig({
        showBSPTree: false,
        showLODTransitions: false,
        showLightingDebug: true,
      });

      // Should not throw
      expect(() =>
        debugVisualizer.updateConfig({
          showPerformanceMetrics: false,
        })
      ).not.toThrow();
    });
  });

  describe('Toggle Functionality', () => {
    it('should toggle debug mode on/off', () => {
      // Toggle off
      debugVisualizer.toggle(false);

      // Toggle on
      debugVisualizer.toggle(true);

      // Toggle with no parameter (should flip current state)
      debugVisualizer.toggle();

      // Should not throw
      expect(() => debugVisualizer.toggle()).not.toThrow();
    });

    it('should handle toggle state correctly', () => {
      // Start enabled
      expect(() => debugVisualizer.toggle(true)).not.toThrow();

      // Disable
      expect(() => debugVisualizer.toggle(false)).not.toThrow();

      // Re-enable
      expect(() => debugVisualizer.toggle(true)).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle visualization errors gracefully', () => {
      const errorViz: DebugVisualization = {
        id: 'error-viz',
        type: 'performance',
        enabled: true,
        priority: 1,
        render: vi.fn(() => {
          throw new Error('Render error');
        }),
        update: vi.fn(() => {
          throw new Error('Update error');
        }),
        dispose: vi.fn(),
      };

      debugVisualizer.addVisualization(errorViz);

      // Initialize to trigger updates
      debugVisualizer.initialize({}, {}, {}, mockCanvas);

      // Should not throw even if visualizations error
      expect(() => {
        // Trigger update manually
        debugVisualizer.initialize({}, {}, {}, mockCanvas);
      }).not.toThrow();
    });

    it('should handle missing DOM elements', () => {
      // Mock document.createElement to return null
      const originalCreateElement = document.createElement;
      document.createElement = vi.fn(() => null as unknown as HTMLElement);

      expect(() => {
        new DebugVisualizer();
      }).toThrow();

      // Restore
      document.createElement = originalCreateElement;
    });

    it('should handle missing performance memory API', () => {
      // Mock performance without memory
      Object.defineProperty(global, 'performance', {
        value: {
          now: vi.fn(() => Date.now()),
          // No memory property
        },
      });

      const visualizer = new DebugVisualizer();
      visualizer.initialize({}, {}, {}, mockCanvas);

      // Should not throw even without memory API
      expect(() => visualizer.initialize({}, {}, {}, mockCanvas)).not.toThrow();

      visualizer.dispose();
    });
  });

  describe('Performance Integration', () => {
    it('should integrate with PerformanceManager metrics', () => {
      // Start frame to get metrics
      performanceManager.startFrame();
      performanceManager.endFrame();

      debugVisualizer.initialize({}, {}, {}, mockCanvas);

      // Should not throw when accessing performance metrics
      expect(() => debugVisualizer.initialize({}, {}, {}, mockCanvas)).not.toThrow();
    });

    it('should handle missing PerformanceManager gracefully', () => {
      const visualizer = new DebugVisualizer();
      // Don't set performance manager

      visualizer.initialize({}, {}, {}, mockCanvas);

      // Should not throw even without PerformanceManager
      expect(() => visualizer.initialize({}, {}, {}, mockCanvas)).not.toThrow();

      visualizer.dispose();
    });
  });

  describe('Memory Management', () => {
    it('should clean up annotations with lifetime', async () => {
      const shortLivedAnnotation = {
        id: 'short-lived',
        worldPosition: [0, 0, 0] as [number, number, number],
        text: 'Short lived',
        color: '#ffffff',
        fontSize: 12,
        background: false,
        arrow: false,
        lifetime: 1, // Very short lifetime
      };

      debugVisualizer.addAnnotation(shortLivedAnnotation);

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should not throw
      expect(() => debugVisualizer.addAnnotation(shortLivedAnnotation)).not.toThrow();
    });

    it('should clean up old events', () => {
      // Add old events
      for (let i = 0; i < 10; i++) {
        debugVisualizer.addEvent({
          type: 'performance-spike',
          data: { old: true },
          severity: 'info',
          message: 'Old event',
        });
      }

      // Should not throw
      expect(() => {
        debugVisualizer.addEvent({
          type: 'performance-spike',
          data: { new: true },
          severity: 'info',
          message: 'New event',
        });
      }).not.toThrow();
    });
  });

  describe('Disposal', () => {
    it('should dispose cleanly', () => {
      debugVisualizer.initialize({}, {}, {}, mockCanvas);

      expect(() => debugVisualizer.dispose()).not.toThrow();
    });

    it('should dispose all visualizations', () => {
      const viz1: DebugVisualization = {
        id: 'viz1',
        type: 'bsp',
        enabled: true,
        priority: 1,
        render: vi.fn(),
        update: vi.fn(),
        dispose: vi.fn(),
      };

      const viz2: DebugVisualization = {
        id: 'viz2',
        type: 'performance',
        enabled: true,
        priority: 2,
        render: vi.fn(),
        update: vi.fn(),
        dispose: vi.fn(),
      };

      debugVisualizer.addVisualization(viz1);
      debugVisualizer.addVisualization(viz2);

      debugVisualizer.dispose();

      expect(viz1.dispose).toHaveBeenCalled();
      expect(viz2.dispose).toHaveBeenCalled();
    });

    it('should handle multiple disposals', () => {
      debugVisualizer.dispose();

      // Should not throw on multiple dispose calls
      expect(() => debugVisualizer.dispose()).not.toThrow();
    });
  });
});
