// Archive model: immutable source records + derived, read-only classification.
// Nothing here is editable; presentation overrides live in story state.

export const COLLECTIONS = {
  external_media: { key: 'external_media', short: 'Press & Perspectives', letter: 'M' },
  entrust_journal: { key: 'entrust_journal', short: 'The Entrust Journal', letter: 'O' },
  conversations: { key: 'conversations', short: 'Watch & Listen', letter: 'V' },
};

export const EDITORS_SELECTION = ['M030', 'M041', 'M048', 'M020', 'M005', 'M028', 'M037', 'M014', 'M003', 'O001', 'O003', 'O004', 'O029', 'V001', 'V005'];

export const SHELVES = ['Succession & Continuity', 'Family Office Explained', 'Women & Wealth', 'Next Generation', 'Cross-Border Families', 'Philanthropy & Responsibility'];

export const LENS_LABELS = ['By Sreepriya', 'In Conversation', 'Quoted & Consulted', 'Recognition & Appointments'];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function fmtDate(d) {
  if (!d) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return String(d);
  return `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}`;
}
export function fmtDateShort(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || '');
  if (!m) return String(d || '');
  return `${+m[3]} ${MONTHS[+m[2] - 1].slice(0, 3)} ${m[1]}`;
}
export function fileDate(d, year) {
  const s = String(d || '');
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return m[1] + m[2] + m[3];
  m = /^([A-Za-z]+) (\d{4})/.exec(s);
  if (m) {
    const i = MONTHS.findIndex((x) => x.toLowerCase() === m[1].toLowerCase());
    if (i >= 0) return m[2] + String(i + 1).padStart(2, '0');
  }
  m = /^(\d{4}).*?Q(\d)/.exec(s);
  if (m) return m[1] + 'Q' + m[2];
  return String(year || 'undated');
}
export function dateIsQualified(rec) {
  return !/^\d{4}-\d{2}-\d{2}$/.test(rec.date || '') || /not independently|unconfirmed|listing date/i.test(rec.dateBasis || '');
}
export function sortKey(rec) {
  const s = String(rec.date || '');
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return s;
  m = /^([A-Za-z]+) (\d{4})/.exec(s);
  if (m) {
    const i = MONTHS.findIndex((x) => x.toLowerCase() === m[1].toLowerCase());
    return `${m[2]}-${String(i + 1).padStart(2, '0')}-15`;
  }
  m = /^(\d{4}).*?Q(\d)/.exec(s);
  if (m) return `${m[1]}-${String(+m[2] * 3).padStart(2, '0')}-01`;
  return `${rec.year || 0}-06-30`;
}

export function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
}

export function validUrl(u) {
  if (!u || typeof u !== 'string') return false;
  try {
    const x = new URL(u.trim());
    return (x.protocol === 'https:' || x.protocol === 'http:') && !!x.hostname && x.hostname.includes('.');
  } catch (e) { return false; }
}
export function genericUrl(u) {
  try {
    const x = new URL(u.trim());
    return (x.pathname === '/' || x.pathname === '') && !x.search;
  } catch (e) { return false; }
}

// ---- derived classification ----
function lensFor(r) {
  if (r.collection !== 'external_media') return null;
  const role = r.sreepriyaRole || '';
  if (/^Author|Co-author/i.test(role)) return 'By Sreepriya';
  if (/Appointment|honouree|^Profile subject|Named profile/i.test(role)) return 'Recognition & Appointments';
  if (/Interview/i.test(role)) return 'In Conversation';
  return 'Quoted & Consulted';
}

