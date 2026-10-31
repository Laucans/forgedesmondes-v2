// The mock-up's action handlers: what each data-capability does to the mock's data. The runtime
// calls `handlers[id](db, ctx)` for a `data-action="<id>"` button:
//   db  = { find(entity, where?), insert(entity, row), update(entity, where, set),
//           remove(entity, where), refuse(reason) }
//   ctx = { row, selected, role, form }
// An action with no handler is refused until the design of its milestone writes one.

const now = () => new Date().toISOString();

/** The campaign an action applies to: the row clicked in, else the selected one, else the first. */
function campaignOf(db, ctx) {
  return ctx.row ?? ctx.selected.campaign ?? db.find("campaign")[0] ?? null;
}

/** A new campaign row: a oneshot also gets its single session (invariant oneshot-single-session). */
function insertCampaign(db, row) {
  db.insert("campaign", row);
  if (row.kind === "oneshot") {
    db.insert("session", {
      id: crypto.randomUUID(),
      campaign_id: row.id,
      position: 1,
      title: row.name,
      planned_on: null,
      status: "prep",
      started_at: null,
      closed_at: null,
      microphone_on: false,
      summary: null,
      summary_model: null,
      summary_edited_at: null,
    });
  }
}

export default {
  "campaign.createCampaign": (db, ctx) => {
    const name = String(ctx.form["campaign-name-input"] ?? "").trim();
    const kind = String(ctx.form["campaign-kind-select"] || "campagne");
    if (name === "") db.refuse("le nom de la campagne est obligatoire");
    if (kind !== "campagne" && kind !== "oneshot") db.refuse("le type doit être campagne ou oneshot");
    insertCampaign(db, {
      id: crypto.randomUUID(),
      name,
      kind,
      pitch: String(ctx.form["campaign-pitch-input"] ?? "").trim() || null,
      art: null,
      glyph: kind === "oneshot" ? "✦" : "♜",
      cover_media_id: null,
      created_at: now(),
      last_exported_at: null,
      imported_at: null,
      origin_campaign_id: null,
      sound_master_volume: 1,
    });
  },

  // Export stamps last_exported_at and nothing else (invariant export-stamps-date); the file
  // itself is the campaign and every row it owns, read by campaign.getCampaign.
  "campaign.exportCampaign": (db, ctx) => {
    const campaign = campaignOf(db, ctx);
    if (!campaign) db.refuse("aucune campagne choisie");
    db.update("campaign", { id: campaign.id }, { last_exported_at: now() });
  },

  // Import always creates a new copy with a new id; the original is never touched
  // (invariant import-creates-copy).
  "campaign.importCampaign": (db, ctx) => {
    let archive;
    try {
      archive = JSON.parse(String(ctx.form["import-archive-input"] ?? ""));
    } catch {
      db.refuse("l’archive n’est pas un fichier d’export valide");
    }
    const source = archive?.campaign;
    if (!source || typeof source.name !== "string" || source.name.trim() === "") {
      db.refuse("l’archive ne contient pas de campagne");
    }
    const volume = Number(source.sound_master_volume ?? 1);
    if (!(volume >= 0 && volume <= 1)) db.refuse("le volume global doit rester entre 0 et 1");
    insertCampaign(db, {
      id: crypto.randomUUID(),
      name: source.name,
      kind: source.kind === "oneshot" ? "oneshot" : "campagne",
      pitch: source.pitch ?? null,
      art: source.art ?? null,
      glyph: source.glyph ?? null,
      cover_media_id: null,
      created_at: now(),
      last_exported_at: null,
      imported_at: now(),
      origin_campaign_id: source.id ?? null,
      sound_master_volume: volume,
    });
  },
};
