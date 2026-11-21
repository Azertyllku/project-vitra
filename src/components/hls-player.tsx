'use client';

import { useEffect, useRef, useState } from 'react';
import type Hls from 'hls.js';
import { createClient } from '@/lib/supabase/client';

/**
 * Lecteur HLS (flux autorisés uniquement, URL https). Qualité sélectionnable quand le flux en propose plusieurs.
 * Si vodId est fourni et que le membre est connecté, la progression est enregistrée (reprise de lecture).
 */
export function HlsPlayer({ src, title, startSeconds = 0, vodId }: { src: string; title: string; startSeconds?: number; vodId?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const userIdRef = useRef<string | null>(null);
  const lastSavedRef = useRef(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [selected, setSelected] = useState(-1);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!vodId) return;
    void createClient().auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id ?? null;
    });
  }, [vodId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    setFailed(false);

    const seekToStart = () => {
      if (startSeconds > 0) video.currentTime = startSeconds;
    };

    void (async () => {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;
        video.addEventListener('loadedmetadata', seekToStart, { once: true });
        return;
      }
      const HlsLib = (await import('hls.js')).default;
      if (cancelled) return;
      if (!HlsLib.isSupported()) {
        setFailed(true);
        return;
      }
      const hls = new HlsLib();
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(HlsLib.Events.MANIFEST_PARSED, (_event, data) => {
        setLevels(data.levels.map((level) => level.height).filter((h) => h > 0));
        seekToStart();
      });
      hls.on(HlsLib.Events.ERROR, (_event, data) => {
        if (data.fatal) setFailed(true);
      });
    })();

    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [src, startSeconds]);

  function saveProgress(completed: boolean) {
    const video = videoRef.current;
    const userId = userIdRef.current;
    if (!video || !userId || !vodId) return;
    const seconds = Math.floor(video.currentTime);
    if (!completed && Math.abs(seconds - lastSavedRef.current) < 15) return;
    lastSavedRef.current = seconds;
    void createClient()
      .from('video_views')
      .upsert(
        { user_id: userId, vod_id: vodId, progress_seconds: completed ? 0 : seconds, completed, last_watched_at: new Date().toISOString() },
        { onConflict: 'user_id,vod_id' },
      );
  }

  function changeLevel(index: number) {
    setSelected(index);
    if (hlsRef.current) hlsRef.current.currentLevel = index;
  }

  if (failed) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-2xl border border-[var(--border)] bg-black p-6 text-center text-zinc-400">
        Ce flux ne peut pas être lu par votre navigateur ou est momentanément indisponible.
      </div>
    );
  }

  return (
    <div>
      <video
        ref={videoRef}
        title={title}
        controls
        playsInline
        onTimeUpdate={() => saveProgress(false)}
        onEnded={() => saveProgress(true)}
        className="aspect-video w-full rounded-2xl border border-[var(--border)] bg-black"
      />
      {levels.length > 1 && (
        <label className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
          Qualité
          <select
            value={selected}
            onChange={(event) => changeLevel(Number(event.target.value))}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-zinc-200"
          >
            <option value={-1}>Auto</option>
            {levels.map((height, index) => (
              <option key={`${height}-${index}`} value={index}>
                {height}p
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
