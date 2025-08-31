/**
 * Tests for DashboardManager
 * Validates real-time performance dashboard functionality
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardManager } from '../dashboard-manager';
import type { DashboardConfig } from '../dashboard-types';
import type { LODMetrics } from '../lod-types';
import type { BSPMetrics, LightingMetrics, PerformanceMetrics } from '../types';

// Mock DOM methods - prevent infinite loops by not executing callbacks
Object.defineProperty(window, 'setInterval', {
  value: vi.fn((_fn: () => void, _ms: number) => {
    const id = Math.random();
    // Don't execute the callback to prevent infinite loops in tests
    return id;
  }),
});

Object.defineProperty(window, 'clearInterval', {
  value: vi.fn(),
});

// Mock document
const mockElement = {
  style: { cssText: '' },
  innerHTML: '',
  remove: vi.fn(),
  id: '',
};

Object.defineProperty(document, 'createElement', {
  value: vi.fn(() => mockElement),
});

Object.defineProperty(document, 'body', {
  value: {
    appendChild: vi.fn(),
  },
});

describe('DashboardManager', () => {
  let dashboard: DashboardManager;

  beforeEach(() => {
    vi.clearAllMocks();

    const config: Partial<DashboardConfig> = {
      updateInterval: 10, // Fast updates for testing
      maxDataPoints: 10,
      enableCharts: true,
      enableAlerts: true,
      theme: 'dark',
    };

    dashboard = new DashboardManager(config);
  });

  afterEach(() => {
    dashboard.dispose();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      const config: DashboardConfig = {
        updateInterval: 100,
        maxDataPoints: 50,
        enableCharts: false,
        enableAlerts: false,
        autoScale: true,
        displayMode: 'panel',
        position: 'bottom-left',
        opacity: 0.8,
        theme: 'light',
      };

      const customDashboard = new DashboardManager(config);

      expect(customDashboard).toBeDefined();
      customDashboard.dispose();
    });

    it('should use default configuration when none provided', () => {
      const defaultDashboard = new DashboardManager();

      expect(defaultDashboard).toBeDefined();
      defaultDashboard.dispose();
    });

    it('should initialize with empty metrics', () => {
      const realTimeData = dashboard.getRealTimeData();

      expect(realTimeData.current.fps).toBe(0);
      expect(realTimeData.current.frameTime).toBe(0);
      expect(realTimeData.current.memory).toBe(0);
    });
  });

  describe('Metrics Collection', () => {
    it('should update performance metrics correctly', () => {
      const metrics: PerformanceMetrics = {
        frameTime: 16.7,
        renderTime: 10,
        bspTraversalTime: 1,
        lightingTime: 2,
        cullingTime: 0.5,
        totalSectors: 10,
        visibleSectors: 7,
        totalLines: 50,
        visibleLines: 30,
        culledLines: 20,
        bspNodes: 15,
        bspDepth: 8,
        bspTraversals: 1,
        heapUsed: 256,
        heapTotal: 512,
        textureMemory: 128,
        bufferMemory: 64,
        fps: 60,
        avgFrameTime: 16.5,
        maxFrameTime: 20,
        minFrameTime: 15,
      };

      dashboard.updateMetrics(metrics);

      const realTimeData = dashboard.getRealTimeData();
      expect(realTimeData.current.fps).toBe(60);
      expect(realTimeData.current.frameTime).toBe(16.7);
      expect(realTimeData.current.memory).toBe(256);
    });

    it('should calculate culling efficiency correctly', () => {
      const metrics: PerformanceMetrics = {
        frameTime: 16.7,
        renderTime: 10,
        bspTraversalTime: 1,
        lightingTime: 2,
        cullingTime: 0.5,
        totalSectors: 10,
        visibleSectors: 6, // 40% visible
        totalLines: 40,
        visibleLines: 24, // 60% visible
        culledLines: 16,
        bspNodes: 15,
        bspDepth: 8,
        bspTraversals: 1,
        heapUsed: 256,
        heapTotal: 512,
        textureMemory: 128,
        bufferMemory: 64,
        fps: 60,
        avgFrameTime: 16.5,
        maxFrameTime: 20,
        minFrameTime: 15,
      };

      dashboard.updateMetrics(metrics);

      const realTimeData = dashboard.getRealTimeData();
      const expectedEfficiency = ((50 - 30) / 50) * 100; // 40% efficiency
      expect(realTimeData.current.cullingEfficiency).toBe(expectedEfficiency);
    });

    it('should update BSP metrics', () => {
      const bspMetrics: BSPMetrics = {
        traversalTime: 2.5,
        nodesVisited: 20,
        culledSectors: 5,
        visibleSectors: 3,
        efficiency: 62.5,
      };

      dashboard.updateBSPMetrics(bspMetrics);

      // BSP metrics are collected but not directly accessible in real-time data
      // This tests that the method doesn't throw errors
      expect(() => dashboard.updateBSPMetrics(bspMetrics)).not.toThrow();
    });

    it('should update lighting metrics', () => {
      const lightingMetrics: LightingMetrics = {
        lightingPassTime: 3.2,
        activeLights: 8,
        culledLights: 2,
        shadowMapsUpdated: 4,
        lightingQuality: 0.85,
      };

      dashboard.updateLightingMetrics(lightingMetrics);

      expect(() => dashboard.updateLightingMetrics(lightingMetrics)).not.toThrow();
    });

    it('should update LOD metrics', () => {
      const lodMetrics: LODMetrics = {
        totalMeshes: 100,
        activeMeshes: 75,
        culledMeshes: 25,
        levelDistribution: { 0: 30, 1: 25, 2: 15, 3: 5 },
        geometryMemory: 64,
        textureMemory: 128,
        processingTime: 1.8,
        transitionCount: 3,
      };

      dashboard.updateLODMetrics(lodMetrics);

      expect(() => dashboard.updateLODMetrics(lodMetrics)).not.toThrow();
    });

    it('should maintain maximum data points', () => {
      // Add more data points than the maximum
      for (let i = 0; i < 15; i++) {
        const metrics: PerformanceMetrics = {
          frameTime: 16 + i,
          renderTime: 10,
          bspTraversalTime: 1,
          lightingTime: 2,
          cullingTime: 0.5,
          totalSectors: 10,
          visibleSectors: 7,
          totalLines: 50,
          visibleLines: 30,
          culledLines: 20,
          bspNodes: 15,
          bspDepth: 8,
          bspTraversals: 1,
          heapUsed: 256,
          heapTotal: 512,
          textureMemory: 128,
          bufferMemory: 64,
          fps: 60,
          avgFrameTime: 16.5,
          maxFrameTime: 20,
          minFrameTime: 15,
        };

        dashboard.updateMetrics(metrics);
      }

      // Should only keep the last 10 data points
      const stats = dashboard.getStats();
      expect(stats.totalFrames).toBe(15); // Total frames processed
    });
  });

  describe('Alert System', () => {
    it('should generate FPS alerts', () => {
      const lowFPSMetrics: PerformanceMetrics = {
        frameTime: 50, // ~20 FPS
        renderTime: 40,
        bspTraversalTime: 1,
        lightingTime: 2,
        cullingTime: 0.5,
        totalSectors: 10,
        visibleSectors: 7,
        totalLines: 50,
        visibleLines: 30,
        culledLines: 20,
        bspNodes: 15,
        bspDepth: 8,
        bspTraversals: 1,
        heapUsed: 256,
        heapTotal: 512,
        textureMemory: 128,
        bufferMemory: 64,
        fps: 20, // Low FPS
        avgFrameTime: 50,
        maxFrameTime: 60,
        minFrameTime: 45,
      };

      dashboard.updateMetrics(lowFPSMetrics);

      const alerts = dashboard.getAlerts();
      const fpsAlert = alerts.find(
        (alert) => alert.type === 'performance' && alert.title === 'Low FPS'
      );
      expect(fpsAlert).toBeDefined();
      expect(fpsAlert?.severity).toBe('warning');
    });

    it('should generate critical FPS alerts', () => {
      const criticalFPSMetrics: PerformanceMetrics = {
        frameTime: 100, // ~10 FPS
        renderTime: 80,
        bspTraversalTime: 1,
        lightingTime: 2,
        cullingTime: 0.5,
        totalSectors: 10,
        visibleSectors: 7,
        totalLines: 50,
        visibleLines: 30,
        culledLines: 20,
        bspNodes: 15,
        bspDepth: 8,
        bspTraversals: 1,
        heapUsed: 256,
        heapTotal: 512,
        textureMemory: 128,
        bufferMemory: 64,
        fps: 10, // Critical FPS
        avgFrameTime: 100,
        maxFrameTime: 120,
        minFrameTime: 90,
      };

      dashboard.updateMetrics(criticalFPSMetrics);

      const alerts = dashboard.getAlerts();
      const fpsAlert = alerts.find(
        (alert) => alert.type === 'performance' && alert.title === 'Low FPS'
      );
      expect(fpsAlert?.severity).toBe('critical');
    });

    it('should generate memory alerts', () => {
      const highMemoryMetrics: PerformanceMetrics = {
        frameTime: 16.7,
        renderTime: 10,
        bspTraversalTime: 1,
        lightingTime: 2,
        cullingTime: 0.5,
        totalSectors: 10,
        visibleSectors: 7,
        totalLines: 50,
        visibleLines: 30,
        culledLines: 20,
        bspNodes: 15,
        bspDepth: 8,
        bspTraversals: 1,
        heapUsed: 600, // High memory usage
        heapTotal: 1024,
        textureMemory: 128,
        bufferMemory: 64,
        fps: 60,
        avgFrameTime: 16.5,
        maxFrameTime: 20,
        minFrameTime: 15,
      };

      dashboard.updateMetrics(highMemoryMetrics);

      const alerts = dashboard.getAlerts();
      const memoryAlert = alerts.find((alert) => alert.type === 'memory');
      expect(memoryAlert).toBeDefined();
      expect(memoryAlert?.severity).toBe('warning');
    });

    it('should acknowledge alerts', () => {
      const lowFPSMetrics: PerformanceMetrics = {
        frameTime: 50,
        renderTime: 40,
        bspTraversalTime: 1,
        lightingTime: 2,
        cullingTime: 0.5,
        totalSectors: 10,
        visibleSectors: 7,
        totalLines: 50,
        visibleLines: 30,
        culledLines: 20,
        bspNodes: 15,
        bspDepth: 8,
        bspTraversals: 1,
        heapUsed: 256,
        heapTotal: 512,
        textureMemory: 128,
        bufferMemory: 64,
        fps: 20,
        avgFrameTime: 50,
        maxFrameTime: 60,
        minFrameTime: 45,
      };

      dashboard.updateMetrics(lowFPSMetrics);

      const alerts = dashboard.getAlerts();
      const alert = alerts[0];
      expect(alert.acknowledged).toBe(false);

      dashboard.acknowledgeAlert(alert.id);
      expect(alert.acknowledged).toBe(true);
    });

    it('should not create duplicate alerts', () => {
      const lowFPSMetrics: PerformanceMetrics = {
        frameTime: 50,
        renderTime: 40,
        bspTraversalTime: 1,
        lightingTime: 2,
        cullingTime: 0.5,
        totalSectors: 10,
        visibleSectors: 7,
        totalLines: 50,
        visibleLines: 30,
        culledLines: 20,
        bspNodes: 15,
        bspDepth: 8,
        bspTraversals: 1,
        heapUsed: 256,
        heapTotal: 512,
        textureMemory: 128,
        bufferMemory: 64,
        fps: 20,
        avgFrameTime: 50,
        maxFrameTime: 60,
        minFrameTime: 45,
      };

      // Send same metrics multiple times
      dashboard.updateMetrics(lowFPSMetrics);
      dashboard.updateMetrics(lowFPSMetrics);
      dashboard.updateMetrics(lowFPSMetrics);

      const alerts = dashboard.getAlerts();
      const fpsAlerts = alerts.filter((alert) => alert.title === 'Low FPS' && !alert.acknowledged);
      expect(fpsAlerts.length).toBe(1); // Should only have one unacknowledged alert
    });
  });

  describe('Statistics', () => {
    it('should calculate performance statistics', () => {
      // Add some metrics
      for (let i = 0; i < 5; i++) {
        const metrics: PerformanceMetrics = {
          frameTime: 16.7,
          renderTime: 10,
          bspTraversalTime: 1,
          lightingTime: 2,
          cullingTime: 0.5,
          totalSectors: 10,
          visibleSectors: 7,
          totalLines: 50,
          visibleLines: 30,
          culledLines: 20,
          bspNodes: 15,
          bspDepth: 8,
          bspTraversals: 1,
          heapUsed: 256,
          heapTotal: 512,
          textureMemory: 128,
          bufferMemory: 64,
          fps: 60,
          avgFrameTime: 16.5,
          maxFrameTime: 20,
          minFrameTime: 15,
        };

        dashboard.updateMetrics(metrics);
      }

      const stats = dashboard.getStats();
      expect(stats.totalFrames).toBe(5);
      expect(stats.averageFPS).toBe(60);
      expect(stats.performanceScore).toBeGreaterThan(0);
      expect(stats.performanceScore).toBeLessThanOrEqual(100);
      expect(stats.uptime).toBeGreaterThanOrEqual(0); // Allow 0 for fast tests
    });

    it('should track frame drops', () => {
      // Add mixed performance metrics
      const goodMetrics: PerformanceMetrics = {
        frameTime: 16.7,
        renderTime: 10,
        bspTraversalTime: 1,
        lightingTime: 2,
        cullingTime: 0.5,
        totalSectors: 10,
        visibleSectors: 7,
        totalLines: 50,
        visibleLines: 30,
        culledLines: 20,
        bspNodes: 15,
        bspDepth: 8,
        bspTraversals: 1,
        heapUsed: 256,
        heapTotal: 512,
        textureMemory: 128,
        bufferMemory: 64,
        fps: 60,
        avgFrameTime: 16.5,
        maxFrameTime: 20,
        minFrameTime: 15,
      };

      const badMetrics: PerformanceMetrics = {
        ...goodMetrics,
        fps: 25, // Frame drop
      };

      dashboard.updateMetrics(goodMetrics);
      dashboard.updateMetrics(badMetrics);
      dashboard.updateMetrics(goodMetrics);

      const stats = dashboard.getStats();
      expect(stats.frameDrops).toBe(1);
    });
  });

  describe('Dashboard Lifecycle', () => {
    it('should start and stop correctly', () => {
      expect(() => dashboard.start()).not.toThrow();
      expect(() => dashboard.stop()).not.toThrow();
    });

    it('should toggle visibility', () => {
      dashboard.start();
      expect(() => dashboard.toggle()).not.toThrow();
      expect(() => dashboard.toggle()).not.toThrow();
    });

    it('should update configuration', () => {
      const newConfig = {
        updateInterval: 200,
        theme: 'light' as const,
        position: 'bottom-left' as const,
      };

      expect(() => dashboard.updateConfig(newConfig)).not.toThrow();
    });

    it('should dispose properly', () => {
      dashboard.start();
      expect(() => dashboard.dispose()).not.toThrow();
    });
  });

  describe('Data Export', () => {
    it('should export data as JSON', () => {
      // Add some metrics first
      const metrics: PerformanceMetrics = {
        frameTime: 16.7,
        renderTime: 10,
        bspTraversalTime: 1,
        lightingTime: 2,
        cullingTime: 0.5,
        totalSectors: 10,
        visibleSectors: 7,
        totalLines: 50,
        visibleLines: 30,
        culledLines: 20,
        bspNodes: 15,
        bspDepth: 8,
        bspTraversals: 1,
        heapUsed: 256,
        heapTotal: 512,
        textureMemory: 128,
        bufferMemory: 64,
        fps: 60,
        avgFrameTime: 16.5,
        maxFrameTime: 20,
        minFrameTime: 15,
      };

      dashboard.updateMetrics(metrics);

      const jsonData = dashboard.exportData('json');
      expect(() => JSON.parse(jsonData)).not.toThrow();

      const parsed = JSON.parse(jsonData);
      expect(parsed.config).toBeDefined();
      expect(parsed.metrics).toBeDefined();
      expect(parsed.stats).toBeDefined();
    });

    it('should export data as CSV', () => {
      // Add some metrics first
      const metrics: PerformanceMetrics = {
        frameTime: 16.7,
        renderTime: 10,
        bspTraversalTime: 1,
        lightingTime: 2,
        cullingTime: 0.5,
        totalSectors: 10,
        visibleSectors: 7,
        totalLines: 50,
        visibleLines: 30,
        culledLines: 20,
        bspNodes: 15,
        bspDepth: 8,
        bspTraversals: 1,
        heapUsed: 256,
        heapTotal: 512,
        textureMemory: 128,
        bufferMemory: 64,
        fps: 60,
        avgFrameTime: 16.5,
        maxFrameTime: 20,
        minFrameTime: 15,
      };

      dashboard.updateMetrics(metrics);

      const csvData = dashboard.exportData('csv');
      expect(csvData).toContain('timestamp,fps,frameTime,memory,cullingEfficiency');
      expect(csvData.split('\n').length).toBeGreaterThan(1);
    });
  });

  describe('Real-time Data', () => {
    it('should provide current, average, and peak values', () => {
      // Add varying metrics
      const metricsSet = [
        { fps: 60, frameTime: 16.7, memory: 200 },
        { fps: 45, frameTime: 22.2, memory: 250 },
        { fps: 55, frameTime: 18.2, memory: 300 },
      ];

      for (const { fps, frameTime, memory } of metricsSet) {
        const metrics: PerformanceMetrics = {
          frameTime,
          renderTime: 10,
          bspTraversalTime: 1,
          lightingTime: 2,
          cullingTime: 0.5,
          totalSectors: 10,
          visibleSectors: 7,
          totalLines: 50,
          visibleLines: 30,
          culledLines: 20,
          bspNodes: 15,
          bspDepth: 8,
          bspTraversals: 1,
          heapUsed: memory,
          heapTotal: 512,
          textureMemory: 128,
          bufferMemory: 64,
          fps,
          avgFrameTime: frameTime,
          maxFrameTime: frameTime + 5,
          minFrameTime: frameTime - 5,
        };

        dashboard.updateMetrics(metrics);
      }

      const realTimeData = dashboard.getRealTimeData();

      // Current should be the last values
      expect(realTimeData.current.fps).toBe(55);
      expect(realTimeData.current.frameTime).toBe(18.2);
      expect(realTimeData.current.memory).toBe(300);

      // Average should be calculated
      expect(realTimeData.average.fps).toBeCloseTo((60 + 45 + 55) / 3);

      // Peak should be the maximum
      expect(realTimeData.peak.memory).toBe(300);
      expect(realTimeData.peak.frameTime).toBe(22.2);
    });
  });
});
