import { useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActionDraft {
  name: string;
  desc: string;
  action_type: string;
  legendary_action_cost: string;
  usage_type: string;
  usage_param: string;
}

interface TraitDraft {
  name: string;
  desc: string;
}

interface Draft {
  name: string;
  sizeName: string;
  typeName: string;
  alignment: string;
  cr: string;
  ac: string;
  acDetail: string;
  hp: string;
  hitDice: string;
  speedWalk: string;
  speedFly: string;
  speedSwim: string;
  speedClimb: string;
  speedBurrow: string;
  str: string; dex: string; con: string;
  int_: string; wis: string; cha: string;
  savStr: string; savDex: string; savCon: string;
  savInt: string; savWis: string; savCha: string;
  skills: Record<string, string>;
  darkvision: string;
  blindsight: string;
  tremorsense: string;
  truesight: string;
  passivePerception: string;
  damageResistances: string;
  damageImmunities: string;
  damageVulnerabilities: string;
  conditionImmunities: string;
  languages: string;
  traits: TraitDraft[];
  actions: ActionDraft[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SKILLS = [
  { key: 'athletics', label: 'Athletics', ability: 'STR' },
  { key: 'acrobatics', label: 'Acrobatics', ability: 'DEX' },
  { key: 'sleight_of_hand', label: 'Sleight of Hand', ability: 'DEX' },
  { key: 'stealth', label: 'Stealth', ability: 'DEX' },
  { key: 'arcana', label: 'Arcana', ability: 'INT' },
  { key: 'history', label: 'History', ability: 'INT' },
  { key: 'investigation', label: 'Investigation', ability: 'INT' },
  { key: 'nature', label: 'Nature', ability: 'INT' },
  { key: 'religion', label: 'Religion', ability: 'INT' },
  { key: 'animal_handling', label: 'Animal Handling', ability: 'WIS' },
  { key: 'insight', label: 'Insight', ability: 'WIS' },
  { key: 'medicine', label: 'Medicine', ability: 'WIS' },
  { key: 'perception', label: 'Perception', ability: 'WIS' },
  { key: 'survival', label: 'Survival', ability: 'WIS' },
  { key: 'deception', label: 'Deception', ability: 'CHA' },
  { key: 'intimidation', label: 'Intimidation', ability: 'CHA' },
  { key: 'performance', label: 'Performance', ability: 'CHA' },
  { key: 'persuasion', label: 'Persuasion', ability: 'CHA' },
] as const;

const ACTION_TYPES = [
  { value: 'ACTION', label: 'Action' },
  { value: 'BONUS_ACTION', label: 'Bonus Action' },
  { value: 'REACTION', label: 'Reaction' },
  { value: 'LEGENDARY_ACTION', label: 'Legendary Action' },
] as const;

const USAGE_TYPES = [
  { value: '', label: 'At will' },
  { value: 'RECHARGE_ON_ROLL', label: 'Recharge (roll)' },
  { value: 'PER_DAY', label: 'Per Day' },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreMod(scoreStr: string): number {
  return Math.floor(((parseInt(scoreStr) || 10) - 10) / 2);
}

function fmod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

function initDraft(jsonStr?: string | null): Draft {
  let sb: Record<string, unknown> = {};
  if (jsonStr) { try { sb = JSON.parse(jsonStr); } catch {} }

  const scores = (sb.ability_scores as Record<string, number>) ?? {};
  const saves = (sb.saving_throws as Record<string, number>) ?? {};
  const speedMap = (sb.speed as Record<string, unknown>) ?? {};
  const sbSkills = (sb.skill_bonuses as Record<string, number>) ?? {};
  const ri = (sb.resistances_and_immunities as Record<string, string>) ?? {};
  const rawActions = (sb.actions as Array<Record<string, unknown>>) ?? [];
  const rawTraits = (sb.traits as Array<Record<string, string>>) ?? [];

  const baseMods = {
    strength: Math.floor(((scores.strength ?? 10) - 10) / 2),
    dexterity: Math.floor(((scores.dexterity ?? 10) - 10) / 2),
    constitution: Math.floor(((scores.constitution ?? 10) - 10) / 2),
    intelligence: Math.floor(((scores.intelligence ?? 10) - 10) / 2),
    wisdom: Math.floor(((scores.wisdom ?? 10) - 10) / 2),
    charisma: Math.floor(((scores.charisma ?? 10) - 10) / 2),
  };

  function savField(key: keyof typeof baseMods): string {
    const v = saves[key];
    if (v == null) return '';
    return v !== baseMods[key] ? String(v) : '';
  }

  const skillsInit: Record<string, string> = {};
  for (const sk of SKILLS) {
    const v = sbSkills[sk.key];
    skillsInit[sk.key] = v != null ? String(v) : '';
  }

  const actionsInit: ActionDraft[] = rawActions.map((a) => ({
    name: String(a.name ?? ''),
    desc: String(a.desc ?? ''),
    action_type: String(a.action_type ?? 'ACTION'),
    legendary_action_cost: a.legendary_action_cost ? String(a.legendary_action_cost) : '',
    usage_type: String((a.usage_limits as Record<string, unknown>)?.type ?? ''),
    usage_param: (a.usage_limits as Record<string, unknown>)?.param != null
      ? String((a.usage_limits as Record<string, unknown>).param) : '',
  }));

  const traitsInit: TraitDraft[] = rawTraits.map((t) => ({
    name: String(t.name ?? ''),
    desc: String(t.desc ?? ''),
  }));

  return {
    name: String(sb.name ?? ''),
    sizeName: String((sb.size as Record<string, string>)?.name ?? ''),
    typeName: String((sb.type as Record<string, string>)?.name ?? ''),
    alignment: String(sb.alignment ?? ''),
    cr: sb.challenge_rating != null ? String(sb.challenge_rating) : '',
    ac: sb.armor_class != null ? String(sb.armor_class) : '',
    acDetail: String(sb.armor_detail ?? ''),
    hp: sb.hit_points != null ? String(sb.hit_points) : '',
    hitDice: String(sb.hit_dice ?? ''),
    speedWalk: speedMap.walk != null ? String(speedMap.walk) : '',
    speedFly: speedMap.fly != null ? String(speedMap.fly) : '',
    speedSwim: speedMap.swim != null ? String(speedMap.swim) : '',
    speedClimb: speedMap.climb != null ? String(speedMap.climb) : '',
    speedBurrow: speedMap.burrow != null ? String(speedMap.burrow) : '',
    str: scores.strength != null ? String(scores.strength) : '10',
    dex: scores.dexterity != null ? String(scores.dexterity) : '10',
    con: scores.constitution != null ? String(scores.constitution) : '10',
    int_: scores.intelligence != null ? String(scores.intelligence) : '10',
    wis: scores.wisdom != null ? String(scores.wisdom) : '10',
    cha: scores.charisma != null ? String(scores.charisma) : '10',
    savStr: savField('strength'),
    savDex: savField('dexterity'),
    savCon: savField('constitution'),
    savInt: savField('intelligence'),
    savWis: savField('wisdom'),
    savCha: savField('charisma'),
    skills: skillsInit,
    darkvision: sb.darkvision_range != null ? String(sb.darkvision_range) : '',
    blindsight: sb.blindsight_range != null ? String(sb.blindsight_range) : '',
    tremorsense: sb.tremorsense_range != null ? String(sb.tremorsense_range) : '',
    truesight: sb.truesight_range != null ? String(sb.truesight_range) : '',
    passivePerception: sb.passive_perception != null ? String(sb.passive_perception) : '',
    damageResistances: ri.damage_resistances_display ?? '',
    damageImmunities: ri.damage_immunities_display ?? '',
    damageVulnerabilities: ri.damage_vulnerabilities_display ?? '',
    conditionImmunities: ri.condition_immunities_display ?? '',
    languages: String((sb.languages as Record<string, string>)?.as_string ?? ''),
    traits: traitsInit.length ? traitsInit : [{ name: '', desc: '' }],
    actions: actionsInit.length ? actionsInit
      : [{ name: '', desc: '', action_type: 'ACTION', legendary_action_cost: '', usage_type: '', usage_param: '' }],
  };
}

function buildOutput(d: Draft): string {
  const abilityKeys = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const;
  const scoreVals = [d.str, d.dex, d.con, d.int_, d.wis, d.cha].map((s) => parseInt(s) || 10);
  const ability_scores = Object.fromEntries(abilityKeys.map((k, i) => [k, scoreVals[i]]));
  const baseMods = scoreVals.map((v) => Math.floor((v - 10) / 2));
  const modifiers = Object.fromEntries(abilityKeys.map((k, i) => [k, baseMods[i]]));

  const savVals = [d.savStr, d.savDex, d.savCon, d.savInt, d.savWis, d.savCha];
  const saving_throws = Object.fromEntries(abilityKeys.map((k, i) => {
    const v = savVals[i].trim();
    return [k, v !== '' ? parseInt(v) : baseMods[i]];
  }));

  const skill_bonuses: Record<string, number> = {};
  for (const sk of SKILLS) {
    const v = d.skills[sk.key]?.trim();
    if (v) { const n = parseInt(v); if (!isNaN(n)) skill_bonuses[sk.key] = n; }
  }

  const speed: Record<string, unknown> = {};
  if (parseInt(d.speedWalk) > 0) speed.walk = parseInt(d.speedWalk);
  if (parseInt(d.speedFly) > 0) speed.fly = parseInt(d.speedFly);
  if (parseInt(d.speedSwim) > 0) speed.swim = parseInt(d.speedSwim);
  if (parseInt(d.speedClimb) > 0) speed.climb = parseInt(d.speedClimb);
  if (parseInt(d.speedBurrow) > 0) speed.burrow = parseInt(d.speedBurrow);
  if (Object.keys(speed).length) speed.unit = 'feet';

  const ri: Record<string, string> = {};
  if (d.damageResistances.trim()) ri.damage_resistances_display = d.damageResistances.trim();
  if (d.damageImmunities.trim()) ri.damage_immunities_display = d.damageImmunities.trim();
  if (d.damageVulnerabilities.trim()) ri.damage_vulnerabilities_display = d.damageVulnerabilities.trim();
  if (d.conditionImmunities.trim()) ri.condition_immunities_display = d.conditionImmunities.trim();

  const traits = d.traits.filter((t) => t.name.trim());
  const actions = d.actions.filter((a) => a.name.trim()).map((a) => {
    const item: Record<string, unknown> = {
      name: a.name.trim(),
      desc: a.desc.trim(),
      action_type: a.action_type || 'ACTION',
      usage_limits: null as unknown,
    };
    const lac = parseInt(a.legendary_action_cost);
    if (!isNaN(lac) && lac > 0) item.legendary_action_cost = lac;
    if (a.usage_type) {
      const usage: Record<string, unknown> = { type: a.usage_type };
      const param = parseInt(a.usage_param);
      if (!isNaN(param)) usage.param = param;
      item.usage_limits = usage;
    }
    return item;
  });

  const out: Record<string, unknown> = {
    name: d.name.trim() || 'Unknown',
    ability_scores,
    modifiers,
    saving_throws,
  };
  if (d.sizeName.trim()) out.size = { name: d.sizeName.trim() };
  if (d.typeName.trim()) out.type = { name: d.typeName.trim() };
  if (d.alignment.trim()) out.alignment = d.alignment.trim();
  if (d.cr.trim()) out.challenge_rating = parseFloat(d.cr) || 0;
  if (d.ac.trim()) out.armor_class = parseInt(d.ac) || 0;
  if (d.acDetail.trim()) out.armor_detail = d.acDetail.trim();
  if (d.hp.trim()) out.hit_points = parseInt(d.hp) || 0;
  if (d.hitDice.trim()) out.hit_dice = d.hitDice.trim();
  if (Object.keys(speed).length) out.speed = speed;
  if (Object.keys(skill_bonuses).length) out.skill_bonuses = skill_bonuses;
  if (d.darkvision.trim()) out.darkvision_range = parseInt(d.darkvision) || 0;
  if (d.blindsight.trim()) out.blindsight_range = parseInt(d.blindsight) || 0;
  if (d.tremorsense.trim()) out.tremorsense_range = parseInt(d.tremorsense) || 0;
  if (d.truesight.trim()) out.truesight_range = parseInt(d.truesight) || 0;
  if (d.passivePerception.trim()) out.passive_perception = parseInt(d.passivePerception) || 0;
  if (Object.keys(ri).length) out.resistances_and_immunities = ri;
  if (d.languages.trim()) out.languages = { as_string: d.languages.trim() };
  if (traits.length) out.traits = traits;
  if (actions.length) out.actions = actions;

  return JSON.stringify(out);
}

// ── Component ─────────────────────────────────────────────────────────────────

type Tab = 'basics' | 'abilities' | 'features';

export function StatBlockEditor({
  initialData,
  onSave,
  onCancel,
}: {
  initialData?: string | null;
  onSave: (json: string) => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState<Draft>(() => initDraft(initialData));
  const [tab, setTab] = useState<Tab>('basics');

  function upd(patch: Partial<Draft>) {
    setD((prev) => ({ ...prev, ...patch }));
  }

  function updSkill(key: string, val: string) {
    setD((prev) => ({ ...prev, skills: { ...prev.skills, [key]: val } }));
  }

  function updTrait(i: number, field: keyof TraitDraft, val: string) {
    setD((prev) => {
      const next = [...prev.traits];
      next[i] = { ...next[i], [field]: val };
      return { ...prev, traits: next };
    });
  }

  function addTrait() {
    setD((prev) => ({ ...prev, traits: [...prev.traits, { name: '', desc: '' }] }));
  }

  function removeTrait(i: number) {
    setD((prev) => ({ ...prev, traits: prev.traits.filter((_, idx) => idx !== i) }));
  }

  function updAction(i: number, field: keyof ActionDraft, val: string) {
    setD((prev) => {
      const next = [...prev.actions];
      next[i] = { ...next[i], [field]: val };
      return { ...prev, actions: next };
    });
  }

  function addAction() {
    setD((prev) => ({
      ...prev,
      actions: [...prev.actions, { name: '', desc: '', action_type: 'ACTION', legendary_action_cost: '', usage_type: '', usage_param: '' }],
    }));
  }

  function removeAction(i: number) {
    setD((prev) => ({ ...prev, actions: prev.actions.filter((_, idx) => idx !== i) }));
  }

  const ABILITY_FIELDS: { label: string; key: keyof Draft; savKey: keyof Draft }[] = [
    { label: 'STR', key: 'str', savKey: 'savStr' },
    { label: 'DEX', key: 'dex', savKey: 'savDex' },
    { label: 'CON', key: 'con', savKey: 'savCon' },
    { label: 'INT', key: 'int_', savKey: 'savInt' },
    { label: 'WIS', key: 'wis', savKey: 'savWis' },
    { label: 'CHA', key: 'cha', savKey: 'savCha' },
  ];

  return (
    <div style={s.overlay} onClick={onCancel}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={s.header}>
          <span style={s.headerTitle}>{d.name.trim() || 'New Stat Block'}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={s.btnSave} onClick={() => onSave(buildOutput(d))}>Save</button>
            <button type="button" style={s.btnCancel} onClick={onCancel}>Cancel</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={s.tabBar}>
          {(['basics', 'abilities', 'features'] as const).map((t) => (
            <button
              key={t}
              type="button"
              style={{ ...s.tabBtn, ...(tab === t ? s.tabBtnActive : {}) }}
              onClick={() => setTab(t)}
            >
              {t === 'basics' ? 'Basic Info' : t === 'abilities' ? 'Abilities' : 'Features'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={s.body}>

          {/* ── BASICS TAB ── */}
          {tab === 'basics' && (
            <>
              <SectionHeader>Identity</SectionHeader>
              <div style={s.row}>
                <Field label="Name" style={{ flex: 3 }}>
                  <input style={s.input} value={d.name} onChange={(e) => upd({ name: e.target.value })} placeholder="Creature name" />
                </Field>
                <Field label="Size">
                  <select style={s.input} value={d.sizeName} onChange={(e) => upd({ sizeName: e.target.value })}>
                    <option value="">—</option>
                    {['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Type" style={{ flex: 2 }}>
                  <input style={s.input} value={d.typeName} onChange={(e) => upd({ typeName: e.target.value })} placeholder="e.g. dragon" />
                </Field>
                <Field label="CR" style={{ width: 80 }}>
                  <input style={s.input} type="number" min={0} step={0.25} value={d.cr} onChange={(e) => upd({ cr: e.target.value })} placeholder="—" />
                </Field>
              </div>
              <div style={s.row}>
                <Field label="Alignment" style={{ flex: 2 }}>
                  <input style={s.input} value={d.alignment} onChange={(e) => upd({ alignment: e.target.value })} placeholder="e.g. chaotic evil" />
                </Field>
              </div>

              <SectionHeader>Defense</SectionHeader>
              <div style={s.row}>
                <Field label="Armor Class" style={{ width: 100 }}>
                  <input style={s.input} type="number" min={0} value={d.ac} onChange={(e) => upd({ ac: e.target.value })} placeholder="—" />
                </Field>
                <Field label="AC Detail" style={{ flex: 2 }}>
                  <input style={s.input} value={d.acDetail} onChange={(e) => upd({ acDetail: e.target.value })} placeholder="e.g. natural armor" />
                </Field>
                <Field label="Hit Points" style={{ width: 100 }}>
                  <input style={s.input} type="number" min={0} value={d.hp} onChange={(e) => upd({ hp: e.target.value })} placeholder="—" />
                </Field>
                <Field label="Hit Dice" style={{ flex: 1 }}>
                  <input style={s.input} value={d.hitDice} onChange={(e) => upd({ hitDice: e.target.value })} placeholder="e.g. 28d20+280" />
                </Field>
              </div>

              <SectionHeader>Speed</SectionHeader>
              <div style={s.row}>
                {[
                  { label: 'Walk', key: 'speedWalk' },
                  { label: 'Fly', key: 'speedFly' },
                  { label: 'Swim', key: 'speedSwim' },
                  { label: 'Climb', key: 'speedClimb' },
                  { label: 'Burrow', key: 'speedBurrow' },
                ].map(({ label, key }) => (
                  <Field key={key} label={label} style={{ width: 90 }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        style={{ ...s.input, paddingRight: 24 }}
                        type="number"
                        min={0}
                        step={5}
                        value={(d as unknown as Record<string, string>)[key]}
                        onChange={(e) => upd({ [key]: e.target.value } as Partial<Draft>)}
                        placeholder="—"
                      />
                      <span style={s.ftLabel}>ft</span>
                    </div>
                  </Field>
                ))}
              </div>
            </>
          )}

          {/* ── ABILITIES TAB ── */}
          {tab === 'abilities' && (
            <>
              <SectionHeader>Ability Scores & Saving Throws</SectionHeader>
              <div style={s.abilityGrid}>
                {ABILITY_FIELDS.map(({ label, key, savKey }) => {
                  const mod = scoreMod(d[key] as string);
                  const savVal = d[savKey] as string;
                  const autoMod = fmod(mod);
                  return (
                    <div key={label} style={s.abilityCol}>
                      <div style={s.abilityLabel}>{label}</div>
                      <input
                        style={{ ...s.input, textAlign: 'center', width: '100%' }}
                        type="number"
                        min={1}
                        max={30}
                        value={d[key] as string}
                        onChange={(e) => upd({ [key]: e.target.value } as Partial<Draft>)}
                      />
                      <div style={s.abilityMod}>{autoMod}</div>
                      <div style={s.savLabel}>Save</div>
                      <input
                        style={{ ...s.input, textAlign: 'center', width: '100%', fontSize: '0.8rem' }}
                        type="number"
                        value={savVal}
                        onChange={(e) => upd({ [savKey]: e.target.value } as Partial<Draft>)}
                        placeholder={autoMod}
                        title={`Saving throw override (blank = ${autoMod})`}
                      />
                    </div>
                  );
                })}
              </div>
              <p style={s.hint}>Save field: fill to override (proficiency). Blank defaults to base modifier.</p>

              <SectionHeader>Skills</SectionHeader>
              <div style={s.skillGrid}>
                {SKILLS.map(({ key, label, ability }) => (
                  <div key={key} style={s.skillRow}>
                    <span style={s.skillAbility}>{ability}</span>
                    <span style={s.skillLabel}>{label}</span>
                    <input
                      style={{ ...s.input, width: 56, textAlign: 'center', fontSize: '0.8rem' }}
                      type="number"
                      value={d.skills[key] ?? ''}
                      onChange={(e) => updSkill(key, e.target.value)}
                      placeholder="—"
                    />
                  </div>
                ))}
              </div>

              <SectionHeader>Senses</SectionHeader>
              <div style={s.row}>
                {[
                  { label: 'Darkvision', key: 'darkvision' },
                  { label: 'Blindsight', key: 'blindsight' },
                  { label: 'Tremorsense', key: 'tremorsense' },
                  { label: 'Truesight', key: 'truesight' },
                ].map(({ label, key }) => (
                  <Field key={key} label={`${label} (ft)`} style={{ width: 120 }}>
                    <input
                      style={s.input}
                      type="number"
                      min={0}
                      step={5}
                      value={(d as unknown as Record<string, string>)[key]}
                      onChange={(e) => upd({ [key]: e.target.value } as Partial<Draft>)}
                      placeholder="—"
                    />
                  </Field>
                ))}
                <Field label="Passive Perception" style={{ width: 130 }}>
                  <input
                    style={s.input}
                    type="number"
                    min={0}
                    value={d.passivePerception}
                    onChange={(e) => upd({ passivePerception: e.target.value })}
                    placeholder="—"
                  />
                </Field>
              </div>

              <SectionHeader>Damage & Condition Modifiers</SectionHeader>
              <div style={s.resistGrid}>
                {[
                  { label: 'Resistances', key: 'damageResistances', color: '#80cbc4' },
                  { label: 'Immunities', key: 'damageImmunities', color: '#a5d6a7' },
                  { label: 'Vulnerabilities', key: 'damageVulnerabilities', color: '#ef9a9a' },
                  { label: 'Condition Immunities', key: 'conditionImmunities', color: '#ccc' },
                ].map(({ label, key, color }) => (
                  <Field key={key} label={label} style={{ flex: 1, minWidth: 200 }}>
                    <input
                      style={{ ...s.input, width: '100%', color }}
                      value={(d as unknown as Record<string, string>)[key]}
                      onChange={(e) => upd({ [key]: e.target.value } as Partial<Draft>)}
                      placeholder="e.g. fire, lightning"
                    />
                  </Field>
                ))}
              </div>

              <SectionHeader>Languages</SectionHeader>
              <input
                style={{ ...s.input, width: '100%', boxSizing: 'border-box' }}
                value={d.languages}
                onChange={(e) => upd({ languages: e.target.value })}
                placeholder="e.g. Common, Draconic"
              />
            </>
          )}

          {/* ── FEATURES TAB ── */}
          {tab === 'features' && (
            <>
              <SectionHeader>
                Traits
                <button type="button" style={s.addBtn} onClick={addTrait}>+ Add Trait</button>
              </SectionHeader>
              {d.traits.map((t, i) => (
                <div key={i} style={s.featureCard}>
                  <div style={s.featureCardHeader}>
                    <input
                      style={{ ...s.input, flex: 1, fontWeight: 600 }}
                      value={t.name}
                      onChange={(e) => updTrait(i, 'name', e.target.value)}
                      placeholder="Trait name"
                    />
                    <button type="button" style={s.removeBtn} onClick={() => removeTrait(i)}>✕</button>
                  </div>
                  <textarea
                    style={s.textarea}
                    value={t.desc}
                    onChange={(e) => updTrait(i, 'desc', e.target.value)}
                    placeholder="Description..."
                    rows={3}
                  />
                </div>
              ))}
              {d.traits.length === 0 && <p style={s.empty}>No traits. Click "+ Add Trait" to create one.</p>}

              <SectionHeader>
                Actions
                <button type="button" style={s.addBtn} onClick={addAction}>+ Add Action</button>
              </SectionHeader>
              {d.actions.map((a, i) => (
                <div key={i} style={s.featureCard}>
                  <div style={s.featureCardHeader}>
                    <select
                      style={{ ...s.input, width: 148, flexShrink: 0 }}
                      value={a.action_type}
                      onChange={(e) => updAction(i, 'action_type', e.target.value)}
                    >
                      {ACTION_TYPES.map((at) => <option key={at.value} value={at.value}>{at.label}</option>)}
                    </select>
                    <input
                      style={{ ...s.input, flex: 1, fontWeight: 600 }}
                      value={a.name}
                      onChange={(e) => updAction(i, 'name', e.target.value)}
                      placeholder="Action name"
                    />
                    <button type="button" style={s.removeBtn} onClick={() => removeAction(i)}>✕</button>
                  </div>
                  <div style={{ ...s.row, marginTop: 6, gap: 10 }}>
                    <Field label="Usage" style={{ flex: 1 }}>
                      <select
                        style={s.input}
                        value={a.usage_type}
                        onChange={(e) => updAction(i, 'usage_type', e.target.value)}
                      >
                        {USAGE_TYPES.map((ut) => <option key={ut.value} value={ut.value}>{ut.label}</option>)}
                      </select>
                    </Field>
                    {a.usage_type !== '' && (
                      <Field label={a.usage_type === 'RECHARGE_ON_ROLL' ? 'Min Roll' : 'Uses/Day'} style={{ width: 90 }}>
                        <input
                          style={s.input}
                          type="number"
                          min={1}
                          max={6}
                          value={a.usage_param}
                          onChange={(e) => updAction(i, 'usage_param', e.target.value)}
                          placeholder={a.usage_type === 'RECHARGE_ON_ROLL' ? '6' : '3'}
                        />
                      </Field>
                    )}
                    {a.action_type === 'LEGENDARY_ACTION' && (
                      <Field label="LA Cost" style={{ width: 80 }}>
                        <input
                          style={s.input}
                          type="number"
                          min={1}
                          max={3}
                          value={a.legendary_action_cost}
                          onChange={(e) => updAction(i, 'legendary_action_cost', e.target.value)}
                          placeholder="1"
                        />
                      </Field>
                    )}
                  </div>
                  <textarea
                    style={{ ...s.textarea, marginTop: 6 }}
                    value={a.desc}
                    onChange={(e) => updAction(i, 'desc', e.target.value)}
                    placeholder="Description / attack text..."
                    rows={3}
                  />
                </div>
              ))}
              {d.actions.length === 0 && <p style={s.empty}>No actions. Click "+ Add Action" to create one.</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <div style={s.sectionHeader}>{children}</div>;
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.7rem', color: '#888', ...style }}>
      {label}
      {children}
    </label>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 2000,
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    padding: '20px 16px', overflowY: 'auto',
  },
  modal: {
    width: '100%', maxWidth: 820,
    background: '#16213e', border: '1px solid #2a2a4a',
    borderRadius: 10, display: 'flex', flexDirection: 'column',
    boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
    minHeight: 0,
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 20px', borderBottom: '1px solid #2a2a4a',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: '1.25rem', fontWeight: 700, color: '#c9a84c',
  },
  tabBar: {
    display: 'flex', gap: 0, borderBottom: '1px solid #2a2a4a', flexShrink: 0,
  },
  tabBtn: {
    flex: 1, padding: '10px 16px',
    background: 'transparent', border: 'none', borderBottom: '3px solid transparent',
    color: '#666', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
    letterSpacing: '0.04em', textTransform: 'uppercase',
    transition: 'color 0.15s',
  },
  tabBtnActive: {
    color: '#c9a84c', borderBottomColor: '#c9a84c', background: '#0f0f20',
  },
  body: {
    padding: '18px 20px', overflowY: 'auto', flex: 1,
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  sectionHeader: {
    fontSize: '0.7rem', fontWeight: 700, color: '#c9a84c',
    letterSpacing: '0.12em', textTransform: 'uppercase',
    borderBottom: '1px solid #8b3a1a', paddingBottom: 5,
    marginTop: 10, marginBottom: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  row: {
    display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 4,
  },
  input: {
    background: '#0f0f1f', border: '1px solid #3a3a5a', borderRadius: 4,
    color: '#e0e0e0', padding: '6px 10px', fontSize: '0.875rem',
    width: '100%', boxSizing: 'border-box',
  },
  ftLabel: {
    position: 'absolute', right: 10, fontSize: '0.7rem', color: '#555', pointerEvents: 'none',
  },
  hint: {
    fontSize: '0.7rem', color: '#555', fontStyle: 'italic', margin: '2px 0 6px',
  },
  abilityGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 4,
  },
  abilityCol: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
  },
  abilityLabel: {
    fontSize: '0.7rem', color: '#c9a84c', fontWeight: 700, letterSpacing: '0.05em',
  },
  abilityMod: {
    fontSize: '0.85rem', color: '#888', textAlign: 'center',
  },
  savLabel: {
    fontSize: '0.6rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em',
  },
  skillGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 4,
  },
  skillRow: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0',
  },
  skillAbility: {
    fontSize: '0.6rem', color: '#555', fontWeight: 700, width: 26, flexShrink: 0,
  },
  skillLabel: {
    fontSize: '0.8rem', color: '#aaa', flex: 1,
  },
  resistGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 4,
  },
  featureCard: {
    background: '#0f0f1f', border: '1px solid #2a2a4a', borderRadius: 6,
    padding: '10px 12px', marginBottom: 6,
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  featureCardHeader: {
    display: 'flex', gap: 8, alignItems: 'center',
  },
  textarea: {
    background: '#0a0a18', border: '1px solid #2a2a4a', borderRadius: 4,
    color: '#ccc', padding: '8px 10px', fontSize: '0.825rem',
    width: '100%', boxSizing: 'border-box', resize: 'vertical',
    lineHeight: 1.5, fontFamily: 'inherit',
  },
  addBtn: {
    background: 'none', border: '1px solid #3a3a5a', borderRadius: 4,
    color: '#c9a84c', cursor: 'pointer', fontSize: '0.75rem',
    padding: '3px 10px',
  },
  removeBtn: {
    background: 'none', border: '1px solid #5a1e1e', borderRadius: 4,
    color: '#ef5350', cursor: 'pointer', fontSize: '0.75rem',
    padding: '3px 8px', flexShrink: 0,
  },
  empty: {
    color: '#555', fontStyle: 'italic', fontSize: '0.8rem', margin: '4px 0 10px',
  },
  btnSave: {
    padding: '8px 20px', background: '#2d4a2d', color: '#4caf50',
    border: '1px solid #3d6a3d', borderRadius: 4, cursor: 'pointer',
    fontSize: '0.875rem', fontWeight: 600,
  },
  btnCancel: {
    padding: '8px 16px', background: 'transparent', color: '#666',
    border: '1px solid #444', borderRadius: 4, cursor: 'pointer',
    fontSize: '0.875rem',
  },
};
