import type { Engine, Scene, ShaderMaterial } from '@babylonjs/core';
import { Logger } from '../utils/logger';
import { type RenderMode, SectorRenderer } from './sector-renderer';
import { type ShaderConfig, ShaderManager, type ShaderType } from './shader-manager';
import { WebGLRenderer } from './webgl-renderer';
import { WebGPURenderer } from './webgpu-renderer';

/**
 * Renderer capabilities that can be queried
 */
export interface RendererCapabilities {
  maxTextureSize: number;
  maxBufferSize: number;
  supportsCompute: boolean;
  supportsRayTracing: boolean;
  maxBindGroups: number;
}

/**
 * Performance metrics for the renderer
 */
export interface RenderMetrics {
  frameTime: number;
  drawCalls: number;
  vertices: number;
  triangles: number;
  textureMemory: number;
  bufferMemory: number;
}

/**
 * Unified renderer interface for both WebGPU and WebGL2 backends
 * Provides a consistent API for DOOM-like rendering with automatic fallback
 */
export class UnifiedRenderer {
  private engine: Engine;
  private canvas: HTMLCanvasElement;
  private activeRenderer: WebGPURenderer | WebGLRenderer;
  private sectorRenderer: SectorRenderer;
  private shaderManager: ShaderManager;
  private preferWebGPU: boolean;
  private initialized = false;

  // Performance tracking
  private metrics: RenderMetrics = {
    frameTime: 0,
    drawCalls: 0,
    vertices: 0,
    triangles: 0,
    textureMemory: 0,
    bufferMemory: 0,
  };

  private frameStartTime = 0;
  private frameCounter = 0;
  private readonly LOG_INTERVAL = 1000; // Log every 1000 frames

  constructor(engine: Engine, scene: Scene, preferWebGPU = true) {
    this.engine = engine;
    this.preferWebGPU = preferWebGPU;

    const canvas = engine.getRenderingCanvas();
    if (!canvas) {
      throw new Error('Rendering canvas is not available from engine');
    }
    this.canvas = canvas;

    // Initialize sector renderer
    this.sectorRenderer = new SectorRenderer(scene);

    // Create appropriate backend renderer
    this.activeRenderer = this.createRenderer();

    // Initialize shader manager with detected backend
    const backend = this.activeRenderer instanceof WebGPURenderer ? 'webgpu' : 'webgl';
    this.shaderManager = new ShaderManager(engine, scene, backend);

    Logger.info('[UnifiedRenderer] Created with backend:', this.getRendererType());
  }

  /**
   * Initialize the renderer and its backend
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      Logger.warn('[UnifiedRenderer] Already initialized');
      return;
    }

    try {
      if (this.activeRenderer instanceof WebGPURenderer) {
        await this.activeRenderer.initialize(this.canvas);
      } else {
        await this.activeRenderer.initialize();
      }

      this.initialized = true;
      Logger.info('[UnifiedRenderer] Initialized successfully with', this.getRendererType());
    } catch (error) {
      // If WebGPU fails, fallback to WebGL
      if (this.activeRenderer instanceof WebGPURenderer) {
        Logger.warn(
          '[UnifiedRenderer] WebGPU initialization failed, falling back to WebGL2:',
          error
        );
        this.activeRenderer = new WebGLRenderer(this.engine);
        await this.activeRenderer.initialize();
        this.initialized = true;
        Logger.info('[UnifiedRenderer] Fallback to WebGL2 successful');
      } else {
        Logger.error('[UnifiedRenderer] WebGL2 initialization failed:', error);
        throw error;
      }
    }
  }

  /**
   * Begin frame rendering - call this at the start of each frame
   */
  public beginFrame(): void {
    this.frameStartTime = performance.now();
    this.resetFrameMetrics();
  }

  /**
   * End frame rendering - call this at the end of each frame
   */
  public endFrame(): void {
    const frameTime = performance.now() - this.frameStartTime;
    this.metrics.frameTime = frameTime;

    // Log performance metrics every LOG_INTERVAL frames
    this.frameCounter++;
    if (this.frameCounter % this.LOG_INTERVAL === 0) {
      Logger.debug('[UnifiedRenderer] Frame metrics:', {
        frameTime: `${frameTime.toFixed(2)}ms`,
        fps: Math.round(1000 / frameTime),
        drawCalls: this.metrics.drawCalls,
        vertices: this.metrics.vertices,
        renderMode: this.sectorRenderer.getRenderMode(),
      });
    }
  }

  /**
   * Set the rendering mode for all sectors
   */
  public setRenderMode(mode: RenderMode): void {
    this.sectorRenderer.setRenderMode(mode);
    Logger.info(`[UnifiedRenderer] Render mode changed to: ${mode}`);
  }

  /**
   * Get the current rendering mode
   */
  public getRenderMode(): RenderMode {
    return this.sectorRenderer.getRenderMode();
  }

