export const CONDITIONS = [
  { name: 'Blinded',       icon: '🙈' },
  { name: 'Bloodied',      icon: '🩸' },
  { name: 'Charmed',       icon: '💜' },
  { name: 'Dazed',         icon: '💫' },
  { name: 'Deafened',      icon: '🔇' },
  { name: 'Exhaustion',    icon: '😩', hasLevel: true as const },
  { name: 'Frightened',    icon: '😨' },
  { name: 'Grappled',      icon: '⛓️' },
  { name: 'Incapacitated', icon: '❌' },
  { name: 'Invisible',     icon: '👻' },
  { name: 'Paralyzed',     icon: '⚡' },
  { name: 'Petrified',     icon: '🪨' },
  { name: 'Poisoned',      icon: '🤢' },
  { name: 'Prone',         icon: '⬇️' },
  { name: 'Restrained',    icon: '🔗' },
  { name: 'Stunned',       icon: '🌀' },
  { name: 'Unconscious',   icon: '💤' },
] as const;

export type ConditionDef = typeof CONDITIONS[number];

export function conditionIcon(condition: string): string {
  const base = condition.replace(/\s+\d+$/, '');
  return CONDITIONS.find((c) => c.name === base)?.icon ?? '❓';
}
