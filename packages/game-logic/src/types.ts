export interface Component {
  id: string;
}

export interface Entity {
  id: string;
  components: Map<string, Component>;
}

export interface System {
  update(entities: Entity[], deltaTime: number): void;
}
