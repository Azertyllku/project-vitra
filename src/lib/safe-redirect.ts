/** N'autorise que les chemins internes (évite les redirections ouvertes). */
export function safeNext(value: FormDataEntryValue | string | null | undefined, fallback = '/profil'): string {
  if (typeof value !== 'string') return fallback;
  return value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : fallback;
}