// Artwork label: the truthful relationship between Sreepriya and the piece.
function roleLabelFor(r) {
  const role = r.sreepriyaRole || '';
  if (r.collection === 'entrust_journal') return 'Published on Entrust Family Office';
  if (r.collection === 'conversations') return /Podcast/i.test(r.format) ? 'On the podcast' : 'In conversation';
  if (/^Author$/i.test(role)) return 'Written for';
  if (/Co-author/i.test(role)) return 'A contribution to';
  if (/Interview subject \(reprint\)/i.test(role)) return 'Interview, syndicated copy';
  if (/Interview subject/i.test(role)) return 'Interviewed by';
  if (/Interview \/ profile/i.test(role)) return 'Interview & profile';
  if (/^Profile subject|Named profile/i.test(role)) return 'Profiled in';
  if (/reprint/i.test(role)) return 'Quoted in, syndicated copy';
  if (/Quoted/i.test(role)) return 'Quoted in';
  if (/Expert respondent/i.test(role)) return 'Consulted by';
  if (/Named speaker/i.test(role)) return 'Speaker listing';
  if (/honouree/i.test(role)) return 'Honoured in';
  if (/Ranking/i.test(r.format)) return 'Listed by';
  if (/Appointment/i.test(role)) return 'Reported by';
  return 'Featured in';
}

function creditFor(r) {
  const role = r.sreepriyaRole || '';
  if (r.collection === 'entrust_journal') return 'By Sreepriya N S';
  if (r.collection === 'conversations') return /Joint appearance with Rajmohan/i.test(r.notes || '') ? 'Sreepriya N S with Rajmohan Krishnan' : 'Guest: Sreepriya N S';
  if (/^Author$/i.test(role)) return 'By Sreepriya N S';
  if (/Co-author/i.test(role)) return 'Contribution by Sreepriya N S';
  if (/Interview/i.test(role)) return 'With Sreepriya N S';
  if (/Profile/i.test(role)) return 'Sreepriya N S';
  if (/Quoted/i.test(role)) return 'Comment from Sreepriya N S';
  if (/respondent/i.test(role)) return 'Sreepriya N S, among the experts consulted';
  if (/speaker/i.test(role)) return 'Sreepriya N S, named speaker';
  return 'Sreepriya N S';
}

function milestoneKind(r) {
  if (/Chief Executive|\bCEO\b|names co-founder|Elevates|promote/i.test(r.title)) return 'Appointment';
  if (/Ranking/i.test(r.format) || /Most Promising/i.test(r.title)) return 'Listing';
  if (/honouree|Impactful Women Leaders|Fab List|Awards/i.test(r.sreepriyaRole + ' ' + r.title)) return 'Recognition';
  if (/Leadership Engagements/i.test(r.title)) return 'Engagement';
  if (/profile/i.test(r.sreepriyaRole)) return 'Profile';
  return 'Recognition';
}

function journalSeries(r) {
  if (r.collection !== 'entrust_journal') return null;
  const t = r.title;
  if (/Mandate\s*[–-]\s*Story|Case Study/i.test(t)) return 'Mandate Stories & Case Studies';
  if (/Philanthrop/i.test(r.topic) || /Foundation|Philanthropy|Give Differently|Academy|Aishwarya Trust|Joy of Reading|Children at the Heart|Women at the Heart/i.test(t)) return 'Philanthropy';
  if (/Heir|Millennial|Next Generation|First-Gen|Stewardship/i.test(t)) return 'Next-Generation Readiness';
  if (/NRI|cross-border/i.test(r.topic) || /Singapore|Golden Visa|Ghar Wapasi|NRI/i.test(t)) return 'Cross-Border Decisions';
  if (/Constitution|Charter|Trust|Trustee|Governance|Estate|Equalisation|Custodianship|Gatekeeper|Will\b|Insurance as an Estate/i.test(t)) return 'Governance Explainers';
  return 'Perspectives & Practice';
}

function shelfFor(r) {
  const t = r.title, topic = r.topic || '';
  if (/Philanthropy/i.test(topic)) return 'Philanthropy & Responsibility';
  if (/Heir|Millennial|Next Generation|Younger|First-Gen|next generation/i.test(t)) return 'Next Generation';
  if (/NRI|cross-border/i.test(topic)) return 'Cross-Border Families';
  if (/^Women/i.test(topic)) return 'Women & Wealth';
  if (/^Family offices/i.test(topic)) return 'Family Office Explained';
  if (/^Succession/i.test(topic)) return 'Succession & Continuity';
  return null; // Leadership and professional profile: left unshelved, topic shown as-is
}

