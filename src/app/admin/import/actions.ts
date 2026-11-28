'use server';

import { revalidatePath } from 'next/cache';
import { logAdmin } from '@/lib/admin/log';
import { parseCsv, slugify, toDate, toInstant } from '@/lib/admin/csv';
import { IMPORT_KINDS, type ImportIssue, type ImportState } from '@/lib/admin/import-types';
import { getViewer } from '@/lib/data/community';
import { createClient } from '@/lib/supabase/server';

const MAX_ROWS = 2000;
const MAX_CHARS = 1_500_000;
const SLUG = /^[a-z0-9-]{1,80}$/;
const REF = /^[A-Za-z0-9._:-]{3,120}$/;
const URL_RE = /^https?:\/\/\S+$/i;

const TOURNAMENT_FORMATS = ['single_elimination', 'double_elimination', 'round_robin', 'swiss', 'groups_playoffs', 'battle_royale', 'other'];
const TOURNAMENT_STATUS = ['upcoming', 'ongoing', 'finished', 'cancelled'];
const MATCH_STATUS = ['scheduled', 'finished', 'postponed', 'cancelled'];
const TEAM_ROLES = ['player', 'substitute', 'coach', 'analyst', 'manager'];
const VOD_KINDS = ['full', 'highlight', 'best_play', 'summary'];
const RIGHTS = ['pending', 'authorized', 'revoked'];
const VOD_REFS: Record<string, RegExp> = {
  youtube_video: /^[A-Za-z0-9_-]{11}$/,
  twitch_video: /^[0-9]{5,15}$/,
  hls: /^https:\/\/[^\s"'<>]+$/,
};

type Client = Awaited<ReturnType<typeof createClient>>;
type Rec = Record<string, string>;
type Obj = Record<string, unknown>;
type Outcome = { processed: number; ignored: number; issues: ImportIssue[] };
type Writer = (rows: Obj[]) => PromiseLike<{ error: { message: string } | null }>;

const chunk = <T,>(items: T[], size: number): T[][] => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

async function loadMap(supabase: Client, table: string, key: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(`id, ${key}`).order('id').range(from, from + 999).returns<Record<string, string | null>[]>();
    if (error || !data) break;
    for (const row of data) if (row[key] && row.id) map.set(row[key] as string, row.id);
    if (data.length < 1000) break;
  }
  return map;
}

const resolve = (map: Map<string, string>, value: string | undefined) => (value ? (map.get(value) ?? map.get(slugify(value))) : undefined);

async function write(rows: Obj[], run: Writer, issues: ImportIssue[]): Promise<number> {
  let done = 0;
  for (const part of chunk(rows, 200)) {
    const { error } = await run(part);
    if (error) issues.push({ line: 0, message: `Lot refusé par la base : ${error.message}` });
    else done += part.length;
  }
  return done;
}

const optional = (value: string | undefined) => (value && value.trim() ? value.trim() : null);

function country(value: string | undefined, issues: ImportIssue[], line: number): string | null {
  const v = optional(value);
  if (!v) return null;
  if (!/^[A-Za-z]{2}$/.test(v)) {
    issues.push({ line, message: `Code pays invalide : ${v}` });
    return null;
  }
  return v.toUpperCase();
}

function link(value: string | undefined, label: string, issues: ImportIssue[], line: number): string | null {
  const v = optional(value);
  if (!v) return null;
  if (!URL_RE.test(v) || v.length > 500) {
    issues.push({ line, message: `${label} : URL http(s) invalide.` });
    return null;
  }
  return v;
}

function integer(value: string | undefined, label: string, min: number, max: number, issues: ImportIssue[], line: number): number | null | undefined {
  const v = optional(value);
  if (!v) return null;
  const number = Number(v);
  if (!Number.isInteger(number) || number < min || number > max) {
    issues.push({ line, message: `${label} : entier entre ${min} et ${max} attendu.` });
    return undefined;
  }
  return number;
}