  /**
   * Get the type of the active renderer backend
   */
  public getRendererType(): 'webgpu' | 'webgl' {
    return this.activeRenderer instanceof WebGPURenderer ? 'webgpu' : 'webgl';
  }

  /**
   * Get the active renderer backend
   */
  public getActiveRenderer(): WebGPURenderer | WebGLRenderer {
    return this.activeRenderer;
  }

  /**
   * Get the sector renderer
   */
  public getSectorRenderer(): SectorRenderer {
    return this.sectorRenderer;
  }

  /**
   * Get the shader manager
   */
  public getShaderManager(): ShaderManager {
    return this.shaderManager;
  }

  /**
   * Create a DOOM-style material with the specified shader type
   */
  public async createDoomMaterial(
    name: string,
    shaderType: ShaderType = 'sector',
    config?: Partial<ShaderConfig>
  ) {
    return this.shaderManager.createDoomMaterial(name, shaderType, config);
  }

  /**
   * Update shader configuration for real-time parameter changes
   */
  public updateShaderConfig(material: ShaderMaterial, config: Partial<ShaderConfig>): void {
    this.shaderManager.updateShaderUniforms(material, config);
  }

  /**
   * Get the Babylon.js engine
   */
  public getBabylonEngine(): Engine {
    if (this.activeRenderer instanceof WebGPURenderer) {
      const webgpuEngine = this.activeRenderer.getBabylonEngine();
      if (webgpuEngine) {
        return webgpuEngine as unknown as Engine;
      }
    }
    return this.engine;
  }

  /**
   * Get renderer capabilities
   */
  public getCapabilities(): RendererCapabilities {
    const rawCaps = this.activeRenderer.getCapabilities();

    // Type-safe capability extraction with proper interfaces
    interface RawRendererCapabilities {
      maxTextureSize?: number;
      maxBufferSize?: number;
      maxBindGroups?: number;
    }

    const caps = rawCaps as RawRendererCapabilities;

    return {
      maxTextureSize: caps.maxTextureSize ?? 4096,
      maxBufferSize: caps.maxBufferSize ?? 128 * 1024 * 1024, // 128MB default
      supportsCompute: this.getRendererType() === 'webgpu',
      supportsRayTracing: false, // Not supported yet
      maxBindGroups: caps.maxBindGroups ?? 4,
    };
  }

  /**
   * Get detailed capabilities (WebGPU only)
   */
  public getDetailedCapabilities() {
    if (this.activeRenderer instanceof WebGPURenderer) {
      return this.activeRenderer.getDetailedCapabilities();
    }
    return this.getCapabilities();
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(): RenderMetrics & { sectorMetrics: ReturnType<SectorRenderer['getMetrics']> } {
    return {
      ...this.metrics,
      sectorMetrics: this.sectorRenderer.getMetrics(),
    };
  }

  /**
   * Check if WebGPU is supported
   */
  public static isWebGPUSupported(): boolean {
    return 'gpu' in navigator;
  }

  /**
   * Get recommended renderer type based on browser support
   */
  public static getRecommendedRendererType(): 'webgpu' | 'webgl' {
    return UnifiedRenderer.isWebGPUSupported() ? 'webgpu' : 'webgl';
  }

  /**
   * Add to draw call count (for performance tracking)
   */
  public addDrawCall(vertices: number): void {
    this.metrics.drawCalls++;
    this.metrics.vertices += vertices;
    this.metrics.triangles += Math.floor(vertices / 3);
  }

  /**
   * Add to memory usage tracking
   */
  public addTextureMemory(bytes: number): void {
    this.metrics.textureMemory += bytes;
  }

  public addBufferMemory(bytes: number): void {
    this.metrics.bufferMemory += bytes;
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    this.sectorRenderer.dispose();
    this.shaderManager.dispose();
    this.activeRenderer.dispose();

    Logger.info('[UnifiedRenderer] All resources disposed');
  }

  /**
   * Create the appropriate renderer based on capabilities and preferences
   */
  private createRenderer(): WebGPURenderer | WebGLRenderer {
    if (this.preferWebGPU && UnifiedRenderer.isWebGPUSupported()) {
      return new WebGPURenderer();
    }
    return new WebGLRenderer(this.engine);
  }

  /**
   * Reset frame metrics
   */
  private resetFrameMetrics(): void {
    this.metrics.drawCalls = 0;
    this.metrics.vertices = 0;
    this.metrics.triangles = 0;
    // Don't reset memory metrics as they accumulate over time
  }
}

/**
 * Factory function to create and initialize a UnifiedRenderer
 */
export async function createUnifiedRenderer(
  engine: Engine,
  scene: Scene,
  preferWebGPU = true
): Promise<UnifiedRenderer> {
  const renderer = new UnifiedRenderer(engine, scene, preferWebGPU);
  await renderer.initialize();
  return renderer;
}