function recommendedFamily(r) {
  if (r.collection === 'entrust_journal') return 'journal';
  if (r.collection === 'conversations') return 'conversation';
  const lens = lensFor(r);
  if (lens === 'By Sreepriya') return 'byline';
  if (lens === 'In Conversation') return 'conversation';
  if (lens === 'Recognition & Appointments') return 'milestone';
  return 'press';
}

function ctaFor(r) {
  if (r.collection === 'entrust_journal') return 'Read on Entrust';
  if (r.collection === 'conversations') return /Podcast/i.test(r.format) ? 'Listen to the episode' : 'Watch the conversation';
  const lens = lensFor(r);
  if (lens === 'In Conversation') return 'Read the interview';
  if (lens === 'Recognition & Appointments') return 'Read the announcement';
  return 'Read the article';
}

function attributionFor(r) {
  const o = r.outlet;
  if (r.collection === 'entrust_journal') return 'By Sreepriya N S, published on Entrust Family Office';
  if (r.collection === 'conversations') return `Sreepriya N S, guest on ${o}`;
  const role = r.sreepriyaRole;
  if (/^Author$/i.test(role)) return `Written by Sreepriya N S for ${o}`;
  if (/Co-author/i.test(role)) return `Contribution by Sreepriya N S, ${o}`;
  if (/Interview|Profile/i.test(role)) return `${o}, interview / profile featuring Sreepriya N S`;
  if (/Quoted|respondent/i.test(role)) return `Sreepriya N S quoted in ${o}`;
  if (/speaker/i.test(role)) return `${o} names Sreepriya N S as a speaker`;
  return `${o}, ${r.format.toLowerCase()} naming Sreepriya N S`;
}

export function teaserDraft(r) {
  const t = r.title.replace(/\s+/g, ' ').trim();
  const o = r.outlet;
  if (r.collection === 'entrust_journal') return `On the Entrust Family Office journal, by Sreepriya N S: “${t}”`;
  if (r.collection === 'conversations') return /Podcast/i.test(r.format) ? `Sreepriya N S, guest on ${o}: “${t}”` : `Sreepriya N S in conversation with ${o}: “${t}”`;
  const role = r.sreepriyaRole;
  if (/^Author$/i.test(role)) return `Sreepriya N S writes for ${o}: “${t}”`;
  if (/Co-author/i.test(role)) return `A contribution by Sreepriya N S for ${o}: “${t}”`;
  if (/Interview|Profile/i.test(role)) return `Featured in ${o}: “${t}”`;
  if (/respondent/i.test(role)) return `Sreepriya N S is among the experts consulted by ${o}: “${t}”`;
  if (/Quoted/i.test(role)) return `Sreepriya N S is quoted in ${o}: “${t}”`;
  if (/speaker/i.test(role)) return `${o} lists Sreepriya N S among the speakers: “${t}”`;
  return `Recorded in ${o}: “${t}”`;
}

function backupPurpose(r) {
  if (!r.backupUrl) return null;
  if (r.backupUrl === r.primaryUrl) return 'Same file as the primary link; the archive lists it in both fields';
  const n = r.notes || '';
  if (/\.pdf/i.test(r.backupUrl)) {
    if (/Partner-hosted/i.test(n)) return 'Partner-hosted PDF copy';
    if (/printout/i.test(n)) return 'Entrust-hosted publisher printout (PDF)';
    return 'PDF copy of the piece';
  }
  if (/archive summary/i.test(n)) return 'Entrust archive summary, not the full article text';
  if (/Entrust copy/i.test(n) || /entrustfamilyoffice\.com\/news/i.test(r.backupUrl)) return 'Entrust-hosted copy / listing';
  return 'Backup copy';
}

function accessKind(r) {
  const a = r.access || '';
  if (/subscription/i.test(a)) return { code: 'subscription', label: 'Subscription required' };
  if (/restricts automated/i.test(a)) return { code: 'restricted', label: 'Publisher restricts automated access' };
  if (/PDF copy/i.test(a)) return { code: 'pdf', label: 'PDF copy; publisher content limited' };
  return { code: 'live', label: 'Live page' };
}