/* ---------- Équipes ---------- */
async function importTeams(supabase: Client, rows: Rec[], dry: boolean): Promise<Outcome> {
  const issues: ImportIssue[] = [];
  const valid = new Map<string, Obj>();
  rows.forEach((r, index) => {
    const line = index + 2;
    const before = issues.length;
    const name = optional(r.name);
    if (!name) return void issues.push({ line, message: 'Nom obligatoire.' });
    const slug = optional(r.slug) ?? slugify(name);
    if (!SLUG.test(slug)) return void issues.push({ line, message: `Slug invalide : ${slug}` });
    const row: Obj = { slug, name: name.slice(0, 80), tag: optional(r.tag)?.slice(0, 10) ?? null, country_code: country(r.country_code, issues, line), logo_url: link(r.logo_url, 'logo_url', issues, line), description: optional(r.description)?.slice(0, 4000) ?? null, is_active: true };
    if (issues.length === before) valid.set(slug, row);
  });
  const list = [...valid.values()];
  const processed = dry ? list.length : await write(list, (part) => supabase.from('teams').upsert(part, { onConflict: 'slug' }), issues);
  return { processed, ignored: 0, issues };
}

/* ---------- Joueurs ---------- */
async function importPlayers(supabase: Client, rows: Rec[], dry: boolean): Promise<Outcome> {
  const issues: ImportIssue[] = [];
  const valid = new Map<string, Obj>();
  rows.forEach((r, index) => {
    const line = index + 2;
    const before = issues.length;
    const nickname = optional(r.nickname);
    if (!nickname) return void issues.push({ line, message: 'Pseudo obligatoire.' });
    const slug = optional(r.slug) ?? slugify(nickname);
    if (!SLUG.test(slug)) return void issues.push({ line, message: `Slug invalide : ${slug}` });
    const pro = (optional(r.is_professional) ?? 'true').toLowerCase();
    if (!['true', 'false', '1', '0', 'oui', 'non'].includes(pro)) issues.push({ line, message: 'is_professional : true ou false attendu.' });
    const row: Obj = {
      slug, nickname: nickname.slice(0, 40), real_name: optional(r.real_name)?.slice(0, 80) ?? null, country_code: country(r.country_code, issues, line),
      photo_url: link(r.photo_url, 'photo_url', issues, line), bio: optional(r.bio)?.slice(0, 4000) ?? null, is_professional: ['true', '1', 'oui'].includes(pro), is_active: true,
    };
    if (issues.length === before) valid.set(slug, row);
  });
  const list = [...valid.values()];
  const processed = dry ? list.length : await write(list, (part) => supabase.from('players').upsert(part, { onConflict: 'slug' }), issues);
  return { processed, ignored: 0, issues };
}

