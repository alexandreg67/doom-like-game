import { FreeCamera } from '@babylonjs/core';
import { CollisionDetector, Engine, type EngineConfig, loadLevelFromURL } from '@doom-like/engine';
import {
  ECS,
  type Entity,
  FPSCameraController,
  InputManager,
  PlayerController,
  Transform,
} from '@doom-like/game-logic';
import './style.css';

const gameState = {
  engine: null as Engine | null,
  playerController: null as PlayerController | null,
  cameraController: null as FPSCameraController | null,
  collisionDetector: null as CollisionDetector | null,
  currentLevel: 'demo_level_phase1',
  gameRunning: false,
};

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

    gameState.engine = engine;

    // Initialize collision system
    const collisionDetector = new CollisionDetector();
    gameState.collisionDetector = collisionDetector;

    // Initialize game systems
    const ecs = new ECS();
    const inputManager = new InputManager(canvas);

    // Create player entity
    const playerEntity: Entity = ecs.createEntity('player');
    playerEntity.components.set('transform', new Transform(0, 0, 0));

    // Initialize player controller with collision detection
    const playerController = new PlayerController(playerEntity, inputManager, collisionDetector);
    const cameraController = new FPSCameraController(inputManager, playerController);

    gameState.playerController = playerController;
    gameState.cameraController = cameraController;

    console.log('[GAME] Player systems initialized');

    // Load initial level
    await loadLevel(gameState.currentLevel);

    // Setup level selector
    setupLevelSelector();

    // Start game loop
    startGameLoop();

    // Hide loading screen and show game
    if (loadingElement) loadingElement.style.display = 'none';
    canvas.style.display = 'block';

    // Setup UI and event handlers
    setupEventHandlers(canvas);
    setupRendererInfo();

    console.log('[GAME] Game initialized successfully');
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

