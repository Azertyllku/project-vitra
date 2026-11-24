/** Message lisible d'une erreur d'Edge Function (le corps JSON contient `message`). */
export async function readFunctionError(error: unknown, fallback = 'Opération impossible pour le moment, réessayez plus tard.'): Promise<string> {
  const context = (error as { context?: Response }).context;
  if (context && typeof context.json === 'function') {
    try {
      const body = await context.json();
      if (typeof body?.message === 'string') return body.message;
    } catch {
      // corps non JSON
    }
  }
  return fallback;
}
