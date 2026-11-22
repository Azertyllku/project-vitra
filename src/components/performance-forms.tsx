'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const input = 'w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 outline-none focus:border-[var(--accent)]';
const primary = 'rounded-lg bg-[var(--accent)] px-4 py-2 font-medium hover:brightness-110 disabled:opacity-60';
const ghost = 'rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-white/5 disabled:opacity-60';

function FormError({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
      {message}
    </p>
  ) : null;
}

async function currentUserId(): Promise<string | null> {
  const { data } = await createClient().auth.getUser();
  return data.user?.id ?? null;
}

/* ---------- Ajout d'un compte de jeu ---------- */

export function AddAccountForm({ games, playerId }: { games: { id: string; slug: string; name: string }[]; playerId: string | null }) {
  const router = useRouter();
  const [gameId, setGameId] = useState(games[0]?.id ?? '');
  const [provider, setProvider] = useState('manual');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const game = games.find((g) => g.id === gameId);
  const hasOpenDota = game?.slug === 'dota-2';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const displayName = String(data.get('display_name') ?? '').trim();
    const externalRaw = String(data.get('external_id') ?? '').trim();
    const region = String(data.get('region') ?? '').trim() || null;

    if (provider === 'manual' && (displayName.length < 1 || displayName.length > 40)) return setError('Indiquez le pseudo de ce compte (1 à 40 caractères).');
    if (provider === 'opendota' && !/^[0-9]{1,12}$/.test(externalRaw)) return setError('L\u2019ID de compte Dota 2 est un nombre (ex. 12345678).');

    setPending(true);
    setError(null);
    const userId = await currentUserId();
    if (!userId) {
      router.push('/connexion?next=/profil/performances');
      return;
    }
    const { error: failure } = await createClient()
      .from('player_game_accounts')
      .insert({
        profile_id: userId,
        player_id: playerId,
        game_id: gameId,
        provider,
        // Compte déclaré : identifiant interne aléatoire (aucun identifiant réel ne peut être "squatté").
        external_id: provider === 'manual' ? crypto.randomUUID() : externalRaw,
        display_name: displayName || null,
        region,
      });
    setPending(false);
    if (failure) return setError(failure.code === '23505' ? 'Ce compte est déjà ajouté.' : 'Ajout impossible, réessayez.');
    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2" noValidate>
      <label className="text-sm">
        <span className="mb-1 block text-zinc-300">Jeu</span>
        <select value={gameId} onChange={(e) => { setGameId(e.target.value); setProvider('manual'); }} className={input}>
          {games.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-zinc-300">Type de compte</span>
        <select value={provider} onChange={(e) => setProvider(e.target.value)} className={input}>
          <option value="manual">Déclaré manuellement</option>
          {hasOpenDota && <option value="opendota">Import OpenDota (ID de compte Dota 2)</option>}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-zinc-300">Pseudo en jeu {provider === 'opendota' ? '(facultatif)' : ''}</span>
        <input name="display_name" maxLength={40} className={input} />
      </label>
      {provider === 'opendota' ? (
        <label className="text-sm">
          <span className="mb-1 block text-zinc-300">ID de compte Dota 2 (numérique)</span>
          <input name="external_id" inputMode="numeric" className={input} />
        </label>
      ) : (
        <label className="text-sm">
          <span className="mb-1 block text-zinc-300">Région (facultatif)</span>
          <input name="region" maxLength={20} className={input} />
        </label>
      )}
      <div className="sm:col-span-2">
        <FormError message={error} />
        <button type="submit" disabled={pending} className={`${primary} mt-2`}>Ajouter le compte</button>
      </div>
    </form>
  );
}

/* ---------- Saisie manuelle d'une partie ---------- */

export interface StatDef {
  key: string;
  label: string;
  unit: string | null;
}

