/**
 * Weapon switching system for managing weapon selection
 */

import type { Entity } from '@doom-like/game-logic';
import type { WeaponSlotComponent } from '../components/weapon-component';
import type { WeaponStateComponent } from '../components/weapon-state-component';
import { WeaponFactory, type WeaponType } from '../weapons/weapon-factory';

export class WeaponSwitchSystem {
  private switchQueue: Array<{ entity: Entity; targetSlot: number; timestamp: number }> = [];
  private readonly SWITCH_TIMEOUT = 200; // ms - how long to wait for additional inputs

  /**
   * Switch to weapon in specific slot
   */
  public switchToSlot(entity: Entity, slotNumber: number): boolean {
    const slots = entity.components.get('weaponSlot') as WeaponSlotComponent;
    const state = entity.components.get('weaponState') as WeaponStateComponent;

    if (!slots || !state) {
      return false;
    }

    // Check if slot has a weapon
    const targetWeapon = slots.slots.get(slotNumber);
    if (!targetWeapon) {
      return false; // No weapon in this slot
    }

    // Check if already on this weapon
    if (slots.currentSlot === slotNumber && !state.isSwitching) {
      return false; // Already selected
    }

    // Check if weapon switch is allowed
    if (!this.canSwitchWeapon(entity)) {
      return false;
    }

    // Start weapon switch
    return this.beginWeaponSwitch(entity, slotNumber);
  }

  /**
   * Switch to next available weapon
   */
  public switchToNext(entity: Entity): boolean {
    const slots = entity.components.get('weaponSlot') as WeaponSlotComponent;

    if (!slots) {
      return false;
    }

    const currentSlot = slots.currentSlot;

    // Find next weapon slot
    for (let i = 1; i <= 8; i++) {
      const nextSlot = ((currentSlot + i - 1) % 8) + 1;
      if (slots.slots.get(nextSlot)) {
        return this.switchToSlot(entity, nextSlot);
      }
    }

    return false; // No other weapons available
  }

  /**
   * Switch to previous available weapon
   */
  public switchToPrevious(entity: Entity): boolean {
    const slots = entity.components.get('weaponSlot') as WeaponSlotComponent;

    if (!slots) {
      return false;
    }

    const currentSlot = slots.currentSlot;

    // Find previous weapon slot
    for (let i = 1; i <= 8; i++) {
      const prevSlot = ((currentSlot - i - 1 + 8) % 8) + 1;
      if (slots.slots.get(prevSlot)) {
        return this.switchToSlot(entity, prevSlot);
      }
    }

    return false; // No other weapons available
  }

  /**
   * Switch to last used weapon
   */
  public switchToLast(entity: Entity): boolean {
    const slots = entity.components.get('weaponSlot') as WeaponSlotComponent;

    if (!slots) {
      return false;
    }

    return this.switchToSlot(entity, slots.previousSlot);
  }

  /**
   * Add weapon to slot
   */
  public addWeaponToSlot(entity: Entity, weaponType: WeaponType, slotNumber?: number): boolean {
    const slots = entity.components.get('weaponSlot') as WeaponSlotComponent;

    if (!slots) {
      return false;
    }

    // Determine slot number
    let targetSlot = slotNumber;
    if (!targetSlot) {
      const weapon = WeaponFactory.createWeapon(weaponType);
      targetSlot = weapon.getSlotNumber();
    }

    // Validate slot number
    if (targetSlot < 1 || targetSlot > 8) {
      return false;
    }

    // Create weapon component
    const weaponComponent = WeaponFactory.createWeaponComponent(weaponType);

    // Add to slot
    slots.slots.set(targetSlot, weaponComponent);

    console.log(`[WEAPON] Added ${weaponComponent.config.name} to slot ${targetSlot}`);

    // Auto-switch if no current weapon or if adding to current slot
    if (slots.currentSlot === 0 || !slots.slots.get(slots.currentSlot)) {
      this.switchToSlot(entity, targetSlot);
    }

    return true;
  }

  /**
   * Remove weapon from slot
   */
  public removeWeaponFromSlot(entity: Entity, slotNumber: number): boolean {
    const slots = entity.components.get('weaponSlot') as WeaponSlotComponent;

    if (!slots) {
      return false;
    }

    const weapon = slots.slots.get(slotNumber);
    if (!weapon) {
      return false; // No weapon in slot
    }

    // Remove weapon
    slots.slots.set(slotNumber, null);

    // If removing current weapon, switch to another
    if (slots.currentSlot === slotNumber) {
      this.findAndSwitchToAvailableWeapon(entity);
    }

    console.log(`[WEAPON] Removed ${weapon.config.name} from slot ${slotNumber}`);
    return true;
  }

  /**
   * Update weapon switching state
   */
  public update(entity: Entity, deltaTime: number): void {
    const state = entity.components.get('weaponState') as WeaponStateComponent;

    if (!state || !state.isSwitching) {
      return;
    }

    this.updateSwitchProgress(entity);
    this.processQueue();
  }

  /**
   * Check if weapon switching is allowed
   */
  public canSwitchWeapon(entity: Entity): boolean {
    const state = entity.components.get('weaponState') as WeaponStateComponent;

    if (!state) {
      return false;
    }

    // Can't switch while reloading (unless reload is cancellable)
    if (state.isReloading && !state.canCancelReload) {
      return false;
    }

    // Always allow switching (even while firing for fast weapon switching)
    return true;
  }

