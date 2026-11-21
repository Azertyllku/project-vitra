'use client';

import { useEffect, useState } from 'react';
import { HlsPlayer } from '@/components/hls-player';
import { buildEmbedUrl, type EmbedProvider } from '@/lib/embed';

/**
 * Lecteur unique pour les sources autorisées : Twitch et YouTube via leurs intégrations officielles
 * (iframe isolée), HLS via lecteur dédié. La référence est validée avant tout affichage.
 */
export function EmbedPlayer({
  provider,
  embedRef,
  title,
  startSeconds = 0,
  vodId,
}: {
  provider: EmbedProvider;
  embedRef: string;
  title: string;
  startSeconds?: number;
  vodId?: string;
}) {
  const [host, setHost] = useState<string | null>(null);
  useEffect(() => setHost(window.location.hostname), []);

  if (provider === 'hls') {
    return <HlsPlayer src={embedRef} title={title} startSeconds={startSeconds} vodId={vodId} />;
  }

  const url = host ? buildEmbedUrl(provider, embedRef, { parent: host, start: startSeconds }) : null;

  return (
    <div className="aspect-video overflow-hidden rounded-2xl border border-[var(--border)] bg-black">
      {url ? (
        <iframe
          key={url}
          src={url}
          title={title}
          allow="fullscreen; autoplay; picture-in-picture; encrypted-media"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="strict-origin-when-cross-origin"
          className="h-full w-full"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-zinc-500">{host ? 'Source invalide.' : 'Chargement du lecteur…'}</div>
      )}
    </div>
  );
}