async function loadLevel(levelName: string) {
  if (!gameState.engine || !gameState.collisionDetector) {
    console.error('[GAME] Cannot load level: engine or collision detector not initialized');
    return;
  }

  try {
    console.log(`[GAME] Loading level: ${levelName}`);

    // Load level data from fixtures
    const levelUrl = `/fixtures/${levelName}.json`;
    console.log(`[GAME] Attempting to load from URL: ${levelUrl}`);
    const levelData = await loadLevelFromURL(levelUrl);
    console.log('[GAME] Level data loaded:', levelData);

    // Setup collision geometry
    gameState.collisionDetector.setGeometry({
      lineDefs: levelData.lineDefs,
      sectors: Array.from(levelData.sectors.values()),
    });

    // Position player at spawn point
    if (gameState.playerController && levelData.playerStart) {
      const transform = gameState.playerController
        .getEntity()
        .components.get('transform') as Transform;
      if (transform) {
        transform.x = levelData.playerStart.position.x;
        transform.y = 0; // Y will be set by sector floor height
        transform.z = levelData.playerStart.position.y; // JSON uses x,y but we map to x,z
      }
    }

    // TODO: Update scene with level geometry
    // await gameState.engine.loadLevel(levelData);

    // For now, just update the collision system and player position
    console.log(
      `[GAME] Collision geometry loaded with ${levelData.lineDefs.length} lines and ${Array.from(levelData.sectors.values()).length} sectors`
    );

    gameState.currentLevel = levelName;
    console.log(`[GAME] Level ${levelName} loaded successfully`);

    // Add visual indicator that level changed
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed; top: 20px; right: 20px; 
      background: rgba(0, 255, 0, 0.8); color: black; 
      padding: 10px; border-radius: 5px; z-index: 1000;
      font-family: "Courier New", monospace; font-weight: bold;
    `;
    notification.textContent = `Level loaded: ${levelName}`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  } catch (error) {
    console.error(`[GAME] Failed to load level ${levelName}:`, error);
  }
}

function setupLevelSelector() {
  const levelSelect = document.getElementById('level-select') as HTMLSelectElement;
  const loadLevelBtn = document.getElementById('load-level-btn') as HTMLButtonElement;
  const reloadLevelBtn = document.getElementById('reload-level-btn') as HTMLButtonElement;

  if (!levelSelect || !loadLevelBtn || !reloadLevelBtn) {
    console.warn('[GAME] Level selector elements not found');
    return;
  }

  // Set current level as selected
  levelSelect.value = gameState.currentLevel;

  // Load level button
  loadLevelBtn.addEventListener('click', async () => {
    const selectedLevel = levelSelect.value;
    console.log(
      `[UI] Load level button clicked, selected: ${selectedLevel}, current: ${gameState.currentLevel}`
    );
    if (selectedLevel !== gameState.currentLevel) {
      loadLevelBtn.disabled = true;
      loadLevelBtn.textContent = 'Chargement...';
      console.log(`[UI] Starting level load for: ${selectedLevel}`);

      await loadLevel(selectedLevel);

      loadLevelBtn.disabled = false;
      loadLevelBtn.textContent = 'Charger niveau';
      console.log('[UI] Level load completed');
    } else {
      console.log(`[UI] Level ${selectedLevel} already loaded, skipping`);
    }
  });

  // Reload current level button
  reloadLevelBtn.addEventListener('click', async () => {
    reloadLevelBtn.disabled = true;
    reloadLevelBtn.textContent = 'Rechargement...';

    await loadLevel(gameState.currentLevel);

    reloadLevelBtn.disabled = false;
    reloadLevelBtn.textContent = 'Recharger niveau actuel';
  });
}

function startGameLoop() {
  let lastTime = performance.now();
  gameState.gameRunning = true;

  function gameLoop(currentTime: number) {
    if (
      !gameState.gameRunning ||
      !gameState.playerController ||
      !gameState.cameraController ||
      !gameState.engine
    ) {
      return;
    }

    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    // Update game systems
    gameState.playerController.update(deltaTime);
    gameState.cameraController.update(deltaTime);

    // Sync with Babylon.js camera
    const babylonScene = gameState.engine.getBabylonEngine().scenes[0];
    if (babylonScene?.activeCamera) {
      const cameraState = gameState.cameraController.getState();
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

  // Start engine and begin game loop
  if (gameState.engine) {
    gameState.engine.start();
    requestAnimationFrame(gameLoop);
  }
}

function setupEventHandlers(canvas: HTMLCanvasElement) {
  if (!gameState.playerController) return;

  // Get input manager from player controller
  const inputManager = gameState.playerController.getInputManager();

  // Auto-request pointer lock on canvas click
  canvas.addEventListener('click', async () => {
    await inputManager.requestPointerLock();
  });

  // Handle window resize
  window.addEventListener('resize', () => {
    gameState.engine?.getBabylonEngine().resize();
  });

  // Handle visibility change
  document.addEventListener('visibilitychange', () => {
    if (!gameState.engine) return;

    if (document.hidden) {
      gameState.gameRunning = false;
      gameState.engine.stop();
    } else {
      gameState.gameRunning = true;
      gameState.engine.start();
      startGameLoop();
    }
  });
}

function setupRendererInfo() {
  const rendererInfo = document.getElementById('renderer-info');
  if (!rendererInfo || !gameState.engine) return;

  const babylonEngine = gameState.engine.getBabylonEngine();
  const rendererType = gameState.engine.getRenderer().getRendererType();
  const capabilities = gameState.engine.getRenderer().getCapabilities();

  rendererInfo.innerHTML = `
    <p><strong>Renderer:</strong> ${rendererType.toUpperCase()} ${capabilities.supported ? '✅' : '⚠️'}</p>
    <p><strong>Version:</strong> Babylon.js ${babylonEngine.version}</p>
    <p><strong>FPS:</strong> <span id="fps">--</span></p>
    <p><strong>Level:</strong> <span id="current-level">${gameState.currentLevel}</span></p>
    <p><strong>Position:</strong> <span id="player-pos">0,0,0</span></p>
    <p><strong>Sector:</strong> <span id="current-sector">none</span></p>
    <p><strong>Collisions:</strong> <span id="collision-metrics">0/sec</span></p>
  `;

  // Update metrics counter
  setInterval(() => {
    updateDisplayMetrics();
  }, 100);
}

function updateDisplayMetrics() {
  if (!gameState.playerController || !gameState.collisionDetector || !gameState.engine) return;

  const fpsElement = document.getElementById('fps');
  const levelElement = document.getElementById('current-level');
  const posElement = document.getElementById('player-pos');
  const sectorElement = document.getElementById('current-sector');
  const collisionElement = document.getElementById('collision-metrics');

  // Update FPS
  if (fpsElement) {
    fpsElement.textContent = gameState.engine.getBabylonEngine().getFps().toFixed(1);
  }

  // Update level
  if (levelElement) {
    levelElement.textContent = gameState.currentLevel;
  }

  // Update player position
  if (posElement) {
    const transform = gameState.playerController
      .getEntity()
      .components.get('transform') as Transform;
    if (transform) {
      posElement.textContent = `${transform.x.toFixed(1)}, ${transform.y.toFixed(1)}, ${transform.z.toFixed(1)}`;
    }
  }

  // Update current sector
  if (sectorElement) {
    const currentSector = gameState.playerController.getCurrentSector();
    sectorElement.textContent = currentSector ? currentSector.id : 'none';
  }

  // Update collision metrics (read-only to avoid interfering with other consumers)
  if (collisionElement) {
    const metrics = gameState.collisionDetector.getMetrics();
    collisionElement.textContent = `${metrics.collisionChecks}/sec, ${metrics.lineTests} tests`;
    // Note: Not calling resetMetrics() to avoid interfering with other metric consumers
  }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeGame);
} else {
  initializeGame();
}
