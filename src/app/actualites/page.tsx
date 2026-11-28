import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Card, EmptyState, ErrorState, FilterTabs, PageHeader, Pager } from '@/components/ui';
import { ARTICLE_CATEGORIES, fetchArticles } from '@/lib/data/articles';
import { formatDate } from '@/lib/format';
import { one, pageNumber } from '@/lib/params';

export const metadata: Metadata = {
  title: 'Actualités',
  description: 'Actualités esport : résultats, transferts, analyses et interviews.',
  alternates: { canonical: '/actualites' },
};

const PAGE_SIZE = 12;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ActualitesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const category = one(sp.categorie) && ARTICLE_CATEGORIES[one(sp.categorie) as string] ? (one(sp.categorie) as string) : undefined;
  const page = pageNumber(sp.page);
  const { articles, hasMore, failed } = await fetchArticles({ category, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <PageHeader title="Actualités" subtitle="Résultats, transferts, analyses et interviews." />
      <FilterTabs
        items={[
          { label: 'Tout', href: '/actualites', active: !category },
          ...Object.entries(ARTICLE_CATEGORIES).map(([key, label]) => ({ label, href: `/actualites?categorie=${key}`, active: category === key })),
        ]}
      />

      <div className="mt-8">
        {failed ? (
          <ErrorState />
        ) : articles.length === 0 ? (
          <EmptyState>Aucun article pour le moment.</EmptyState>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <li key={article.id}>
                <Link href={`/actualites/${article.slug}`} className="block h-full">
                  <Card className="flex h-full flex-col overflow-hidden transition hover:border-[var(--accent)]">
                    {article.cover_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={article.cover_url} alt="" loading="lazy" className="aspect-video w-full object-cover" />
                    )}
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                        <Badge tone="neutral">{ARTICLE_CATEGORIES[article.category] ?? article.category}</Badge>
                        {article.game && <span>{article.game.name}</span>}
                        <time dateTime={article.published_at}>{formatDate(article.published_at)}</time>
                      </div>
                      <h2 className="font-semibold leading-snug">{article.title}</h2>
                      {article.excerpt && <p className="line-clamp-3 text-sm text-zinc-400">{article.excerpt}</p>}
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Pager basePath="/actualites" params={category ? { categorie: category } : {}} page={page} hasNext={hasMore} />
    </main>
  );
}