  /**
   * Get available weapon slots
   */
  public getAvailableSlots(entity: Entity): number[] {
    const slots = entity.components.get('weaponSlot') as WeaponSlotComponent;

    if (!slots) {
      return [];
    }

    const available: number[] = [];

    for (let i = 1; i <= 8; i++) {
      if (slots.slots.get(i)) {
        available.push(i);
      }
    }

    return available;
  }

  /**
   * Get weapon in specific slot
   */
  public getWeaponInSlot(entity: Entity, slotNumber: number) {
    const slots = entity.components.get('weaponSlot') as WeaponSlotComponent;
    return slots?.slots.get(slotNumber) || null;
  }

  /**
   * Get current weapon
   */
  public getCurrentWeapon(entity: Entity) {
    const slots = entity.components.get('weaponSlot') as WeaponSlotComponent;

    if (!slots) {
      return null;
    }

    return slots.slots.get(slots.currentSlot) || null;
  }

  private beginWeaponSwitch(entity: Entity, targetSlot: number): boolean {
    const slots = entity.components.get('weaponSlot') as WeaponSlotComponent;
    const state = entity.components.get('weaponState') as WeaponStateComponent;

    if (!slots || !state) {
      return false;
    }

    // Cancel reload if cancellable
    if (state.isReloading && state.canCancelReload) {
      state.isReloading = false;
      state.reloadProgress = 0;
    }

    // Store previous slot
    slots.previousSlot = slots.currentSlot;

    // Start switch
    state.isSwitching = true;
    state.switchStartTime = performance.now();
    state.switchProgress = 0;
    slots.switchDuration = this.calculateSwitchDuration(entity, targetSlot);

    state.switchFromWeapon = slots.slots.get(slots.currentSlot)?.config.name;
    state.switchToWeapon = slots.slots.get(targetSlot)?.config.name;

    console.log(`[WEAPON] Switching from slot ${slots.currentSlot} to slot ${targetSlot}`);

    return true;
  }

  private updateSwitchProgress(entity: Entity): void {
    const slots = entity.components.get('weaponSlot') as WeaponSlotComponent;
    const state = entity.components.get('weaponState') as WeaponStateComponent;

    if (!slots || !state) {
      return;
    }

    const elapsed = performance.now() - state.switchStartTime;
    state.switchProgress = Math.min(elapsed / slots.switchDuration, 1.0);

    // Complete switch when progress reaches 100%
    if (state.switchProgress >= 1.0) {
      this.completeWeaponSwitch(entity);
    }
  }

  private completeWeaponSwitch(entity: Entity): void {
    const slots = entity.components.get('weaponSlot') as WeaponSlotComponent;
    const state = entity.components.get('weaponState') as WeaponStateComponent;

    if (!slots || !state) {
      return;
    }

    // Find the target slot from the switch queue or use any switching target
    const queueEntry = this.switchQueue.find((entry) => entry.entity === entity);
    const targetSlot = queueEntry?.targetSlot || slots.currentSlot;

    // Complete the switch
    slots.currentSlot = targetSlot;

    // Reset switch state
    state.isSwitching = false;
    state.switchProgress = 0;
    state.switchFromWeapon = undefined;
    state.switchToWeapon = undefined;

    // Remove from queue
    this.switchQueue = this.switchQueue.filter((entry) => entry.entity !== entity);

    // Update weapon component reference
    const currentWeapon = slots.slots.get(slots.currentSlot);
    if (currentWeapon) {
      entity.components.set('weapon', currentWeapon);
      console.log(`[WEAPON] Switched to ${currentWeapon.config.name}`);
    }
  }

  private calculateSwitchDuration(entity: Entity, targetSlot: number): number {
    // Base switch time
    let duration = 300; // ms

    // Faster switching between adjacent slots
    const slots = entity.components.get('weaponSlot') as WeaponSlotComponent;
    if (slots) {
      const slotDifference = Math.abs(targetSlot - slots.currentSlot);
      if (slotDifference === 1) {
        duration *= 0.8; // 20% faster for adjacent slots
      }
    }

    // Different weapons have different switch speeds
    const currentWeapon = this.getCurrentWeapon(entity);
    const targetWeapon = this.getWeaponInSlot(entity, targetSlot);

    if (currentWeapon?.config.category === 'melee' || targetWeapon?.config.category === 'melee') {
      duration *= 0.7; // Melee weapons switch faster
    }

    if (
      currentWeapon?.config.category === 'explosive' ||
      targetWeapon?.config.category === 'explosive'
    ) {
      duration *= 1.3; // Heavy weapons switch slower
    }

    return duration;
  }

  private findAndSwitchToAvailableWeapon(entity: Entity): void {
    const availableSlots = this.getAvailableSlots(entity);

    if (availableSlots.length > 0) {
      // Prefer lower slot numbers (like DOOM)
      const preferredSlot = Math.min(...availableSlots);
      this.switchToSlot(entity, preferredSlot);
    }
  }

  private processQueue(): void {
    const now = performance.now();

    // Remove expired entries
    this.switchQueue = this.switchQueue.filter(
      (entry) => now - entry.timestamp < this.SWITCH_TIMEOUT
    );
  }
}
