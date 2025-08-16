import { FreeCamera } from '@babylonjs/core';
import { Engine, type EngineConfig } from '@doom-like/engine';
import {
  ECS,
  type Entity,
  FPSCameraController,
  InputManager,
  PlayerController,
  Transform,
} from '@doom-like/game-logic';
import './style.css';

async function initializeGame() {
  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error('Game canvas not found');
  }

  // Show loading screen
  const loadingElement = document.getElementById('loading');
  const errorElement = document.getElementById('error');

  try {
    // Engine configuration
    const config: EngineConfig = {
      canvas,
      preferWebGPU: true,
      antialias: true,
      powerPreference: 'high-performance',
      adaptToDeviceRatio: true,
      preserveDrawingBuffer: false,
      stencil: true,
      premultipliedAlpha: false,
      alpha: false,
      desynchronized: false,
      audioEngine: true,
      deterministicLockstep: false,
      lockstepMaxSteps: 4,
    };

    console.log('[GAME] Initializing engine...');
    const engine = new Engine(config);

    await engine.initialize();
    console.log('[GAME] Engine initialized successfully');

    // Initialize game systems
    const ecs = new ECS();
    const inputManager = new InputManager(canvas);

    // Create player entity
    const playerEntity: Entity = ecs.createEntity('player');
    playerEntity.components.set('transform', new Transform(0, 0, 0));

    // Initialize player controller and camera
    const playerController = new PlayerController(playerEntity, inputManager);
    const cameraController = new FPSCameraController(inputManager, playerController);

    console.log('[GAME] Player systems initialized');

    // Game loop variables
    let lastTime = performance.now();
    let gameRunning = true;

    // Game update function
    function gameLoop(currentTime: number) {
      if (!gameRunning) return;

      const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
      lastTime = currentTime;

      // Update game systems
      playerController.update(deltaTime);
      cameraController.update(deltaTime);

      // Sync with Babylon.js camera
      const babylonScene = engine.getBabylonEngine().scenes[0];
      if (babylonScene?.activeCamera) {
        const cameraState = cameraController.getState();
        const babylonCamera = babylonScene.activeCamera;

        // Update camera position and rotation
        babylonCamera.position.copyFrom(cameraState.position);

        // Update camera rotation using direction vectors
        if (babylonCamera instanceof FreeCamera) {
          const target = cameraState.position.add(cameraState.forward);
          babylonCamera.setTarget(target);
        }
      }

      requestAnimationFrame(gameLoop);
    }

    // Hide loading screen
    if (loadingElement) loadingElement.style.display = 'none';
    canvas.style.display = 'block';

    // Start engine and game loop
    engine.start();
    requestAnimationFrame(gameLoop);

    // Auto-request pointer lock on canvas click
    canvas.addEventListener('click', async () => {
      await inputManager.requestPointerLock();
    });

    // Display renderer info
    const rendererInfo = document.getElementById('renderer-info');
    if (rendererInfo) {
      const babylonEngine = engine.getBabylonEngine();
      const rendererType = engine.getRenderer().getRendererType();
      const capabilities = engine.getRenderer().getCapabilities();

      rendererInfo.innerHTML = `
        <p><strong>Renderer:</strong> ${rendererType.toUpperCase()} ${capabilities.supported ? '✅' : '⚠️'}</p>
        <p><strong>Version:</strong> Babylon.js ${babylonEngine.version}</p>
        <p><strong>FPS:</strong> <span id="fps">--</span></p>
      `;

      // Update FPS counter
      setInterval(() => {
        const fpsElement = document.getElementById('fps');
        if (fpsElement) {
          fpsElement.textContent = babylonEngine.getFps().toFixed(1);
        }
      }, 1000);
    }

    // Handle window resize
    window.addEventListener('resize', () => {
      engine.getBabylonEngine().resize();
    });

    // Handle visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        gameRunning = false;
        engine.stop();
      } else {
        gameRunning = true;
        engine.start();
        lastTime = performance.now();
        requestAnimationFrame(gameLoop);
      }
    });
  } catch (error) {
    console.error('[GAME] Failed to initialize:', error);

    if (loadingElement) loadingElement.style.display = 'none';
    if (errorElement) {
      errorElement.style.display = 'block';
      errorElement.innerHTML = `
        <h2>Failed to initialize game</h2>
        <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
        <p>Please try:</p>
        <ul>
          <li>Refreshing the page</li>
          <li>Updating your browser</li>
          <li>Checking if WebGL is enabled</li>
        </ul>
      `;
    }
  }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeGame);
} else {
  initializeGame();
}
