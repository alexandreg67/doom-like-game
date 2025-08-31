import type { CollisionDetector, Engine } from '@doom-like/engine';
import type { FPSCameraController, PlayerController } from '@doom-like/game-logic';
import type { WeaponPlayerController } from '../weapon-player-controller';

declare global {
  interface Window {
    gameState?: {
      engine: Engine | null;
      playerController: PlayerController | null;
      weaponPlayerController: WeaponPlayerController | null;
      cameraController: FPSCameraController | null;
      collisionDetector: CollisionDetector | null;
      currentLevel: string;
      gameRunning: boolean;
    };
  }
}
