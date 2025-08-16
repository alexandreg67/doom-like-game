/**
 * Tests for PerformanceManager
 * Validates metrics collection, timing, and alert system
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PerformanceManager } from '../performance-manager';
import type { BSPMetrics, LightingMetrics, PerformanceConfig } from '../types';

// Mock performance.now for consistent testing
const mockPerformanceNow = vi.fn();
vi.stubGlobal('performance', {
  now: mockPerformanceNow,
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByName: vi.fn().mockReturnValue([{ duration: 10 }]),
  memory: {
    usedJSHeapSize: 50 * 1024 * 1024, // 50MB
    totalJSHeapSize: 100 * 1024 * 1024, // 100MB
  },
});

describe('PerformanceManager', () => {
  let performanceManager: PerformanceManager;
  let currentTime = 0;

  beforeEach(() => {
    currentTime = 0;
    mockPerformanceNow.mockImplementation(() => currentTime);

    // Reset performance object properly
    vi.stubGlobal('performance', {
      now: mockPerformanceNow,
      mark: vi.fn(),
      measure: vi.fn(),
      getEntriesByName: vi.fn().mockReturnValue([{ duration: 10 }]),
      memory: {
        usedJSHeapSize: 50 * 1024 * 1024, // 50MB
        totalJSHeapSize: 100 * 1024 * 1024, // 100MB
      },
    });

    const config: Partial<PerformanceConfig> = {
      enableMetrics: true,
      sampleRate: 1,
      historySize: 10,
      alertThresholds: {
        frameTime: 16.7,
        memory: 100,
        cullingEfficiency: 40,
      },
    };

    performanceManager = new PerformanceManager(config);
  });

  afterEach(() => {
    performanceManager.dispose();
    vi.clearAllMocks();
  });

  describe('Timing Operations', () => {
    it('should start and end timers correctly', () => {
      currentTime = 0;
      performanceManager.start('test_operation');
      currentTime = 10;

      const duration = performanceManager.end('test_operation');
      expect(duration).toBe(10);
    });

    it('should handle missing start timer gracefully', () => {
      currentTime = 10;
      const duration = performanceManager.end('nonexistent_timer');
      expect(duration).toBe(0);
    });

    it('should create performance marks and measures', () => {
      performanceManager.mark('test_mark');
      expect(performance.mark).toHaveBeenCalledWith('test_mark');

      const duration = performanceManager.measure('start_mark', 'end_mark');
      expect(performance.measure).toHaveBeenCalled();
      expect(duration).toBe(10); // Mocked return value
    });
  });

  describe('Frame Measurement', () => {
    it('should measure frame time correctly', () => {
      currentTime = 0;
      performanceManager.startFrame();
      currentTime = 16;
      performanceManager.endFrame();

      const metrics = performanceManager.getMetrics();
      expect(metrics.frameTime).toBe(16);
      expect(metrics.fps).toBeCloseTo(62.5, 1); // 1000/16
    });

    it('should calculate rolling averages', () => {
      currentTime = 0;
      // Simulate multiple frames
      for (let i = 0; i < 5; i++) {
        performanceManager.startFrame();
        currentTime += 10; // 10ms per frame
        performanceManager.endFrame();
      }

      const metrics = performanceManager.getMetrics();
      expect(metrics.avgFrameTime).toBe(10);
      expect(metrics.maxFrameTime).toBe(10);
      expect(metrics.minFrameTime).toBe(10);
    });

    it('should track frame numbers', () => {
      performanceManager.startFrame();
      performanceManager.endFrame();

      performanceManager.startFrame();
      performanceManager.endFrame();

      // Frame number should be internal, but we can verify samples
      const samples = performanceManager.getSamples();
      expect(samples).toHaveLength(2);
      expect(samples[1].frameNumber).toBe(2);
    });
  });

  describe('BSP Metrics', () => {
    it('should update BSP metrics correctly', () => {
      const bspMetrics: BSPMetrics = {
        constructionTime: 5,
        traversalTime: 0.5,
        nodesVisited: 10,
        leavesReached: 3,
        cullingRatio: 60,
      };

      performanceManager.updateBSPMetrics(bspMetrics);

      const metrics = performanceManager.getMetrics();
      expect(metrics.bspTraversalTime).toBe(0.5);
      expect(metrics.bspNodes).toBe(10);
      expect(metrics.bspTraversals).toBe(1);
    });

    it('should calculate culling efficiency', () => {
      performanceManager.updateGeometryMetrics(10, 4, 100, 40);

      const bspMetrics: BSPMetrics = {
        constructionTime: 0,
        traversalTime: 1,
        nodesVisited: 5,
        leavesReached: 2,
        cullingRatio: 60,
      };

      performanceManager.updateBSPMetrics(bspMetrics);
      // Should log culling efficiency calculation
    });
  });

  describe('Lighting Metrics', () => {
    it('should update lighting metrics', () => {
      const lightingMetrics: LightingMetrics = {
        activeLights: 5,
        shadowCasters: 2,
        lightCulled: 3,
        lightingPassTime: 2.5,
        shadowMapUpdates: 1,
      };

      performanceManager.updateLightingMetrics(lightingMetrics);

      const metrics = performanceManager.getMetrics();
      expect(metrics.lightingTime).toBe(2.5);
    });
  });

  describe('Alert System', () => {
    it('should generate frame time alerts', () => {
      performanceManager.startFrame();
      currentTime = 50; // Way over 16.7ms threshold (should be critical: 50 > 16.7 * 2 = 33.4)
      performanceManager.endFrame();

      const alerts = performanceManager.getAlerts();
      const metrics = performanceManager.getMetrics();

      // Debug output for investigation
      console.log('Test Debug - frameTime:', metrics.frameTime);
      console.log('Test Debug - alerts:', alerts);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('frameTime');
      expect(alerts[0].severity).toBe('critical');
    });

    it('should generate memory alerts', () => {
      // Mock high memory usage
      vi.stubGlobal('performance', {
        ...performance,
        memory: {
          usedJSHeapSize: 150 * 1024 * 1024, // 150MB (over 100MB threshold)
          totalJSHeapSize: 200 * 1024 * 1024,
        },
      });

      performanceManager.startFrame();
      currentTime = 10;
      performanceManager.endFrame();

      const alerts = performanceManager.getAlerts();
      const memoryAlert = alerts.find((alert) => alert.type === 'memory');
      expect(memoryAlert).toBeDefined();
      expect(memoryAlert?.severity).toBe('critical');
    });

    it('should generate culling efficiency alerts', () => {
      // Set up poor culling efficiency (only 20% culled)
      performanceManager.updateGeometryMetrics(10, 8, 100, 80);

      performanceManager.startFrame();
      currentTime = 10;
      performanceManager.endFrame();

      const alerts = performanceManager.getAlerts();
      const cullingAlert = alerts.find((alert) => alert.type === 'culling');
      expect(cullingAlert).toBeDefined();
      expect(cullingAlert?.severity).toBe('warning');
    });
  });

  describe('Samples and History', () => {
    it('should collect performance samples', () => {
      performanceManager.startFrame();
      currentTime = 10;
      performanceManager.endFrame();

      const samples = performanceManager.getSamples();
      expect(samples).toHaveLength(1);
      expect(samples[0].metrics.frameTime).toBe(10);
      expect(samples[0].timestamp).toBeDefined();
    });

    it('should limit history size', () => {
      // Generate more samples than history size (10)
      for (let i = 0; i < 15; i++) {
        performanceManager.startFrame();
        currentTime += 10;
        performanceManager.endFrame();
      }

      const samples = performanceManager.getSamples();
      expect(samples).toHaveLength(10); // Should be limited to historySize
    });

    it('should limit alert history', () => {
      // Generate many alerts
      for (let i = 0; i < 110; i++) {
        performanceManager.startFrame();
        currentTime += 50; // Trigger frame time alerts
        performanceManager.endFrame();
      }

      const alerts = performanceManager.getAlerts();
      expect(alerts.length).toBeLessThanOrEqual(100); // Should be limited
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      const newConfig = {
        enableMetrics: false,
        alertThresholds: {
          frameTime: 20,
          memory: 200,
          cullingEfficiency: 30,
        },
      };

      performanceManager.updateConfig(newConfig);

      // Should not collect metrics when disabled
      performanceManager.startFrame();
      performanceManager.endFrame();

      const samples = performanceManager.getSamples();
      expect(samples).toHaveLength(0);
    });

    it('should handle sample rate correctly', () => {
      performanceManager.updateConfig({ sampleRate: 2 });

      // First frame - should not sample
      performanceManager.startFrame();
      currentTime = 10;
      performanceManager.endFrame();

      // Second frame - should sample
      performanceManager.startFrame();
      currentTime = 20;
      performanceManager.endFrame();

      const samples = performanceManager.getSamples();
      expect(samples).toHaveLength(1); // Only second frame sampled
    });
  });

  describe('Summary and Utilities', () => {
    it('should generate performance summary', () => {
      performanceManager.updateGeometryMetrics(10, 4, 100, 40);
      performanceManager.startFrame();
      currentTime = 16;
      performanceManager.endFrame();

      const summary = performanceManager.getSummary();
      expect(summary).toContain('FPS:');
      expect(summary).toContain('Frame:');
      expect(summary).toContain('Memory:');
      expect(summary).toContain('Culling:');
    });

    it('should reset correctly', () => {
      performanceManager.startFrame();
      performanceManager.endFrame();

      performanceManager.reset();

      const samples = performanceManager.getSamples();
      const alerts = performanceManager.getAlerts();
      const metrics = performanceManager.getMetrics();

      expect(samples).toHaveLength(0);
      expect(alerts).toHaveLength(0);
      expect(metrics.frameTime).toBe(0);
    });
  });

  describe('Geometry Metrics', () => {
    it('should update geometry metrics correctly', () => {
      performanceManager.updateGeometryMetrics(10, 6, 100, 60);

      const metrics = performanceManager.getMetrics();
      expect(metrics.totalSectors).toBe(10);
      expect(metrics.visibleSectors).toBe(6);
      expect(metrics.totalLines).toBe(100);
      expect(metrics.visibleLines).toBe(60);
    });
  });

  describe('Error Handling', () => {
    it('should handle performance.measure errors gracefully', () => {
      vi.mocked(performance.measure).mockImplementation(() => {
        throw new Error('Measure failed');
      });

      const duration = performanceManager.measure('start', 'end');
      expect(duration).toBe(0);
    });

    it('should handle missing performance.memory gracefully', () => {
      vi.stubGlobal('performance', {
        ...performance,
        memory: undefined,
      });

      performanceManager.startFrame();
      performanceManager.endFrame();

      const metrics = performanceManager.getMetrics();
      expect(metrics.heapUsed).toBe(0);
      expect(metrics.heapTotal).toBe(0);
    });
  });
});
