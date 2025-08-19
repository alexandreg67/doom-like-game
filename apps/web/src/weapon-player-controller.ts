/**
 * Extended PlayerController with weapon management
 */

import type { Scene } from '@babylonjs/core';
import type {
  FPSCameraController,
  InputAction,
  InputListener,
  PlayerController,
} from '@doom-like/game-logic';

// Augment window with typed gameState access to avoid `any`
declare global {
  interface Window {
    gameState?: {
      cameraController?: FPSCameraController;
    };
  }
}
import {
  AmmoCounter,
  type AmmoCounterConfig,
  AmmoCounterPresets,
  type CrosshairConfig,
  CrosshairRenderer,
  WeaponFactory,
  WeaponSystem,
  type WeaponSystemConfig,
  createAmmoComponent,
  createWeaponStateComponent,
} from '@doom-like/weapons';
import type { WeaponType } from '@doom-like/weapons';

export class WeaponPlayerController implements InputListener {
  private playerController: PlayerController;
  private weaponSystem: WeaponSystem;
  private crosshairRenderer: CrosshairRenderer;
  private ammoCounter: AmmoCounter;
  private currentWeaponType: WeaponType = 'pistol';

  constructor(
    playerController: PlayerController,
    scene: Scene,
    crosshairContainer: HTMLElement,
    ammoContainer: HTMLElement
  ) {
    this.playerController = playerController;

    // Initialize weapon system
    const weaponConfig: WeaponSystemConfig = {
      scene,
      audioEnabled: true,
      spatialAudioEnabled: true,
      debugMode: false,
    };
    this.weaponSystem = new WeaponSystem(weaponConfig);

    // Initialize UI components
    const crosshairConfig: CrosshairConfig = {
      style: 'dot',
      size: 4,
      thickness: 2,
      gap: 0,
      color: '#ffffff',
      outlineColor: '#000000',
      opacity: 1.0,
      behavior: 'dynamic',
      expandOnFire: true,
      expansionAmount: 1.5,
    };
    console.log('[WEAPON_PLAYER] Creating crosshair with config:', crosshairConfig);
    this.crosshairRenderer = new CrosshairRenderer(crosshairContainer, crosshairConfig);

    console.log('[WEAPON_PLAYER] Creating ammo counter with config:', AmmoCounterPresets.doom);
    const ammoConfig: AmmoCounterConfig = AmmoCounterPresets.doom;
    this.ammoCounter = new AmmoCounter(ammoContainer, ammoConfig);

    // Setup initial weapon and components
    this.setupInitialWeapon();

    // Register as input listener
    this.setupInputListeners();

    console.log('[WEAPON_PLAYER] WeaponPlayerController initialized');
  }

  /**
   * Setup initial weapon (pistol) and components for the player
   */
  private setupInitialWeapon(): void {
    const playerEntity = this.playerController.getEntity();

    // Create weapon component (Pistol)
    const weaponComponent = WeaponFactory.createWeaponComponent('pistol');
    playerEntity.components.set('weapon', weaponComponent);

    // Create ammo component with initial ammo
    const ammoComponent = createAmmoComponent();
    // Override with reduced initial ammo for gameplay balance
    ammoComponent.ammoReserves.set('bullets', 50);
    ammoComponent.ammoReserves.set('shells', 0);
    ammoComponent.ammoReserves.set('rockets', 0);
    ammoComponent.ammoReserves.set('cells', 0);
    playerEntity.components.set('ammo', ammoComponent);

    // Create weapon state component
    const weaponStateComponent = createWeaponStateComponent();
    playerEntity.components.set('weaponState', weaponStateComponent);

    // Crosshair is already configured in constructor
    console.log('[WEAPON_PLAYER] Setting crosshair visible');
    this.crosshairRenderer.setVisible(true);

    // Setup initial ammo display
    console.log('[WEAPON_PLAYER] Updating ammo display');
    this.updateAmmoDisplay();

    console.log('[WEAPON_PLAYER] Initial weapon setup complete: Pistol');
  }

  /**
   * Setup input listeners for weapon actions
   */
  private setupInputListeners(): void {
    const inputManager = this.playerController.getInputManager();

    // Register this controller as an input listener
    inputManager.addListener(this);

    // TEMP: Direct keyboard listener as fallback for weapon switching
    document.addEventListener('keydown', (e) => {
      console.log(`[WEAPON_PLAYER] TEMP Direct keydown: ${e.code}`);

      switch (e.code) {
        case 'Digit1':
        case 'Numpad1':
          console.log('[WEAPON_PLAYER] TEMP Direct weapon 1');
          this.handleWeaponInput('selectWeapon1');
          break;
        case 'Digit2':
        case 'Numpad2':
          console.log('[WEAPON_PLAYER] TEMP Direct weapon 2');
          this.handleWeaponInput('selectWeapon2');
          break;
        case 'Digit3':
        case 'Numpad3':
          console.log('[WEAPON_PLAYER] TEMP Direct weapon 3');
          this.handleWeaponInput('selectWeapon3');
          break;
        case 'Digit4':
        case 'Numpad4':
          console.log('[WEAPON_PLAYER] TEMP Direct weapon 4');
          this.handleWeaponInput('selectWeapon4');
          break;
      }
    });

    console.log('[WEAPON_PLAYER] Input listeners setup complete');
  }

