import { NextResponse, type NextRequest } from 'next/server';
import { searchAll } from '@/lib/search';

export const dynamic = 'force-dynamic';

/** Suggestions de recherche (3 résultats par type, 12 au total). */
export async function GET(request: NextRequest) {
  const hits = await searchAll(request.nextUrl.searchParams.get('q') ?? '', 3);
  return NextResponse.json({ hits: hits.slice(0, 12) });
}
