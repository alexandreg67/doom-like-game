import type { Entity, System } from './types';

export class MovementSystem implements System {
  update(_entities: Entity[], _deltaTime: number): void {
    // TODO: Implement movement logic
  }
}

export class RenderSystem implements System {
  update(_entities: Entity[], _deltaTime: number): void {
    // TODO: Implement render logic
  }
}