export function buildArchive(json) {
  if (!json || !Array.isArray(json.records)) throw new Error('This file has no "records" list. Load Sreepriya_Media_Data.json or a file with the same structure.');
  const errors = [];
  const records = [];
  const seen = new Set();
  for (const raw of json.records) {
    if (!raw || typeof raw.id !== 'string' || !raw.title || !COLLECTIONS[raw.collection]) { errors.push(`Skipped a row without id/title/collection${raw && raw.id ? ' (' + raw.id + ')' : ''}`); continue; }
    if (seen.has(raw.id)) { errors.push(`Duplicate id ${raw.id} skipped`); continue; }
    seen.add(raw.id);
    const src = Object.freeze({ ...raw });
    const d = {
      lens: lensFor(src),
      roleLabel: roleLabelFor(src),
      credit: creditFor(src),
      shelf: shelfFor(src),
      series: journalSeries(src),
      family: recommendedFamily(src),
      cta: ctaFor(src),
      attribution: attributionFor(src),
      milestoneKind: milestoneKind(src),
      backupPurpose: backupPurpose(src),
      access: accessKind(src),
      syndicated: /Syndicated copy/i.test(src.format) || /reprint/i.test(src.sreepriyaRole) || (/Syndicated reporting/i.test(src.format) && !!src.relatedRecord),
      syndicatedReporting: /Syndicated/i.test(src.format),
      needsMastheadCheck: /discrepancy|requires confirmation/i.test(src.notes || ''),
      jointWithRajmohan: /Joint appearance with Rajmohan/i.test(src.notes || ''),
      sortKey: sortKey(src),
      dateLabel: fmtDate(src.date),
      qualifiedDate: dateIsQualified(src),
    };
    records.push(Object.freeze({ src, d: Object.freeze(d), id: src.id }));
  }
  const byId = new Map(records.map((r) => [r.id, r]));
  // relations: explicit relatedRecord plus inverse links, plus PowerUp pair
  const relations = new Map();
  const addRel = (a, b, why) => { if (!byId.has(a) || !byId.has(b)) return; if (!relations.has(a)) relations.set(a, []); relations.get(a).push({ id: b, why }); };
  for (const r of records) {
    if (r.src.relatedRecord) {
      const why = r.d.syndicated ? 'Syndicated copy of' : r.src.collection === 'entrust_journal' ? 'Same title placed externally as' : 'Related record';
      addRel(r.id, r.src.relatedRecord, why);
      addRel(r.src.relatedRecord, r.id, r.d.syndicated ? 'Has a syndicated copy at' : 'Related placement');
    }
  }
  const powerup = records.filter((r) => /Two PowerUp URLs/i.test(r.src.notes || ''));
  if (powerup.length === 2) { addRel(powerup[0].id, powerup[1].id, 'May be the same appearance as'); addRel(powerup[1].id, powerup[0].id, 'May be the same appearance as'); }

  const reviewOnly = Array.isArray(json.reviewOnly) ? json.reviewOnly.filter((x) => x && x.id) : [];
  const reviewIds = new Set(reviewOnly.map((x) => x.id));
  const pub = records.filter((r) => !reviewIds.has(r.id));
  const counts = {
    external_media: pub.filter((r) => r.src.collection === 'external_media').length,
    entrust_journal: pub.filter((r) => r.src.collection === 'entrust_journal').length,
    conversations: pub.filter((r) => r.src.collection === 'conversations').length,
  };
  counts.total = counts.external_media + counts.entrust_journal + counts.conversations;
  counts.review = reviewOnly.length;
  const expected = json.recordCounts || null;
  return {
    meta: { project: json.project || '', asOf: json.asOf || '', sourceWorkbook: json.sourceWorkbook || '', schemaVersion: json.schemaVersion || '', sourceNotes: json.sourceNotes || [], expected },
    records: pub, byId: new Map(pub.map((r) => [r.id, r])), relations, reviewOnly, counts, errors,
  };
}
