import {
  Color3,
  type Engine,
  FreeCamera,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';

export class SceneManager {
  private engine: Engine;
  private currentScene: Scene | null = null;

  constructor(engine: Engine) {
    this.engine = engine;
  }

  public createDefaultScene(): Scene {
    const scene = new Scene(this.engine);

    // Create camera
    const camera = new FreeCamera('camera', new Vector3(0, 2, -5), scene);
    camera.setTarget(Vector3.Zero());
    // Attach camera controls to canvas
    const canvas = this.engine.getRenderingCanvas();
    if (canvas) {
      camera.attachControl(canvas, true);
    }

    // Create lighting
    const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

    // Create simple ground plane
    const ground = MeshBuilder.CreateGround('ground', { width: 10, height: 10 }, scene);
    const groundMaterial = new StandardMaterial('groundMaterial', scene);
    groundMaterial.diffuseColor = new Color3(0.4, 0.4, 0.4);
    ground.material = groundMaterial;

    // Create a simple wall for testing
    const wall = MeshBuilder.CreateBox('wall', { width: 10, height: 3, depth: 0.5 }, scene);
    wall.position = new Vector3(0, 1.5, 3);
    const wallMaterial = new StandardMaterial('wallMaterial', scene);
    wallMaterial.diffuseColor = new Color3(0.6, 0.6, 0.8);
    wall.material = wallMaterial;

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