/* ---------- Effectifs ---------- */
async function importRosters(supabase: Client, rows: Rec[], dry: boolean): Promise<Outcome> {
  const issues: ImportIssue[] = [];
  const [teams, players, games] = await Promise.all([loadMap(supabase, 'teams', 'slug'), loadMap(supabase, 'players', 'slug'), loadMap(supabase, 'games', 'slug')]);
  const candidates: { key: string; row: Obj }[] = [];
  rows.forEach((r, index) => {
    const line = index + 2;
    const team = resolve(teams, r.team);
    const player = resolve(players, r.player);
    const game = resolve(games, r.game);
    if (!team) return void issues.push({ line, message: `Équipe inconnue : ${r.team}` });
    if (!player) return void issues.push({ line, message: `Joueur inconnu : ${r.player}` });
    if (!game) return void issues.push({ line, message: `Jeu inconnu : ${r.game}` });
    const role = optional(r.role) ?? 'player';
    if (!TEAM_ROLES.includes(role)) return void issues.push({ line, message: `Rôle invalide : ${role}` });
    const joined = optional(r.joined_at) ? toDate(r.joined_at) : null;
    const left = optional(r.left_at) ? toDate(r.left_at) : null;
    if (optional(r.joined_at) && !joined) return void issues.push({ line, message: 'joined_at : date AAAA-MM-JJ attendue.' });
    if (optional(r.left_at) && !left) return void issues.push({ line, message: 'left_at : date AAAA-MM-JJ attendue.' });
    if (left && (!joined || left < joined)) return void issues.push({ line, message: 'left_at doit suivre joined_at (qui doit alors être renseigné).' });
    candidates.push({ key: `${team}|${player}|${game}|${joined ?? ''}`, row: { team_id: team, player_id: player, game_id: game, role, joined_at: joined, left_at: left } });
  });

  const existing = new Set<string>();
  for (const part of chunk([...new Set(candidates.map((c) => c.row.team_id as string))], 50)) {
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase.from('team_members').select('team_id, player_id, game_id, joined_at').in('team_id', part).order('id').range(from, from + 999).returns<{ team_id: string; player_id: string; game_id: string; joined_at: string | null }[]>();
      (data ?? []).forEach((m) => existing.add(`${m.team_id}|${m.player_id}|${m.game_id}|${m.joined_at ?? ''}`));
      if (!data || data.length < 1000) break;
    }
  }
  const seen = new Set<string>();
  const fresh: Obj[] = [];
  let ignored = 0;
  for (const candidate of candidates) {
    if (existing.has(candidate.key) || seen.has(candidate.key)) ignored++;
    else {
      seen.add(candidate.key);
      fresh.push(candidate.row);
    }
  }
  const processed = dry ? fresh.length : await write(fresh, (part) => supabase.from('team_members').insert(part), issues);
  return { processed, ignored, issues };
}

/* ---------- Tournois ---------- */
async function importTournaments(supabase: Client, rows: Rec[], dry: boolean, provenance: string): Promise<Outcome> {
  const issues: ImportIssue[] = [];
  const games = await loadMap(supabase, 'games', 'slug');
  const valid = new Map<string, Obj>();
  rows.forEach((r, index) => {
    const line = index + 2;
    const before = issues.length;
    const name = optional(r.name);
    if (!name) return void issues.push({ line, message: 'Nom obligatoire.' });
    const game = resolve(games, r.game);
    if (!game) return void issues.push({ line, message: `Jeu inconnu : ${r.game}` });
    const slug = optional(r.slug) ?? slugify(name);
    if (!SLUG.test(slug)) return void issues.push({ line, message: `Slug invalide : ${slug}` });
    const format = optional(r.format) ?? 'single_elimination';
    if (!TOURNAMENT_FORMATS.includes(format)) issues.push({ line, message: `Format invalide : ${format}` });
    const status = optional(r.status) ?? 'upcoming';
    if (!TOURNAMENT_STATUS.includes(status)) issues.push({ line, message: `Statut invalide : ${status}` });
    const starts = optional(r.starts_at) ? toInstant(r.starts_at) : null;
    const ends = optional(r.ends_at) ? toInstant(r.ends_at) : null;
    if (optional(r.starts_at) && !starts) issues.push({ line, message: 'starts_at : date invalide.' });
    if (optional(r.ends_at) && !ends) issues.push({ line, message: 'ends_at : date invalide.' });
    if (starts && ends && ends < starts) issues.push({ line, message: 'ends_at précède starts_at.' });
    const prizeText = optional(r.prize_pool);
    const prize = prizeText ? Number(prizeText.replace(',', '.')) : null;
    if (prizeText && (prize === null || !Number.isFinite(prize) || prize < 0)) issues.push({ line, message: 'prize_pool : nombre positif attendu.' });
    const currency = optional(r.currency);
    if (currency && !/^[A-Za-z]{3}$/.test(currency)) issues.push({ line, message: 'currency : code à 3 lettres attendu.' });
    const row: Obj = {
      slug, name: name.slice(0, 120), game_id: game, organizer: optional(r.organizer)?.slice(0, 80) ?? null, format, status, region: optional(r.region)?.slice(0, 60) ?? null,
      starts_at: starts, ends_at: ends, prize_pool: prize, currency: currency ? currency.toUpperCase() : null, description: optional(r.description)?.slice(0, 4000) ?? null,
      logo_url: link(r.logo_url, 'logo_url', issues, line), data_source: provenance,
    };
    if (issues.length === before) valid.set(slug, row);
  });
  const list = [...valid.values()];
  const processed = dry ? list.length : await write(list, (part) => supabase.from('tournaments').upsert(part, { onConflict: 'slug' }), issues);
  return { processed, ignored: 0, issues };
}

