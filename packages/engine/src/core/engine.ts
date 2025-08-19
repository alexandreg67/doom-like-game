import { Engine as BabylonEngine, type Scene } from '@babylonjs/core';
import type { ParsedLevel } from '../geometry/level-loader';
import { Renderer } from '../rendering/renderer';
import type { EngineConfig } from '../types';
import { SceneManager } from './scene-manager';

export class Engine {
  private babylonEngine: BabylonEngine;
  private renderer: Renderer;
  private sceneManager: SceneManager;
  private isRunning = false;

  constructor(config: EngineConfig) {
    this.babylonEngine = new BabylonEngine(config.canvas, config.antialias, {
      powerPreference: config.powerPreference,
      adaptToDeviceRatio: config.adaptToDeviceRatio,
      preserveDrawingBuffer: config.preserveDrawingBuffer,
      stencil: config.stencil,
      premultipliedAlpha: config.premultipliedAlpha,
      alpha: config.alpha,
      desynchronized: config.desynchronized,
      audioEngine: config.audioEngine,
      deterministicLockstep: config.deterministicLockstep,
      lockstepMaxSteps: config.lockstepMaxSteps,
    });

    this.renderer = new Renderer(this.babylonEngine, config.preferWebGPU);
    this.sceneManager = new SceneManager(this.babylonEngine);

    this.setupEventListeners();
  }

  public async initialize(): Promise<void> {
    await this.renderer.initialize();
    await this.sceneManager.createDefaultScene();
  }

  public start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.babylonEngine.runRenderLoop(() => {
      this.sceneManager.render();
    });
  }

  public stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.babylonEngine.stopRenderLoop();
  }

  public dispose(): void {
    this.stop();
    this.sceneManager.dispose();
    this.babylonEngine.dispose();
  }

  public getScene(): Scene {
    return this.sceneManager.getCurrentScene();
  }

  public getBabylonEngine(): BabylonEngine {
    return this.babylonEngine;
  }

  public getRenderer(): Renderer {
    return this.renderer;
  }

  /**
   * Loads a new level dynamically, replacing the current level
   * @param levelData - The parsed level data to load
   */
  public async loadLevel(levelData: ParsedLevel): Promise<void> {
    console.log('[ENGINE] Engine.loadLevel() called');

    try {
      // Delegate to scene manager
      await this.sceneManager.loadLevel(levelData);
      console.log('[ENGINE] Level loaded successfully via Engine API');
    } catch (error) {
      console.error('[ENGINE] Failed to load level via Engine API:', error);
      // Re-throw to allow caller to handle the error
      throw error;
    }
  }

  private setupEventListeners(): void {
    window.addEventListener('resize', () => {
      this.babylonEngine.resize();
    });

    window.addEventListener('beforeunload', () => {
      this.dispose();
    });
  }
}
