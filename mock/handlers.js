// The mock-up's commands. An action without a handler here is refused until a design writes it.

const now = () => new Date().toISOString();

// The rows a campaign owns, copied by an import (grows as later milestones add data).
const OWNED = ["session", "media", "campaign_overview_view"];

export default {
  "campaign.createCampaign": (db, ctx) => {
    const name = String(ctx.form["campaign-new-name"] ?? "").trim();
    if (!name) return db.refuse("Donnez un nom à la campagne.");
    if (db.find("campaign", { name }).length > 0)
      return db.refuse("Une campagne porte déjà ce nom.");
    const oneshot = ctx.form["campaign-new-oneshot"] === true;
    const campaign = db.insert("campaign", {
      id: crypto.randomUUID(),
      name,
      kind: oneshot ? "oneshot" : "campagne",
      pitch: String(ctx.form["campaign-new-pitch"] ?? "").trim() || null,
      art: null,
      glyph: name.replace(/^(le|la|les|l’|l')\s*/i, "").slice(0, 2).toUpperCase(),
      cover_media_id: null,
      created_at: now(),
      last_exported_at: null,
      imported_at: null,
      origin_campaign_id: null,
      sound_master_volume: 1,
    });
    // oneshot-single-session: a oneshot is created with its only session.
    if (oneshot) {
      db.insert("session", {
        id: crypto.randomUUID(),
        campaign_id: campaign.id,
        position: 1,
        title: name,
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
    db.insert("campaign_overview_view", {
      campaign_id: campaign.id,
      player_count: 0,
      pc_count: 0,
      npc_count: 0,
      place_count: 0,
      event_count: 0,
      media_count: 0,
      sound_count: 0,
      session_count: oneshot ? 1 : 0,
    });
    return campaign;
  },

  // export-stamps-date: the archive is downloaded, only last_exported_at changes.
  "campaign.exportCampaign": (db, ctx) => {
    const campaign = ctx.row ?? ctx.selected.campaign;
    if (!campaign) return db.refuse("Choisissez la campagne à exporter.");
    return db.update("campaign", { id: campaign.id }, { last_exported_at: now() });
  },

  // import-creates-copy: always a new campaign with new ids; the original is never touched.
  "campaign.importCampaign": (db, ctx) => {
    const file = String(ctx.form["campaign-archive"] ?? "");
    if (!file) return db.refuse("Choisissez une archive à importer.");
    // The mock reads no archive: it imports a copy of the first campaign, as the file would hold.
    const source = db.find("campaign")[0];
    if (!source) return db.refuse("Cette archive ne contient aucune campagne.");
    const at = now();
    const copy = db.insert("campaign", {
      ...source,
      id: crypto.randomUUID(),
      name: `${source.name} (copie importée)`,
      cover_media_id: null,
      created_at: at,
      last_exported_at: null,
      imported_at: at,
      origin_campaign_id: source.id,
    });
    for (const entity of OWNED) {
      for (const row of db.find(entity, { campaign_id: source.id })) {
        const fresh = entity === "campaign_overview_view" ? {} : { id: crypto.randomUUID() };
        db.insert(entity, { ...row, ...fresh, campaign_id: copy.id });
      }
    }
    return copy;
  },
};
