export const CONDITIONS = [
  { name: 'Advantage',     icon: '🎯', description: 'Attacks against this creature have Advantage.' },
  { name: 'Blinded',       icon: '🙈', description: "Can't see; auto-fail sight-based checks. Attacks against you have Advantage; your attacks have Disadvantage." },
  { name: 'Bloodied',      icon: '🩸', description: 'A creature is Bloodied while it has half its Hit Points or fewer remaining.' },
  { name: 'Charmed',       icon: '💜', description: "Can't attack the charmer or target them with damaging effects. The charmer has Advantage on social interaction checks with you." },
  { name: 'Concentrating', icon: '🔮', description: "Maintaining concentration on a spell. Lost if you cast another concentration spell, take damage and fail a Constitution save (DC 10 or half damage taken), or are incapacitated or killed." },
  { name: 'Dazed',         icon: '💫', description: "Can only do one of the following on your turn: move, use an action, or use a bonus action. If you become dazed during your turn, your turn ends." },
  { name: 'Deafened',      icon: '🔇', description: "Can't hear; auto-fail hearing-based checks." },
  { name: 'Disadvantage',  icon: '🌫️', description: 'Attacks against this creature have Disadvantage.' },
  { name: 'Exhaustion',    icon: '😩', hasLevel: true as const, description: 'Each level: −2 to all d20 tests and −5 ft. speed (cumulative). Die at level 6. Long rest removes 1 level.' },
  { name: 'Frightened',    icon: '😨', description: "Disadvantage on attacks and ability checks while the source of fear is visible. Can't willingly move closer to the source." },
  { name: 'Grappled',      icon: '⛓️', description: 'Speed becomes 0. Disadvantage on attacks against creatures other than the grappler.' },
  { name: 'Incapacitated', icon: '❌', description: "Can't take actions, bonus actions, or reactions. Can't speak. Concentration breaks. Disadvantage on Initiative if surprised." },
  { name: 'Invisible',     icon: '👻', description: "Concealed from effects requiring sight. Your attacks have Advantage; attacks against you have Disadvantage. Advantage on Initiative." },
  { name: 'Paralyzed',     icon: '⚡', description: "Incapacitated; speed 0. Auto-fail Strength and Dexterity saves. Attacks against you have Advantage. Hits within 5 ft. are Critical Hits." },
  { name: 'Petrified',     icon: '🪨', description: "Incapacitated; speed 0; weight ×10. Attacks against you have Advantage. Auto-fail Strength and Dexterity saves. Resistance to all damage; immune to Poison." },
  { name: 'Poisoned',      icon: '🤢', description: 'Disadvantage on attack rolls and ability checks.' },
  { name: 'Prone',         icon: '⬇️', description: "Can only crawl or spend half speed to stand. Disadvantage on your attacks. Attacks against you have Advantage within 5 ft., Disadvantage beyond." },
  { name: 'Restrained',    icon: '🔗', description: 'Speed becomes 0. Attacks against you have Advantage; your attacks have Disadvantage. Disadvantage on Dexterity saves.' },
  { name: 'Stunned',       icon: '🌀', description: "Incapacitated. Auto-fail Strength and Dexterity saves. Attacks against you have Advantage." },
  { name: 'Unconscious',   icon: '💤', description: "Incapacitated and Prone; drop held items; speed 0. Auto-fail Strength and Dexterity saves. Attacks have Advantage; hits within 5 ft. are Critical Hits. Unaware of surroundings." },
] as const;

export type ConditionDef = typeof CONDITIONS[number];

export function conditionIcon(condition: string): string {
  const base = condition.replace(/\s+\d+$/, '');
  return CONDITIONS.find((c) => c.name === base)?.icon ?? '❓';
}

export function conditionDescription(condition: string): string {
  const base = condition.replace(/\s+\d+$/, '');
  return CONDITIONS.find((c) => c.name === base)?.description ?? '';
}
