// Translates the raw actor dump produced by scripts/foundry-export-monsters.js
// (Foundry VTT v14 / dnd5e system 5.3.3 actor shape) into gmassisstant's
// Open5e-v2-shaped stat block format (the same shape StatBlockEditor.tsx and
// Open5eSearch.tsx already produce/consume).
//
// Deliberately avoids Foundry's derived roll data (save totals, skill totals,
// the Activities system for attacks/damage) — those are version-fragile and
// not fully documented. Instead this recomputes modifiers/saves/skills from
// raw ability scores + proficiency flags using standard 5e math, the same way
// StatBlockEditor's scoreMod() does client-side.

export interface FoundryRawItem {
  id?: string;
  name: string;
  type: string;
  system: Record<string, unknown>;
}

export interface FoundryRawActor {
  name: string;
  source?: string; // human-readable origin (compendium title or world folder path) — used to place the monster in a library folder
  system: Record<string, unknown>;
  items?: FoundryRawItem[];
  computedAC?: number | null; // live-computed AC captured by the export script, for calc:"default" actors where no raw flat value exists
}

export interface MappedMonster {
  name: string;
  maxHp: number;
  initiativeModifier: number;
  statBlock: string;
  cr: number | null;
  creatureType: string | null;
  folderPath: string[] | null; // e.g. ["Monster Manual", "Fiends"] — null means no folder
}

const ABILITY_KEYS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const;
const FOUNDRY_ABILITY_CODES = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha' } as const;

const SKILL_CODE_TO_KEY: Record<string, string> = {
  ath: 'athletics', acr: 'acrobatics', slt: 'sleight_of_hand', ste: 'stealth',
  arc: 'arcana', his: 'history', inv: 'investigation', nat: 'nature', rel: 'religion',
  ani: 'animal_handling', ins: 'insight', med: 'medicine', prc: 'perception', sur: 'survival',
  dec: 'deception', itm: 'intimidation', prf: 'performance', per: 'persuasion',
};

const SIZE_CODE_TO_NAME: Record<string, string> = {
  tiny: 'Tiny', sm: 'Small', med: 'Medium', lg: 'Large', huge: 'Huge', grg: 'Gargantuan',
};

// Standard 5e hit-die size by creature size category.
const HIT_DIE_BY_SIZE: Record<string, number> = {
  tiny: 4, sm: 6, med: 8, lg: 10, huge: 12, grg: 20,
};

// Foundry doesn't store hit dice count/total raw (only `hd.spent`) — it's
// derived at runtime from HP. Reconstructed here the same way the DMG derives
// it: hp = count * (avgDieRoll + conMod), solved for count.
function computeHitDice(hp: number, conMod: number, sizeCode: string | undefined): string | null {
  if (!hp) return null;
  const dieSize = (sizeCode ? HIT_DIE_BY_SIZE[sizeCode] : undefined) ?? 8;
  const perDie = (dieSize + 1) / 2 + conMod;
  if (perDie <= 0) return null;
  const count = Math.max(1, Math.round(hp / perDie));
  const bonus = count * conMod;
  const bonusStr = bonus !== 0 ? (bonus > 0 ? `+${bonus}` : `${bonus}`) : '';
  return `${count}d${dieSize}${bonusStr}`;
}

const LANGUAGE_CODE_TO_NAME: Record<string, string> = {
  common: 'Common', commonsign: 'Common Sign Language', draconic: 'Draconic',
  dwarvish: 'Dwarvish', elvish: 'Elvish', giant: 'Giant', gnomish: 'Gnomish',
  goblin: 'Goblin', halfling: 'Halfling', orc: 'Orc',
  abyssal: 'Abyssal', celestial: 'Celestial', deep: 'Deep Speech',
  infernal: 'Infernal', primordial: 'Primordial', sylvan: 'Sylvan',
  undercommon: 'Undercommon', druidic: 'Druidic', cant: "Thieves' Cant",
};

