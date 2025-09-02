// Re-export all types for easy importing
export * from './enemy-types';

// Additional utility types
export type EnemyComponentType =
  | 'enemyIdentity'
  | 'enemyState'
  | 'enemyStats'
  | 'enemyAI'
  | 'enemyMovement'
  | 'enemyAttack'
  | 'enemyRenderer'
  | 'enemyAudio';

/**
 * Type guard to check if a component is an enemy component
 */
export function isEnemyComponent(componentId: string): componentId is EnemyComponentType {
  const enemyComponents: EnemyComponentType[] = [
    'enemyIdentity',
    'enemyState',
    'enemyStats',
    'enemyAI',
    'enemyMovement',
    'enemyAttack',
    'enemyRenderer',
    'enemyAudio',
  ];
  return enemyComponents.includes(componentId as EnemyComponentType);
}
