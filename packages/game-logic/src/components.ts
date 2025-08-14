import type { Component } from './types';

export class Transform implements Component {
  id = 'transform';
  constructor(
    public x = 0,
    public y = 0,
    public z = 0
  ) {}
}

export class Velocity implements Component {
  id = 'velocity';
  constructor(
    public x = 0,
    public y = 0,
    public z = 0
  ) {}
}

export class Health implements Component {
  id = 'health';
  constructor(
    public current = 100,
    public max = 100
  ) {}
}
