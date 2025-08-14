import type { Sound } from '../types';

export class AudioManager {
  private sounds: Map<string, Sound> = new Map();

  addSound(sound: Sound): void {
    this.sounds.set(sound.name, sound);
  }

  playSound(_name: string): void {
    // TODO: Implement sound playback
  }
}