// Confirmed against real data: an item's usage cap lives at system.uses.max
// (a string, e.g. "2") with a recovery period ("day", "sr", "lr", ...). Our own
// stat block schema (StatBlockEditor's USAGE_TYPES) only represents "per day"
// limits — short/long-rest recovery isn't representable yet, so those are
// left unset rather than mapped to a misleading type.
function resolveUsageLimits(itemSystem: Record<string, unknown> | undefined): { type: string; param: number } | null {
  const uses = itemSystem?.uses as Record<string, unknown> | undefined;
  const max = uses?.max != null ? Number(uses.max) : NaN;
  if (!Number.isFinite(max) || max <= 0) return null;
  const recovery = (uses?.recovery as Record<string, unknown>[] | undefined)?.[0];
  if (recovery?.period === 'day') return { type: 'PER_DAY', param: max };
  return null;
}

function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

function proficiencyBonusForCr(cr: number): number {
  if (cr >= 29) return 9;
  if (cr >= 25) return 8;
  if (cr >= 21) return 7;
  if (cr >= 17) return 6;
  if (cr >= 13) return 5;
  if (cr >= 9) return 4;
  if (cr >= 5) return 3;
  return 2;
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// dnd5e 5.x description text is full of Foundry "enricher" markup — [[lookup @path]],
// [[/r formula]], [[/damage ...]], &Reference[...] — that only resolves to readable
// text when rendered live inside Foundry. This does a best-effort offline resolution
// using the same item's raw `system.activities` data (confirmed against a real export;
// note the enricher's dotted @path often doesn't match the raw field name 1:1 — e.g.
// "@save.dc.value" is actually stored as `save.dc.formula`, presumably because Foundry
// evaluates these against *prepared* roll data, not the raw schema). Anything left
// unresolved is stripped rather than left as raw bracket syntax.
const ABILITY_CODE_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(FOUNDRY_ABILITY_CODES).map(([key, code]) => [code, key])
);

// Some bonuses (e.g. an aboleth's initiative bonus, "@prof * 2") are stored as
// roll-data formula strings rather than numbers. Substitutes the handful of
// tokens we can resolve offline, then evaluates the result only after
// verifying it contains nothing but arithmetic — never evals attacker-supplied
// text directly.
function evalSimpleFormula(formula: string, mods: Record<string, number>, profBonus: number): number {
  const substituted = formula
    .replace(/@prof(iciency)?/gi, String(profBonus))
    .replace(/@abilities\.(str|dex|con|int|wis|cha)\.mod/gi, (_m, code: string) => String(mods[ABILITY_CODE_TO_KEY[code.toLowerCase()]] ?? 0));
  if (!/^[\d+\-*/(). ]+$/.test(substituted)) return 0;
  try {
    const result = Function(`"use strict"; return (${substituted});`)();
    return typeof result === 'number' && Number.isFinite(result) ? Math.round(result) : 0;
  } catch {
    return 0;
  }
}

interface LookupContext {
  mods: Record<string, number>;
  profBonus: number;
}

