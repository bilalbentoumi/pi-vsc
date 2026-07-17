import { ThinkingLevel } from '../../../shared/protocol';

export const THINKING_LEVELS: ThinkingLevel[] = [
  'off',
  'low',
  'medium',
  'high',
];

export const LEVEL_LABELS: Record<ThinkingLevel, string> = {
  off: 'Off',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};
