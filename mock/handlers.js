// The mock-up's commands. An action without a handler here is refused until a design writes it.

const now = () => new Date().toISOString();

// The date as the pages show it: « 20 oct. 2026, 19:42 ».
const shown = (at) =>
  new Date(at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });

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
      name,
      kind_label: oneshot ? "Oneshot" : "Campagne",
      pitch: campaign.pitch,
      glyph: campaign.glyph,
      cover_url: null,
      last_export_label: "Jamais exportée",
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
    const view = ctx.row ?? ctx.selected.campaign_overview_view;
    if (!view) return db.refuse("Choisissez la campagne à exporter.");
    const at = now();
    db.update("campaign_overview_view", { campaign_id: view.campaign_id }, { last_export_label: shown(at) });
    return db.update("campaign", { id: view.campaign_id }, { last_exported_at: at });
  },

  // import-creates-copy: always a new campaign with new ids; the original is never touched.
  "campaign.importCampaign": (db, ctx) => {
    const file = String(ctx.form["campaign-archive"] ?? "");
    if (!file) return db.refuse("Choisissez une archive à importer.");
    // The mock reads no archive: it imports a copy of the first campaign, as the file would hold.
    const source = db.find("campaign")[0];
    if (!source) return db.refuse("Cette archive ne contient aucune campagne.");
    const at = now();
    // name-unique: a second import of the same archive gets the next number.
    let name = `${source.name} (copie importée)`;
    for (let n = 2; db.find("campaign", { name }).length > 0; n++) name = `${source.name} (copie importée ${n})`;
    const copy = db.insert("campaign", {
      ...source,
      id: crypto.randomUUID(),
      name,
      cover_media_id: null,
      created_at: at,
      last_exported_at: null,
      imported_at: at,
      origin_campaign_id: source.id,
    });
    // Every owned row gets a new id; the cover follows its media's copy.
    const mediaIds = new Map();
    for (const media of db.find("media", { campaign_id: source.id })) {
      const fresh = db.insert("media", { ...media, id: crypto.randomUUID(), campaign_id: copy.id });
      mediaIds.set(media.id, fresh.id);
    }
    if (source.cover_media_id && mediaIds.has(source.cover_media_id))
      db.update("campaign", { id: copy.id }, { cover_media_id: mediaIds.get(source.cover_media_id) });
    for (const session of db.find("session", { campaign_id: source.id }))
      db.insert("session", { ...session, id: crypto.randomUUID(), campaign_id: copy.id });
    for (const view of db.find("campaign_overview_view", { campaign_id: source.id }))
      db.insert("campaign_overview_view", { ...view, campaign_id: copy.id, name, last_export_label: "Jamais exportée" });
    return copy;
  },

  // oneshot-single-session: a oneshot keeps its only session.
  "session.createSession": (db, ctx) => {
    const view = ctx.selected.campaign_overview_view;
    const campaign = view && db.find("campaign", { id: view.campaign_id })[0];
    if (!campaign) return db.refuse("Ouvrez d’abord une campagne.");
    if (campaign.kind === "oneshot") return db.refuse("Un oneshot n’a qu’une seule séance.");
    const sessions = db.find("session", { campaign_id: campaign.id });
    const session = db.insert("session", {
      id: crypto.randomUUID(),
      campaign_id: campaign.id,
      position: sessions.length + 1,
      title: `Séance ${sessions.length + 1}`,
      planned_on: null,
      status: "prep",
      started_at: null,
      closed_at: null,
      microphone_on: false,
      summary: null,
      summary_model: null,
      summary_edited_at: null,
    });
    db.update("campaign_overview_view", { campaign_id: campaign.id }, { session_count: sessions.length + 1 });
    return session;
  },
};