// A save DC is either a fixed number (`dc.formula`) or "calculate from this
// ability" (`dc.calculation` holding an ability code) — confirmed against real
// data: Aboleth's Dominate Mind uses a fixed formula ("16"), Abominable Yeti's
// Chilling Gaze uses calculation ("con") with an empty formula.
function resolveSaveDc(activity: Record<string, any> | undefined, ctx: LookupContext): number | null {
  const dc = activity?.save?.dc;
  if (!dc) return null;
  if (dc.calculation) {
    const abilityKey = ABILITY_CODE_TO_KEY[dc.calculation];
    return 8 + ctx.profBonus + (abilityKey ? ctx.mods[abilityKey] ?? 0 : 0);
  }
  if (dc.formula) {
    const n = Number(dc.formula);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const LOOKUP_FIELD_MAP: Record<string, (a: Record<string, any>, ctx: LookupContext) => unknown> = {
  'save.dc.value': (a, ctx) => resolveSaveDc(a, ctx),
  'range.value': (a) => a.range?.value,
  'range.units': (a) => a.range?.units,
  'target.template.size': (a) => a.target?.template?.size,
  'target.template.units': (a) => a.target?.template?.units,
  'target.affects.type': (a) => a.target?.affects?.type,
  'target.affects.special': (a) => a.target?.affects?.special,
  'damage.onSave': (a) => a.damage?.onSave,
};

function formatDamagePart(part: Record<string, any>): string | null {
  if (part?.custom?.enabled && part.custom.formula) return String(part.custom.formula);
  if (part?.number != null && part?.denomination != null) {
    const bonus = part.bonus ? `+${part.bonus}` : '';
    const types = part.types?.length ? ` ${part.types.join('/')}` : '';
    return `${part.number}d${part.denomination}${bonus}${types}`;
  }
  return null;
}

// A weapon's attack ability: explicit on the attack activity if set, else STR
// unless the weapon is finesse (then whichever of STR/DEX is higher) — standard
// 5e weapon-attack rules, since NPCs' innate weapons rarely set this explicitly.
function weaponAbilityKey(attackActivity: Record<string, any> | undefined, itemSystem: Record<string, any> | undefined, ctx: LookupContext): string {
  const explicit = attackActivity?.attack?.ability;
  if (explicit && ABILITY_CODE_TO_KEY[explicit]) return ABILITY_CODE_TO_KEY[explicit];
  const isFinesse = (itemSystem?.properties as string[] | undefined)?.includes('fin');
  return isFinesse ? (ctx.mods.dexterity > ctx.mods.strength ? 'dexterity' : 'strength') : 'strength';
}

function findAttackActivity(activities: Record<string, any> | undefined): Record<string, any> | undefined {
  return activities && (Object.values(activities).find((a: any) => a?.type === 'attack') as Record<string, any> | undefined);
}

function resolveAttackBonus(activities: Record<string, any> | undefined, itemSystem: Record<string, any> | undefined, ctx: LookupContext): number {
  const abilityKey = weaponAbilityKey(findAttackActivity(activities), itemSystem, ctx);
  return (ctx.mods[abilityKey] ?? 0) + ctx.profBonus;
}

// A weapon attack's damage (from its attack activity's damage.parts, or the item's
// own system.damage.base if the activity doesn't carry parts — confirmed both
// occur depending on the content pack) always includes the attack ability modifier
// in real play, unlike a save-based ability's damage.parts (breath weapons, gaze
// attacks), which is already the full value with no separate ability mod to add.
function resolveDamageFormula(activities: Record<string, any> | undefined, itemSystem: Record<string, any> | undefined, ctx: LookupContext): string | null {
  const attackActivity = findAttackActivity(activities);
  if (attackActivity) {
    const parts = attackActivity.damage?.parts;
    const source = Array.isArray(parts) && parts.length > 0 ? parts[0] : itemSystem?.damage?.base;
    if (source?.custom?.enabled && source.custom.formula) return String(source.custom.formula);
    if (source?.number != null && source?.denomination != null) {
      const abilityMod = ctx.mods[weaponAbilityKey(attackActivity, itemSystem, ctx)] ?? 0;
      const bonus = abilityMod ? (abilityMod >= 0 ? `+${abilityMod}` : `${abilityMod}`) : '';
      const types = source.types?.length ? ` ${source.types.join('/')}` : '';
      return `${source.number}d${source.denomination}${bonus}${types}`;
    }
  }

  if (activities) {
    for (const activity of Object.values(activities)) {
      const parts = activity?.damage?.parts;
      if (!Array.isArray(parts) || parts.length === 0) continue;
      const formulas = parts.map(formatDamagePart).filter((f: string | null): f is string => !!f);
      if (formulas.length) return formulas.join(' + ');
    }
  }
  return null;
}

function humanizeItemSlug(slug: string): string {
  // Fallback for when the id isn't in itemsById — e.g. exports made before the
  // export script started including weapon items, or a reference to an item this
  // export didn't capture at all. Genuine Foundry ids are 16 random alphanumeric
  // chars (nothing to humanize); some content packs instead use readable slugs
  // like "mmTentacle000000" — only attempt those.
  const cleaned = slug.replace(/^mm/, '').replace(/\d+$/, '');
  if (/^[A-Z][a-zA-Z]*$/.test(cleaned)) {
    return cleaned.replace(/([a-z])([A-Z])/g, '$1 $2');
  }
  return 'an attack';
}

function cleanEnrichers(
  html: string,
  monsterName: string,
  activities: Record<string, any> | undefined,
  itemSystem: Record<string, any> | undefined,
  itemsById: Map<string, string>,
  ctx: LookupContext,
): string {
  let text = html;

  text = text.replace(/\[\[lookup @name(?:\s+(lowercase|capitalize))?(?:\s+activity=\S+?)?\]\]/g, (_m, mod) =>
    mod === 'lowercase' ? monsterName.toLowerCase() : monsterName);

  text = text.replace(/\[\[\/r ([^\]]+?)\]\](?:\{([^}]+)\})?/g, (_m, formula, label) => label ?? formula);

  text = text.replace(/\[\[\/attack(?:\s+\w+)*\]\]/g, () => {
    const bonus = resolveAttackBonus(activities, itemSystem, ctx);
    return `${bonus >= 0 ? '+' : ''}${bonus} to hit`;
  });

  text = text.replace(/\[\[\/(damage|healing)(?:\s+\w+)*\]\]/g, (_m, kind) => resolveDamageFormula(activities, itemSystem, ctx) ?? kind);

  text = text.replace(/&(?:amp;)?Reference\[([^\s\]]+)[^\]]*\]/g, (_m, name) => name);

  text = text.replace(/\[\[lookup @([\w.]+)(?:\s+(lowercase|capitalize))?(?:\s+activity=(\S+?))?\]\]/g, (_m, path, mod, activityId) => {
    const activity = activityId ? activities?.[activityId] : undefined;
    const getter = LOOKUP_FIELD_MAP[path];
    const value = activity && getter ? getter(activity, ctx) : undefined;
    if (value == null || value === '') return '';
    const str = String(value);
    if (mod === 'lowercase') return str.toLowerCase();
    if (mod === 'capitalize') return capitalize(str);
    return str;
  });

  text = text.replace(/\[\[\/item \.?(\S+?)\]\]/g, (_m, slug) => itemsById.get(slug) ?? humanizeItemSlug(slug));

  // Catch-all for any enricher syntax not specifically handled above.
  text = text.replace(/\[\[[^\]]*\]\]/g, '');
  text = text.replace(/&(?:amp;)?Reference\[[^\]]*\]/g, '');

  return text;
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  // Several numeric fields (movement, damage/hd values in some content packs)
  // are stored as strings rather than numbers — confirmed against real data.
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function mapFoundryActorToMonster(raw: FoundryRawActor): MappedMonster {
  const sys = raw.system ?? {};
  const abilities = (sys.abilities as Record<string, { value?: number; proficient?: number }>) ?? {};
  const attributes = (sys.attributes as Record<string, unknown>) ?? {};
  const traits = (sys.traits as Record<string, unknown>) ?? {};
  const details = (sys.details as Record<string, unknown>) ?? {};
  const skills = (sys.skills as Record<string, { value?: number; ability?: string }>) ?? {};

  const cr = typeof details.cr === 'number' ? details.cr : null;
  const profBonus = proficiencyBonusForCr(cr ?? 0);

  const scores: Record<string, number> = {};
  const mods: Record<string, number> = {};
  for (const key of ABILITY_KEYS) {
    const code = FOUNDRY_ABILITY_CODES[key];
    const value = num(abilities[code]?.value, 10);
    scores[key] = value;
    mods[key] = abilityMod(value);
  }

  const saves: Record<string, number> = {};
  for (const key of ABILITY_KEYS) {
    const code = FOUNDRY_ABILITY_CODES[key];
    const proficient = abilities[code]?.proficient ? 1 : 0;
    saves[key] = mods[key] + (proficient ? profBonus : 0);
  }

  const skillBonuses: Record<string, number> = {};
  for (const [code, key] of Object.entries(SKILL_CODE_TO_KEY)) {
    const skill = skills[code];
    if (!skill || !skill.value) continue; // 0 = not proficient/no bonus worth recording
    const ability = (skill.ability ?? 'dexterity') as string;
    const abilityKey = (Object.entries(FOUNDRY_ABILITY_CODES).find(([, c]) => c === ability)?.[0]) ?? 'dexterity';
    skillBonuses[key] = mods[abilityKey] + Math.round(profBonus * skill.value);
  }

  const perceptionBonus = skillBonuses.perception ?? mods.wisdom;
  const passivePerception = 10 + perceptionBonus;

  // Movement values are stored as strings (e.g. "10"), not numbers — confirmed
  // against real data.
  const movement = (attributes.movement as Record<string, unknown>) ?? {};
  const speed: Record<string, unknown> = {};
  if (movement.walk) speed.walk = num(movement.walk);
  if (movement.fly) speed.fly = num(movement.fly);
  if (movement.swim) speed.swim = num(movement.swim);
  if (movement.climb) speed.climb = num(movement.climb);
  if (movement.burrow) speed.burrow = num(movement.burrow);
  if (Object.keys(speed).length) speed.unit = 'feet';

  const senseRanges = ((attributes.senses as Record<string, unknown>)?.ranges as Record<string, number>) ?? {};

  const dr = ((traits.dr as Record<string, unknown>)?.value as string[]) ?? [];
  const di = ((traits.di as Record<string, unknown>)?.value as string[]) ?? [];
  const dv = ((traits.dv as Record<string, unknown>)?.value as string[]) ?? [];
  const ci = ((traits.ci as Record<string, unknown>)?.value as string[]) ?? [];
  const resistancesAndImmunities: Record<string, string> = {};
  if (dr.length) resistancesAndImmunities.damage_resistances_display = dr.join(', ');
  if (di.length) resistancesAndImmunities.damage_immunities_display = di.join(', ');
  if (dv.length) resistancesAndImmunities.damage_vulnerabilities_display = dv.join(', ');
  if (ci.length) resistancesAndImmunities.condition_immunities_display = ci.join(', ');

  // Language values are internal codes (e.g. "deep" for Deep Speech), and
  // telepathy is often recorded as unstructured text in `languages.custom`
  // (e.g. "telepathy 120 ft.") rather than the structured communication field —
  // confirmed against real data.
  const languagesRaw = traits.languages as Record<string, unknown> | undefined;
  const languageCodes = (languagesRaw?.value as string[]) ?? [];
  const languageNames = languageCodes.map((code) => LANGUAGE_CODE_TO_NAME[code] ?? capitalize(code));
  const customLanguageText = languagesRaw?.custom as string | undefined;
  const languageValues = [...languageNames, ...(customLanguageText ? [customLanguageText] : [])];

  const rawCreatureType = (details.type as Record<string, unknown>)?.value as string | undefined;
  const creatureType = rawCreatureType ? capitalize(rawCreatureType) : null;

  const sizeCode = traits.size as string | undefined;
  const sizeName = sizeCode ? SIZE_CODE_TO_NAME[sizeCode] ?? capitalize(sizeCode) : undefined;

  const hp = attributes.hp as Record<string, unknown> | undefined;
  const ac = attributes.ac as Record<string, unknown> | undefined;
  const hpValue = hp?.max != null ? num(hp.max) : 0;
  // hp.formula holds the authored hit-dice string directly (e.g. "20d10 + 40")
  // — confirmed present on 551/559 monsters, no need to reconstruct it.
  const hpFormula = (hp?.formula as string | undefined)?.trim();
  const hitDice = hpFormula || computeHitDice(hpValue, mods.constitution, sizeCode);

  // Initiative = base ability mod (dex unless overridden) + any bonus formula
  // (e.g. an aboleth's "@prof * 2") — both confirmed present in real data;
  // `attributes.init.value`-style totals are derived-only, never stored raw.
  const initRaw = attributes.init as Record<string, unknown> | undefined;
  const initAbilityKey = initRaw?.ability ? ABILITY_CODE_TO_KEY[initRaw.ability as string] : undefined;
  const initBonusFormula = initRaw?.bonus as string | undefined;
  const initiativeModifier = (mods[initAbilityKey ?? 'dexterity'] ?? 0) + (initBonusFormula ? evalSimpleFormula(initBonusFormula, mods, profBonus) : 0);

  // armor_detail: "natural armor" is directly knowable from calc mode; for
  // calc:"default" (armor-derived AC) the equipped armor item's own name is
  // used when the export captured it (needs 'equipment' in the export
  // script's ITEM_TYPES — falls back to blank on older exports).
  const equippedArmor = (raw.items ?? []).find((i) => i.type === 'equipment' && (i.system as any)?.type?.value === 'armor' && (i.system as any)?.equipped);
  const armorDetail = ac?.calc === 'natural' ? 'natural armor' : equippedArmor ? equippedArmor.name.toLowerCase() : undefined;

  // Real per-monster counts — confirmed raw (not derived) on the actor itself,
  // correctly 0 for non-legendary monsters. `resources.lair.value` marks
  // whether this monster can take lair actions / gets bonus legendary uses
  // while in its lair (e.g. Aboleth: "Legendary Resistance (3/Day, or 4/Day
  // in Lair)").
  const resources = sys.resources as Record<string, any> | undefined;
  const legactMax = resources?.legact?.max;
  const legresMax = resources?.legres?.max;
  const hasLair = resources?.lair?.value === true;

  const itemsById = new Map<string, string>();
  for (const item of raw.items ?? []) {
    if (item.id) itemsById.set(item.id, item.name);
  }

  const lookupCtx: LookupContext = { mods, profBonus };

  const traitsOut: { name: string; desc: string }[] = [];
  const actionsOut: { name: string; desc: string; action_type: string; usage_limits?: { type: string; param: number } }[] = [];
  for (const item of raw.items ?? []) {
    const rawDesc = (item.system?.description as Record<string, unknown> | undefined)?.value as string ?? '';
    const activities = item.system?.activities as Record<string, any> | undefined;
    const desc = stripHtml(cleanEnrichers(rawDesc, raw.name, activities, item.system, itemsById, lookupCtx));

    // Activation timing lives on each activity (system.activities[id].activation.type),
    // not on the item directly — confirmed against real export data. Most items have
    // exactly one relevant activity; take the first.
    const primaryActivity = activities ? Object.values(activities)[0] : undefined;
    const activationType = (primaryActivity?.activation?.type as string | undefined) ?? '';
    const featType = (item.system?.type as Record<string, unknown> | undefined)?.value as string | undefined;

    // Some passive traits (Eldritch Restoration, Legendary Resistance) still
    // carry an "action"-ish activation for macro/roll-button purposes, but are
    // explicitly tagged `system.properties: ["trait"]` — confirmed against
    // real data (574/2436 items across the library) as the reliable signal,
    // overriding activation type. "special" activation (Legendary Resistance's
    // condition: "fails a saving throw") is a secondary reactive-trigger signal.
    const isTraitTagged = ((item.system?.properties as string[] | undefined) ?? []).includes('trait');
    if (!activationType || activationType === 'none' || activationType === 'special' || isTraitTagged) {
      // Annotate Legendary Resistance with its real per-day count (and the lair
      // bonus, when applicable) — matches the naming convention the run page's
      // widget already parses a count out of, e.g. "Legendary Resistance (3/Day)".
      let displayName = item.name;
      if (/legendary resistance/i.test(item.name) && typeof legresMax === 'number' && legresMax > 0) {
        displayName = hasLair
          ? `${item.name} (${legresMax}/Day, or ${legresMax + 1}/Day in Lair)`
          : `${item.name} (${legresMax}/Day)`;
      }
      traitsOut.push({ name: displayName, desc });
      continue;
    }
    let actionType = 'ACTION';
    if (activationType === 'bonus') actionType = 'BONUS_ACTION';
    else if (activationType === 'reaction') actionType = 'REACTION';
    else if (activationType === 'legendary' || featType === 'legendary') actionType = 'LEGENDARY_ACTION';
    const usageLimits = resolveUsageLimits(item.system);
    actionsOut.push({ name: item.name, desc, action_type: actionType, ...(usageLimits ? { usage_limits: usageLimits } : {}) });
  }

  const statBlockObj: Record<string, unknown> = {
    name: raw.name,
    ability_scores: scores,
    modifiers: mods,
    saving_throws: saves,
  };
  if (sizeName) statBlockObj.size = { name: sizeName };
  if (creatureType) statBlockObj.type = { name: creatureType };
  if (cr != null) statBlockObj.challenge_rating = cr;
  // `ac.value` is a Foundry-derived/computed field, never present in a raw
  // actor.toObject() dump. calc:"natural"/"flat" NPCs store the real value at
  // `ac.flat`; calc:"default" NPCs (AC from equipped armor + dex) don't store
  // a raw value at all — the export script separately captures the live
  // computed value as `computedAC` for that case (confirmed against real data).
  const acFlat = ac?.flat ?? ac?.value ?? raw.computedAC;
  if (acFlat != null) statBlockObj.armor_class = num(acFlat);
  if (armorDetail) statBlockObj.armor_detail = armorDetail;
  if (hpValue) statBlockObj.hit_points = hpValue;
  if (hitDice) statBlockObj.hit_dice = hitDice;
  statBlockObj.initiative_bonus = initiativeModifier;
  if (typeof legactMax === 'number' && legactMax > 0) statBlockObj.legendary_actions_max = legactMax;
  if (typeof legresMax === 'number' && legresMax > 0) statBlockObj.legendary_resistance = legresMax;
  if (hasLair) statBlockObj.has_lair = true;
  if (Object.keys(speed).length) statBlockObj.speed = speed;
  if (Object.keys(skillBonuses).length) statBlockObj.skill_bonuses = skillBonuses;
  if (senseRanges.darkvision) statBlockObj.darkvision_range = senseRanges.darkvision;
  if (senseRanges.blindsight) statBlockObj.blindsight_range = senseRanges.blindsight;
  if (senseRanges.tremorsense) statBlockObj.tremorsense_range = senseRanges.tremorsense;
  if (senseRanges.truesight) statBlockObj.truesight_range = senseRanges.truesight;
  statBlockObj.passive_perception = passivePerception;
  if (Object.keys(resistancesAndImmunities).length) statBlockObj.resistances_and_immunities = resistancesAndImmunities;
  if (languageValues.length) statBlockObj.languages = { as_string: languageValues.join(', ') };
  if (traitsOut.length) statBlockObj.traits = traitsOut;
  if (actionsOut.length) statBlockObj.actions = actionsOut;

  const folderPath = raw.source && raw.source !== 'world' ? raw.source.split(' › ') : null;

  return {
    name: raw.name,
    maxHp: hpValue,
    initiativeModifier,
    statBlock: JSON.stringify(statBlockObj),
    cr,
    creatureType,
    folderPath,
  };
}
