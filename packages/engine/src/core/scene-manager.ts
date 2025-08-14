import {
  Color3,
  type Engine,
  FreeCamera,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector2,
  Vector3,
} from '@babylonjs/core';
import type { DoomSector, DoomVertex } from '../geometry/doom-geometry';

export class SceneManager {
  private engine: Engine;
  private currentScene: Scene | null = null;

  constructor(engine: Engine) {
    this.engine = engine;
  }

  public createDefaultScene(): Scene {
    const scene = new Scene(this.engine);

    // Create camera
    const camera = new FreeCamera('camera', new Vector3(0, 5, -10), scene);
    camera.setTarget(new Vector3(0, 2, 0));
    // Attach camera controls to canvas
    const canvas = this.engine.getRenderingCanvas();
    if (canvas) {
      camera.attachControl(canvas, true);
    }

    // Create lighting
    const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

    // Define a simple square sector
    const vertices: DoomVertex[] = [
      { id: 'v1', position: new Vector2(-5, -5) },
      { id: 'v2', position: new Vector2(5, -5) },
      { id: 'v3', position: new Vector2(5, 5) },
      { id: 'v4', position: new Vector2(-5, 5) },
    ];

    const _sector: DoomSector = {
      id: 's1',
      floorHeight: 0,
      ceilingHeight: 4,
      floorTexture: 'FLOOR1',
      ceilingTexture: 'CEIL1',
      lightLevel: 200,
      vertices: vertices,
      lineDefs: [], // Will be populated later
      neighbors: [],
      // Bounding box and other data will be calculated by SectorGeometry
      boundingBox: { min: new Vector2(0, 0), max: new Vector2(0, 0) },
      meshId: 'sector_s1',
    };

    // TODO: In the next step, we will use SectorGeometry to create the mesh from `sector` data.
    // For now, let's keep the ground plane to have something to see.
    console.log('Defined test sector:', _sector); // Temporary log to avoid unused variable error
    const ground = MeshBuilder.CreateGround('ground', { width: 10, height: 10 }, scene);
    const groundMaterial = new StandardMaterial('groundMaterial', scene);
    groundMaterial.diffuseColor = new Color3(0.4, 0.4, 0.4);
    ground.material = groundMaterial;

    this.currentScene = scene;
    return scene;
  }

  public render(): void {
    if (this.currentScene) {
      this.currentScene.render();
    }
  }

  public getCurrentScene(): Scene {
    if (!this.currentScene) {
      throw new Error('No active scene. Call createDefaultScene() first.');
    }
    return this.currentScene;
  }

  public dispose(): void {
    if (this.currentScene) {
      this.currentScene.dispose();
      this.currentScene = null;
    }
  }
}