/* ---------- Matchs ---------- */
async function importMatches(supabase: Client, rows: Rec[], dry: boolean, provenance: string): Promise<Outcome> {
  const issues: ImportIssue[] = [];
  const [games, teams, tournaments] = await Promise.all([loadMap(supabase, 'games', 'slug'), loadMap(supabase, 'teams', 'slug'), loadMap(supabase, 'tournaments', 'slug')]);
  const valid = new Map<string, { match: Obj; slots: { team: string; score: number | null }[] }>();
  rows.forEach((r, index) => {
    const line = index + 2;
    const before = issues.length;
    const ref = optional(r.ref);
    if (!ref || !REF.test(ref)) return void issues.push({ line, message: 'ref obligatoire (3 à 120 caractères : lettres, chiffres, . _ : -).' });
    const game = resolve(games, r.game);
    if (!game) return void issues.push({ line, message: `Jeu inconnu : ${r.game}` });
    const t1 = resolve(teams, r.team1);
    const t2 = resolve(teams, r.team2);
    if (!t1) return void issues.push({ line, message: `Équipe 1 inconnue : ${r.team1}` });
    if (!t2) return void issues.push({ line, message: `Équipe 2 inconnue : ${r.team2}` });
    if (t1 === t2) return void issues.push({ line, message: 'Les deux équipes doivent être différentes.' });
    const s1 = integer(r.score1, 'score1', 0, 999, issues, line);
    const s2 = integer(r.score2, 'score2', 0, 999, issues, line);
    const status = optional(r.status) ?? (s1 != null && s2 != null ? 'finished' : 'scheduled');
    if (!MATCH_STATUS.includes(status)) issues.push({ line, message: `Statut invalide : ${status} (scheduled, finished, postponed, cancelled).` });
    const when = optional(r.scheduled_at) ? toInstant(r.scheduled_at) : null;
    if (optional(r.scheduled_at) && !when) issues.push({ line, message: 'scheduled_at : date invalide.' });
    const bestOf = integer(r.best_of, 'best_of', 1, 9, issues, line);
    let tournament: string | null = null;
    if (optional(r.tournament)) {
      tournament = resolve(tournaments, r.tournament) ?? null;
      if (!tournament) issues.push({ line, message: `Tournoi inconnu : ${r.tournament}` });
    }
    if (issues.length > before) return;
    valid.set(ref, {
      match: { import_key: ref, game_id: game, tournament_id: tournament, status, scheduled_at: when, best_of: bestOf ?? null, round_label: optional(r.round)?.slice(0, 60) ?? null, data_source: provenance },
      slots: [{ team: t1, score: s1 ?? null }, { team: t2, score: s2 ?? null }],
    });
  });

  const list = [...valid.entries()];
  if (dry) return { processed: list.length, ignored: 0, issues };
  let processed = 0;
  for (const part of chunk(list, 100)) {
    const { data, error } = await supabase.from('matches').upsert(part.map(([, v]) => v.match), { onConflict: 'import_key' }).select('id, import_key').returns<{ id: string; import_key: string }[]>();
    if (error || !data) {
      issues.push({ line: 0, message: `Lot de matchs refusé par la base : ${error?.message ?? 'réponse vide'}` });
      continue;
    }
    const slotRows: Obj[] = [];
    for (const saved of data) {
      const entry = valid.get(saved.import_key);
      if (!entry) continue;
      const [a, b] = entry.slots;
      const decided = entry.match.status === 'finished' && a.score != null && b.score != null && a.score !== b.score;
      slotRows.push({ match_id: saved.id, slot: 1, team_id: a.team, score: a.score, is_winner: decided ? (a.score as number) > (b.score as number) : false });
      slotRows.push({ match_id: saved.id, slot: 2, team_id: b.team, score: b.score, is_winner: decided ? (b.score as number) > (a.score as number) : false });
    }
    const { error: slotError } = await supabase.from('match_teams').upsert(slotRows, { onConflict: 'match_id,slot' });
    if (slotError) issues.push({ line: 0, message: `Équipes des matchs refusées : ${slotError.message}` });
    else processed += data.length;
  }
  return { processed, ignored: 0, issues };
}