  /**
   * InputListener interface implementation
   */
  public onInputChange(action: InputAction, value: boolean): void {
    // Log all input changes for debugging
    console.log(`[WEAPON_PLAYER] Input change: ${action} = ${value}`);

    // Handle weapon-specific inputs on key press
    if (value) {
      this.handleWeaponInput(action);
    }
  }

  public onMouseMove(_deltaX: number, _deltaY: number): void {
    // Not needed for weapon system
  }

  public onPointerLockChange(locked: boolean): void {
    // Update crosshair visibility based on pointer lock state
    if (locked) {
      this.crosshairRenderer.setVisible(true);
      // Ensure audio context is resumed on a user gesture
      this.weaponSystem
        .getAudioManager()
        .resumeOnUserGesture()
        .catch(() => {
          // Ignored: resume failures will be retried on next gesture
        });
    } else {
      this.crosshairRenderer.setVisible(false);
    }
  }

  /**
   * Handle weapon-specific input actions
   */
  private handleWeaponInput(action: InputAction): void {
    console.log(`[WEAPON_PLAYER] Handling weapon input: ${action}`);
    switch (action) {
      case 'fire':
        this.fireWeapon();
        break;

      case 'reload':
        this.reloadWeapon();
        break;

      case 'nextWeapon':
        this.switchToNextWeapon();
        break;

      case 'prevWeapon':
        this.switchToPreviousWeapon();
        break;

      // Direct weapon selection (DOOM-style)
      case 'selectWeapon1':
        this.switchToWeapon('pistol');
        break;

      case 'selectWeapon2':
        this.switchToWeapon('enhanced_pistol'); // Distinct slot 2 pistol variant
        break;

      case 'selectWeapon3':
        this.switchToWeapon('shotgun');
        break;

      case 'selectWeapon4':
        this.switchToWeapon('chaingun');
        break;

      case 'selectWeapon5':
        this.switchToWeapon('rocket_launcher');
        break;

      case 'selectWeapon6':
        // Plasma rifle (when implemented)
        console.log('[WEAPON_PLAYER] Plasma rifle not yet implemented');
        break;

      case 'selectWeapon7':
        // BFG (when implemented)
        console.log('[WEAPON_PLAYER] BFG not yet implemented');
        break;

      case 'selectWeapon8':
        // Chainsaw or special weapon
        console.log('[WEAPON_PLAYER] Special weapon slot not yet implemented');
        break;
    }
  }

  /**
   * Fire current weapon
   */
  private fireWeapon(): void {
    const playerEntity = this.playerController.getEntity();

    // Get camera position and direction for firing
    const cameraController = this.getCameraController();
    if (!cameraController) {
      console.warn('[WEAPON_PLAYER] No camera controller available for firing');
      return;
    }

    const cameraState = cameraController.getState();
    const fireOrigin = cameraState.position.clone();
    const fireDirection = cameraState.forward.clone();

    // Fire weapon through weapon system
    const result = this.weaponSystem.attemptFire(playerEntity, fireOrigin, fireDirection);

    if (result) {
      // Show crosshair expansion on successful fire
      this.crosshairRenderer.animateExpansion();

      // Update ammo display
      this.updateAmmoDisplay();

      console.log('[WEAPON_PLAYER] Weapon fired:', result);
    }
  }

  /**
   * Reload current weapon
   */
  private reloadWeapon(): void {
    const playerEntity = this.playerController.getEntity();
    const success = this.weaponSystem.startReload(playerEntity);

    if (success) {
      console.log('[WEAPON_PLAYER] Reload started');
    } else {
      console.log('[WEAPON_PLAYER] Cannot reload weapon');
    }
  }

  /**
   * Switch to next weapon in inventory
   */
  private switchToNextWeapon(): void {
    const availableWeapons: WeaponType[] = [
      'pistol',
      'enhanced_pistol',
      'shotgun',
      'chaingun',
      'rocket_launcher',
    ];
    const currentIndex = availableWeapons.indexOf(this.currentWeaponType);
    const nextIndex = (currentIndex + 1) % availableWeapons.length;
    const nextWeapon: WeaponType = availableWeapons[nextIndex] ?? 'pistol';

    this.switchToWeapon(nextWeapon);
  }