export function AddMatchForm({ accountId, gameId, definitions }: { accountId: string; gameId: string; definitions: StatDef[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    const when = new Date(String(data.get('played_at') ?? ''));
    if (Number.isNaN(when.getTime())) return setError('Indiquez la date et l\u2019heure de la partie.');
    if (when.getTime() > Date.now() + 5 * 60_000) return setError('La partie ne peut pas se situer dans le futur.');
    if (when.getFullYear() < 2000) return setError('Date invalide.');

    const minutes = String(data.get('duration') ?? '').trim();
    const duration = minutes ? Math.round(Number(minutes) * 60) : null;
    if (duration !== null && (!Number.isFinite(duration) || duration <= 0)) return setError('Durée invalide.');

    const stats: Record<string, number> = {};
    for (const def of definitions) {
      const raw = String(data.get(`stat_${def.key}`) ?? '').trim();
      if (!raw) continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) return setError(`Valeur invalide pour « ${def.label} ».`);
      stats[def.key] = value;
    }

    setPending(true);
    setError(null);
    const userId = await currentUserId();
    if (!userId) {
      router.push('/connexion?next=/profil/performances');
      return;
    }
    const text = (name: string) => String(data.get(name) ?? '').trim().slice(0, 60) || null;
    const { error: failure } = await createClient()
      .from('player_match_history')
      .insert({
        profile_id: userId,
        account_id: accountId,
        game_id: gameId,
        external_match_id: `manual-${crypto.randomUUID()}`,
        played_at: when.toISOString(),
        duration_seconds: duration,
        result: String(data.get('result')),
        map_name: text('map_name'),
        character_name: text('character_name'),
        role_name: text('role_name'),
        stats,
        data_source: 'manual',
      });
    setPending(false);
    if (failure) return setError('Enregistrement impossible, réessayez.');
    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm"><span className="mb-1 block text-zinc-300">Date et heure</span><input type="datetime-local" name="played_at" className={input} /></label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-300">Résultat</span>
          <select name="result" defaultValue="win" className={input}>
            <option value="win">Victoire</option>
            <option value="loss">Défaite</option>
            <option value="draw">Égalité</option>
            <option value="unknown">Inconnu</option>
          </select>
        </label>
        <label className="text-sm"><span className="mb-1 block text-zinc-300">Durée (minutes)</span><input type="number" name="duration" min="1" step="1" className={input} /></label>
        <label className="text-sm"><span className="mb-1 block text-zinc-300">Carte (facultatif)</span><input name="map_name" maxLength={60} className={input} /></label>
        <label className="text-sm"><span className="mb-1 block text-zinc-300">Personnage (facultatif)</span><input name="character_name" maxLength={60} className={input} /></label>
        <label className="text-sm"><span className="mb-1 block text-zinc-300">Rôle (facultatif)</span><input name="role_name" maxLength={60} className={input} /></label>
      </div>
      {definitions.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm text-zinc-300">Statistiques (laissez vide ce que vous ne connaissez pas)</legend>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {definitions.map((def) => (
              <label key={def.key} className="text-sm">
                <span className="mb-1 block text-zinc-400">{def.label}{def.unit ? ` (${def.unit})` : ''}</span>
                <input type="number" name={`stat_${def.key}`} min="0" step="any" className={input} />
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <FormError message={error} />
      <button type="submit" disabled={pending} className={primary}>Enregistrer la partie</button>
    </form>
  );
}

/* ---------- Synchronisation via connecteur ---------- */

async function readFunctionError(error: unknown): Promise<string> {
  const context = (error as { context?: Response }).context;
  if (context && typeof context.json === 'function') {
    try {
      const body = await context.json();
      if (typeof body?.message === 'string') return body.message;
    } catch {
      // corps non JSON
    }
  }
  return 'Synchronisation impossible pour le moment, réessayez plus tard.';
}

export function SyncButton({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function onClick() {
    setPending(true);
    setMessage(null);
    const { data, error } = await createClient().functions.invoke('sync-account', { body: { account_id: accountId } });
    setPending(false);
    if (error) {
      setMessage({ ok: false, text: await readFunctionError(error) });
      return;
    }
    setMessage({ ok: true, text: `${data?.inserted ?? 0} nouvelle(s) partie(s) importée(s) sur ${data?.fetched ?? 0} récupérée(s).` });
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={onClick} disabled={pending} className={ghost}>{pending ? 'Synchronisation…' : 'Synchroniser maintenant'}</button>
      {message && <span role="status" className={`text-sm ${message.ok ? 'text-emerald-300' : 'text-red-300'}`}>{message.text}</span>}
    </div>
  );
}

/* ---------- Suppressions (avec confirmation) ---------- */

export function DeleteMatchButton({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function onClick() {
    if (!window.confirm('Supprimer cette partie saisie manuellement ?')) return;
    setPending(true);
    await createClient().from('player_match_history').delete().eq('id', matchId);
    router.refresh();
  }
  return <button type="button" onClick={onClick} disabled={pending} className="text-xs text-zinc-400 hover:text-red-300 disabled:opacity-60">Supprimer</button>;
}

export function DeleteAccountButton({ accountId, name }: { accountId: string; name: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function onClick() {
    if (!window.confirm(`Supprimer le compte « ${name} » et tout son historique de parties ? Cette action est définitive.`)) return;
    setPending(true);
    await createClient().from('player_game_accounts').delete().eq('id', accountId);
    router.push('/profil/performances');
    router.refresh();
  }
  return <button type="button" onClick={onClick} disabled={pending} className={ghost}>Supprimer ce compte</button>;
}

/* ---------- Profil joueur public ---------- */

export function CreatePlayerProfileForm({ username }: { username: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nickname = String(data.get('nickname') ?? '').trim();
    const country = String(data.get('country') ?? '').trim().toUpperCase();
    if (nickname.length < 2 || nickname.length > 30) return setError('Le pseudo doit contenir 2 à 30 caractères.');
    if (country && !/^[A-Z]{2}$/.test(country)) return setError('Code pays à 2 lettres (ex. FR).');

    setPending(true);
    setError(null);
    const userId = await currentUserId();
    if (!userId) {
      router.push('/connexion?next=/profil/performances');
      return;
    }
    const base = username.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'joueur';
    const supabase = createClient();
    let failure: { code?: string } | null = null;
    for (const slug of [base, `${base}-${Math.random().toString(36).slice(2, 6)}`]) {
      const { error: attempt } = await supabase
        .from('players')
        .insert({ profile_id: userId, slug, nickname, country_code: country || null, is_professional: false });
      failure = attempt;
      if (!attempt || attempt.code !== '23505') break;
    }
    setPending(false);
    if (failure) return setError('Création impossible, réessayez.');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3" noValidate>
      <label className="text-sm"><span className="mb-1 block text-zinc-300">Pseudo public</span><input name="nickname" defaultValue={username} maxLength={30} className={input} /></label>
      <label className="text-sm"><span className="mb-1 block text-zinc-300">Pays (code, facultatif)</span><input name="country" maxLength={2} className={`${input} w-24 uppercase`} /></label>
      <button type="submit" disabled={pending} className={primary}>Créer mon profil joueur</button>
      <div className="w-full"><FormError message={error} /></div>
    </form>
  );
}