/* ---------- Rediffusions ---------- */
async function importVods(supabase: Client, rows: Rec[], dry: boolean): Promise<Outcome> {
  const issues: ImportIssue[] = [];
  const [games, tournaments, matches] = await Promise.all([loadMap(supabase, 'games', 'slug'), loadMap(supabase, 'tournaments', 'slug'), loadMap(supabase, 'matches', 'import_key')]);
  const valid = new Map<string, Obj>();
  rows.forEach((r, index) => {
    const line = index + 2;
    const before = issues.length;
    const ref = optional(r.ref);
    if (!ref || !REF.test(ref)) return void issues.push({ line, message: 'ref obligatoire (3 à 120 caractères : lettres, chiffres, . _ : -).' });
    const title = optional(r.title);
    if (!title) return void issues.push({ line, message: 'Titre obligatoire.' });
    const game = resolve(games, r.game);
    if (!game) return void issues.push({ line, message: `Jeu inconnu : ${r.game}` });
    const provider = optional(r.provider) ?? '';
    const embed = optional(r.embed_ref) ?? '';
    if (!VOD_REFS[provider]) return void issues.push({ line, message: `provider invalide : ${provider || '(vide)'} (youtube_video, twitch_video, hls).` });
    if (!VOD_REFS[provider].test(embed)) return void issues.push({ line, message: `embed_ref invalide pour ${provider}.` });
    const kind = optional(r.kind) ?? 'full';
    if (!VOD_KINDS.includes(kind)) issues.push({ line, message: `kind invalide : ${kind}` });
    const rights = optional(r.rights_status) ?? 'pending';
    if (!RIGHTS.includes(rights)) issues.push({ line, message: `rights_status invalide : ${rights}` });
    const holder = optional(r.rights_holder);
    if (rights === 'authorized' && !holder) issues.push({ line, message: 'rights_holder obligatoire pour un contenu authorized.' });
    const language = optional(r.language)?.toLowerCase() ?? null;
    if (language && !/^[a-z]{2}$/.test(language)) issues.push({ line, message: 'language : code à 2 lettres attendu.' });
    const published = optional(r.published_at) ? toInstant(r.published_at) : null;
    if (optional(r.published_at) && !published) issues.push({ line, message: 'published_at : date invalide.' });
    const duration = integer(r.duration_seconds, 'duration_seconds', 1, 86400, issues, line);
    let tournament: string | null = null;
    if (optional(r.tournament)) {
      tournament = resolve(tournaments, r.tournament) ?? null;
      if (!tournament) issues.push({ line, message: `Tournoi inconnu : ${r.tournament}` });
    }
    let match: string | null = null;
    if (optional(r.match_ref)) {
      match = matches.get(r.match_ref.trim()) ?? null;
      if (!match) issues.push({ line, message: `Match inconnu (match_ref) : ${r.match_ref}` });
    }
    const row: Obj = {
      import_key: ref, title: title.slice(0, 160), game_id: game, provider, embed_ref: embed, kind, tournament_id: tournament, match_id: match, language, published_at: published,
      duration_seconds: duration ?? null, rights_status: rights, rights_holder: holder?.slice(0, 120) ?? null, rights_note: optional(r.rights_note)?.slice(0, 1000) ?? null,
      description: optional(r.description)?.slice(0, 4000) ?? null, thumbnail_url: link(r.thumbnail_url, 'thumbnail_url', issues, line),
    };
    if (issues.length === before) valid.set(ref, row);
  });
  const list = [...valid.values()];
  const processed = dry ? list.length : await write(list, (part) => supabase.from('vods').upsert(part, { onConflict: 'import_key' }), issues);
  return { processed, ignored: 0, issues };
}

