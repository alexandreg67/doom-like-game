import type { Entity, System } from '../types';

export class ECS {
  private entities: Map<string, Entity> = new Map();
  private systems: System[] = [];

  createEntity(id: string): Entity {
    const entity: Entity = {
      id,
      components: new Map(),
    };
    this.entities.set(id, entity);
    return entity;
  }

  addSystem(system: System): void {
    this.systems.push(system);
  }

  update(deltaTime: number): void {
    const entityArray = Array.from(this.entities.values());
    for (const system of this.systems) {
      system.update(entityArray, deltaTime);
    }
  }
}