  /**
   * Switch to previous weapon in inventory
   */
  private switchToPreviousWeapon(): void {
    const availableWeapons: WeaponType[] = [
      'pistol',
      'enhanced_pistol',
      'shotgun',
      'chaingun',
      'rocket_launcher',
    ];
    const currentIndex = availableWeapons.indexOf(this.currentWeaponType);
    const prevIndex = currentIndex === 0 ? availableWeapons.length - 1 : currentIndex - 1;
    const prevWeapon: WeaponType = availableWeapons[prevIndex] ?? 'pistol';

    this.switchToWeapon(prevWeapon);
  }

  /**
   * Switch to specific weapon
   */
  private switchToWeapon(weaponType: WeaponType): void {
    if (weaponType === this.currentWeaponType) {
      console.log(`[WEAPON_PLAYER] Already using ${weaponType}`);
      return;
    }

    const playerEntity = this.playerController.getEntity();

    // Check if we have this weapon (for now, allow all weapons for testing)
    // In a real game, you'd check inventory/unlocks here

    // Create new weapon component
    const newWeaponComponent = WeaponFactory.createWeaponComponent(weaponType);
    playerEntity.components.set('weapon', newWeaponComponent);

    // Update current weapon type
    this.currentWeaponType = weaponType;

    // Update crosshair for new weapon
    this.updateCrosshairForWeapon(weaponType);

    // Update ammo display
    this.updateAmmoDisplay();

    console.log(`[WEAPON_PLAYER] Switched to weapon: ${weaponType}`);
  }

  /**
   * Update crosshair appearance based on weapon
   */
  private updateCrosshairForWeapon(weaponType: WeaponType): void {
    let crosshairConfig: Partial<CrosshairConfig>;

    switch (weaponType) {
      case 'pistol':
        crosshairConfig = {
          style: 'dot',
          size: 4,
          thickness: 2,
          gap: 0,
          color: '#ffffff',
          opacity: 1.0,
          behavior: 'dynamic',
          expandOnFire: true,
          expansionAmount: 1.2,
        };
        break;

      case 'enhanced_pistol':
        crosshairConfig = {
          style: 'circle',
          size: 12,
          thickness: 2,
          gap: 0,
          color: '#00ffff',
          opacity: 1.0,
          behavior: 'dynamic',
          expandOnFire: true,
          expansionAmount: 1.2,
        };
        break;

      case 'shotgun':
        crosshairConfig = {
          style: 'circle',
          size: 20,
          thickness: 3,
          gap: 8,
          color: '#ffffff',
          opacity: 0.8,
          behavior: 'static',
          expandOnFire: false,
        };
        break;

      case 'chaingun':
        crosshairConfig = {
          style: 'cross',
          size: 18,
          thickness: 3,
          gap: 6,
          color: '#ffff00',
          opacity: 1.0,
          behavior: 'dynamic',
          expandOnFire: true,
          expansionAmount: 2.0,
        };
        break;

      case 'rocket_launcher':
        crosshairConfig = {
          style: 'cross',
          size: 16,
          thickness: 2,
          gap: 6,
          color: '#ff4444',
          opacity: 1.0,
          behavior: 'static',
          expandOnFire: false,
        };
        break;

      default:
        crosshairConfig = {
          style: 'cross',
          size: 10,
          thickness: 2,
          gap: 4,
          color: '#ffffff',
          opacity: 1.0,
          behavior: 'dynamic',
          expandOnFire: true,
          expansionAmount: 1.5,
        };
    }

    this.crosshairRenderer.updateConfig(crosshairConfig);
  }

  /**
   * Update ammo display in UI
   */
  private updateAmmoDisplay(): void {
    const playerEntity = this.playerController.getEntity();
    this.ammoCounter.update(playerEntity);
  }

  /**
   * Get camera controller from the player controller
   */
  private getCameraController(): FPSCameraController | null {
    // Access camera controller through global game state
    // This is a bit hacky but works for our integration
    const state = window.gameState;
    return state?.cameraController ?? null;
  }

  /**
   * Update weapon systems (call in game loop)
   */
  public update(deltaTime: number): void {
    const playerEntity = this.playerController.getEntity();

    // Update weapon system
    this.weaponSystem.update(playerEntity, deltaTime);

    // Update audio listener position
    const cameraController = this.getCameraController();
    if (cameraController) {
      const cameraState = cameraController.getState();
      this.weaponSystem.updateAudioListener(
        cameraState.position,
        cameraState.forward,
        cameraState.up
      );
    }

    // Update ammo display
    this.updateAmmoDisplay();
  }

  /**
   * Get the underlying player controller
   */
  public getPlayerController(): PlayerController {
    return this.playerController;
  }

  /**
   * Get the weapon system
   */
  public getWeaponSystem(): WeaponSystem {
    return this.weaponSystem;
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    // Remove input listener
    const inputManager = this.playerController.getInputManager();
    inputManager.removeListener(this);

    // Dispose weapon systems
    this.weaponSystem.dispose();
    this.crosshairRenderer.dispose();
    this.ammoCounter.dispose();

    console.log('[WEAPON_PLAYER] WeaponPlayerController disposed');
  }
}
