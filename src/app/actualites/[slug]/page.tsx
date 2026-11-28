import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui';
import { ARTICLE_CATEGORIES, fetchArticle } from '@/lib/data/articles';
import { siteUrl } from '@/lib/env';
import { formatDate } from '@/lib/format';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await fetchArticle(slug);
  if (!article) return { title: 'Article introuvable' };
  const description = article.excerpt ?? article.body.slice(0, 160).replace(/\s+/g, ' ');
  return {
    title: article.title,
    description,
    alternates: { canonical: `/actualites/${article.slug}` },
    openGraph: {
      type: 'article',
      title: article.title,
      description,
      publishedTime: article.published_at,
      modifiedTime: article.updated_at,
      images: article.cover_url ? [{ url: article.cover_url }] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await fetchArticle(slug);
  if (!article) notFound();

  const paragraphs = article.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.excerpt ?? undefined,
    image: article.cover_url ? [article.cover_url] : undefined,
    datePublished: article.published_at,
    dateModified: article.updated_at,
    mainEntityOfPage: `${siteUrl()}/actualites/${article.slug}`,
    publisher: { '@type': 'Organization', name: 'ESPORT HUB' },
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <p className="mb-4 text-sm">
        <Link href="/actualites" className="text-[var(--accent-blue)] hover:underline">← Actualités</Link>
      </p>
      <article>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          <Badge tone="neutral">{ARTICLE_CATEGORIES[article.category] ?? article.category}</Badge>
          {article.game && <Link href={`/jeux/${article.game.slug}`} className="hover:text-white">{article.game.name}</Link>}
          <time dateTime={article.published_at}>{formatDate(article.published_at)}</time>
        </div>
        <h1 className="text-3xl font-bold leading-tight md:text-4xl">{article.title}</h1>
        {article.excerpt && <p className="mt-4 text-lg text-zinc-300">{article.excerpt}</p>}
        {article.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={article.cover_url} alt="" className="mt-6 w-full rounded-2xl object-cover" />
        )}
        <div className="mt-8 space-y-4 leading-relaxed text-zinc-200">
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="whitespace-pre-line break-words">{paragraph}</p>
          ))}
        </div>
        {article.source_name && (
          <p className="mt-8 border-t border-[var(--border)] pt-4 text-sm text-zinc-400">
            Source :{' '}
            {article.source_url ? (
              <a href={article.source_url} target="_blank" rel="noopener noreferrer nofollow" className="text-[var(--accent-blue)] hover:underline">{article.source_name}</a>
            ) : (
              article.source_name
            )}
          </p>
        )}
      </article>
    </main>
  );
}
