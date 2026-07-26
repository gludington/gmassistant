/**
 * gmassisstant — Foundry VTT monster export macro
 *
 * Written for Foundry VTT v14 / dnd5e system 5.3.3. Paste this whole file into
 * a new Foundry "Script Macro" (Macro Directory -> Create Macro -> Type: Script)
 * and run it as the GM.
 *
 * Running it opens a checklist of every place monsters could be coming from —
 * each compendium pack (e.g. "SRD Monsters", "Monster Manual") plus each folder
 * in your World Actors directory (e.g. the per-book folders DDB Importer
 * creates) — so you can pick exactly one source when the same creature exists
 * in more than one place (e.g. a goblin in both the SRD and Monster Manual
 * compendiums). Whatever you check gets exported; unchecked sources are
 * skipped entirely, no dedup guessing needed.
 *
 * It then downloads a JSON file of every NPC actor found in the sources you
 * picked. Compendium packs are read via `pack.getDocuments()`, which decrypts
 * protected/locked content for you as the logged-in, licensed GM — this has to
 * run inside Foundry rather than by reading files on disk for that reason.
 *
 * This macro is intentionally "dumb": it does NOT try to translate Foundry's
 * dnd5e data model into gmassisstant's stat block format. It just dumps each
 * actor's raw `system` data plus its feature/action items. The translation
 * happens later, in gmassisstant's own backend, so it can be fixed there
 * without needing you to re-paste an updated macro.
 *
 * ── Things you can tweak ──────────────────────────────────────────────────
 * - ACTOR_TYPES: which Actor "type" values to include (default: just "npc",
 *   which is what dnd5e uses for monsters/NPCs — player characters are "character").
 * - ITEM_TYPES: which Item "type" values to pull off each actor as
 *   traits/actions (default: "feat", "weapon", and "equipment" — "feat" is
 *   how dnd5e represents monster traits/actions/legendary actions, "weapon"
 *   is how most monster attacks like "Tentacle" or "Bite" are represented
 *   (some feat descriptions reference a weapon item by id, e.g. "uses its
 *   Tentacle attack", which is why both need exporting together for that
 *   text to resolve), and "equipment" covers worn armor — needed to describe
 *   AC (e.g. "leather armor") for monsters whose AC isn't just "natural armor").
 * - If you'd rather skip the checklist and always export everything, set
 *   SKIP_PICKER to true below.
 */

