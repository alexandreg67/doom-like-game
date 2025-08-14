import { Engine, type EngineConfig } from '@doom-like/engine';
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

    // Hide loading screen
    if (loadingElement) loadingElement.style.display = 'none';
    canvas.style.display = 'block';

    // Start game loop
    engine.start();

    // Display renderer info
    const rendererInfo = document.getElementById('renderer-info');
    if (rendererInfo) {
      const babylonEngine = engine.getBabylonEngine();
      rendererInfo.innerHTML = `
        <p><strong>Renderer:</strong> WebGL</p>
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
        engine.stop();
      } else {
        engine.start();
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