const fail = (message: string, dryRun = true): ImportState => ({ ok: false, message, dryRun, total: 0, processed: 0, ignored: 0, issues: [] });

/** Import CSV en masse (simulation par défaut). Les lignes invalides sont signalées et ignorées ; les autres sont enregistrées. */
export async function importCsv(_previous: ImportState, form: FormData): Promise<ImportState> {
  const viewer = await getViewer();
  if (!viewer?.isStaff) return fail('Accès réservé à l’équipe.');
  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === 'string' ? value.trim() : '';
  };

  const kind = text('kind');
  const meta = IMPORT_KINDS[kind];
  if (!meta) return fail('Type de données inconnu.');
  const dry = form.getAll('dry').includes('on');
  const source = text('source');
  if (source.length < 3 || source.length > 200) return fail('Indiquez la source des données (3 à 200 caractères).', dry);
  const provenance = text('provenance') === 'manual' ? 'manual' : 'imported';
  const raw = String(form.get('csv') ?? '');
  if (!raw.trim()) return fail('Collez ou chargez un fichier CSV.', dry);
  if (raw.length > MAX_CHARS) return fail('Fichier trop volumineux (1,5 Mo maximum).', dry);

  const parsed = parseCsv(raw);
  if (parsed.error) return fail(parsed.error, dry);
  const missing = meta.required.filter((column) => !parsed.headers.includes(column));
  if (missing.length) return fail(`Colonnes obligatoires absentes : ${missing.join(', ')}.`, dry);
  if (parsed.rows.length > MAX_ROWS) return fail(`${MAX_ROWS} lignes maximum par import.`, dry);

  const supabase = await createClient();
  let outcome: Outcome;
  try {
    if (kind === 'equipes') outcome = await importTeams(supabase, parsed.rows, dry);
    else if (kind === 'joueurs') outcome = await importPlayers(supabase, parsed.rows, dry);
    else if (kind === 'effectifs') outcome = await importRosters(supabase, parsed.rows, dry);
    else if (kind === 'tournois') outcome = await importTournaments(supabase, parsed.rows, dry, provenance);
    else if (kind === 'matchs') outcome = await importMatches(supabase, parsed.rows, dry, provenance);
    else outcome = await importVods(supabase, parsed.rows, dry);
  } catch {
    return fail('Import interrompu par une erreur inattendue, réessayez.', dry);
  }

  if (!dry && outcome.processed > 0) {
    await logAdmin(supabase, viewer.id, 'create', `import:${kind}`, null, `${outcome.processed} lignes — source : ${source}`);
    revalidatePath('/', 'layout');
  }
  const skipped = outcome.issues.length;
  return {
    ok: skipped === 0,
    dryRun: dry,
    total: parsed.rows.length,
    processed: outcome.processed,
    ignored: outcome.ignored,
    issues: outcome.issues.slice(0, 100),
    message: dry
      ? `Simulation : ${outcome.processed} ligne(s) prête(s) à être enregistrée(s), ${skipped} problème(s). Rien n’a été écrit.`
      : `Import terminé : ${outcome.processed} ligne(s) enregistrée(s), ${skipped} problème(s).`,
  };
}
