import { Engine as BabylonEngine, Scene } from '@babylonjs/core';
import type { EngineConfig } from '../types';
import { Renderer } from '../rendering/renderer';
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
    this.sceneManager.createDefaultScene();
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

  private setupEventListeners(): void {
    window.addEventListener('resize', () => {
      this.babylonEngine.resize();
    });

    window.addEventListener('beforeunload', () => {
      this.dispose();
    });
  }
}