(async () => {
  const ACTOR_TYPES = ['npc'];
  const ITEM_TYPES = ['feat', 'weapon', 'equipment'];
  const SKIP_PICKER = false;

  function packTitle(pack) {
    // pack.metadata.label is just the compendium's own name within its package
    // (often generically "Actors" for every book) — prefix with the owning
    // module/system/world's title so same-named packs are distinguishable.
    const { packageName, packageType, label } = pack.metadata;
    let owner = packageName;
    if (packageType === 'module') owner = game.modules.get(packageName)?.title ?? packageName;
    else if (packageType === 'system') owner = game.system.title ?? packageName;
    else if (packageType === 'world') owner = game.world.title ?? packageName;
    return `${owner} — ${label}`;
  }

  function folderPath(folder) {
    const parts = [folder.name];
    let f = folder.folder;
    while (f) {
      parts.unshift(f.name);
      f = f.folder;
    }
    return parts.join(' › '); // "Book › Sub-folder"
  }

  // ── Build the list of selectable sources ──────────────────────────────────

  const actorPacks = game.packs.filter((p) => p.documentName === 'Actor');
  const worldFolders = game.folders.filter((f) => f.type === 'Actor');
  const hasUngroupedWorldActors = game.actors.some((a) => !a.folder && ACTOR_TYPES.includes(a.type));

  const sources = [
    ...actorPacks.map((p) => ({ id: `pack:${p.collection}`, label: packTitle(p), group: 'Compendiums' })),
    ...worldFolders.map((f) => ({ id: `folder:${f.id}`, label: folderPath(f), group: 'World Actors folders' })),
    ...(hasUngroupedWorldActors ? [{ id: 'world-root', label: '(Ungrouped world actors)', group: 'World Actors folders' }] : []),
  ];

  let selectedIds;
  if (SKIP_PICKER || sources.length === 0) {
    selectedIds = new Set(sources.map((s) => s.id));
  } else {
    const groups = ['Compendiums', 'World Actors folders'];
    const content = groups
      .map((group) => {
        const rows = sources
          .filter((s) => s.group === group)
          .map((s) => `<label style="display:flex; gap:6px; align-items:center; margin:2px 0;">
            <input type="checkbox" name="sources" value="${s.id}" checked>
            ${s.label}
          </label>`)
          .join('');
        return rows ? `<fieldset><legend>${group}</legend>${rows}</fieldset>` : '';
      })
      .join('');

    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: 'gmassisstant: choose monster sources', width: 480 },
      content: `<div style="max-height:420px; overflow-y:auto;">${content}</div>`,
      buttons: [
        {
          action: 'submit',
          label: 'Export selected',
          default: true,
          callback: (event, button) => {
            const nodes = button.form.elements.sources;
            const list = nodes instanceof RadioNodeList ? Array.from(nodes) : nodes ? [nodes] : [];
            return list.filter((el) => el.checked).map((el) => el.value);
          },
        },
        { action: 'cancel', label: 'Cancel', callback: () => null },
      ],
    });

    if (result === null) {
      console.log('[gmassisstant export] cancelled');
      return;
    }
    selectedIds = new Set(result);
  }

  // ── Export the selected sources ─────────────────────────────────────────

  function serializeItems(actor) {
    return actor.items
      .filter((i) => ITEM_TYPES.includes(i.type))
      .map((i) => ({
        id: i.id, // lets the backend resolve [[/item .xyz]] cross-references in other items' descriptions
        name: i.name,
        type: i.type,
        system: i.system.toObject(),
      }));
  }

  function serializeActor(actor, source) {
    return {
      name: actor.name,
      source, // human-readable — gmassisstant uses this to name/nest the monster's library folder
      system: actor.system.toObject(),
      items: serializeItems(actor),
      // actor.system.toObject() only includes raw/persisted schema fields. AC is
      // often *computed* (armor.calc === "default" derives it from equipped
      // armor + dex at runtime) rather than stored — this grabs that live,
      // already-resolved value directly off the actor while Foundry is running,
      // since gmassisstant can't replicate armor/dex-cap rules offline.
      computedAC: actor.system.attributes?.ac?.value ?? null,
    };
  }

  const byName = new Map(); // dedup safety net: last write wins if the same name somehow appears in two selected sources

  for (const pack of actorPacks) {
    if (!selectedIds.has(`pack:${pack.collection}`)) continue;
    console.log(`[gmassisstant export] scanning pack: ${pack.collection}`);
    const docs = await pack.getDocuments();
    for (const actor of docs) {
      if (!ACTOR_TYPES.includes(actor.type)) continue;
      byName.set(actor.name, serializeActor(actor, packTitle(pack)));
    }
  }

  for (const actor of game.actors) {
    if (!ACTOR_TYPES.includes(actor.type)) continue;
    const sourceId = actor.folder ? `folder:${actor.folder.id}` : 'world-root';
    if (!selectedIds.has(sourceId)) continue;
    byName.set(actor.name, serializeActor(actor, actor.folder ? folderPath(actor.folder) : 'world'));
  }

  const out = Array.from(byName.values());
  console.log(`[gmassisstant export] collected ${out.length} unique actors`);

  if (out.length === 0) {
    ui.notifications.warn('gmassisstant export: no actors matched your selection.');
    return;
  }

  // v13+ namespaces this under foundry.utils; older versions expose it as a bare global.
  const save = foundry?.utils?.saveDataToFile ?? saveDataToFile;
  save(JSON.stringify(out, null, 2), 'application/json', 'foundry-monsters.json');
  ui.notifications.info(`gmassisstant export: downloaded ${out.length} monsters.`);
})();
