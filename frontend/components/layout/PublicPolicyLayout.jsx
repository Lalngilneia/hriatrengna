import Head from 'next/head';
import { ArrowUpRight, Mail, ScrollText } from 'lucide-react';
import PublicFooter from '@/components/public/PublicFooter';
import PublicNavbar from '@/components/public/PublicNavbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PUBLIC_LEGAL_LINKS, PUBLIC_SITE } from '@/lib/site';

export default function PublicPolicyLayout({
  title,
  description,
  intro,
  sections,
  summaryCards = [],
  contactTitle = 'Need help or clarification?',
  contactText,
  currentHref,
}) {
  const pageDescription = description || intro;
  const contactCopy = contactText || `Questions about ${title.toLowerCase()}? Our team replies within ${PUBLIC_SITE.supportResponseWindow}.`;

  return (
    <>
      <Head>
        <title>{title} - {PUBLIC_SITE.companyName}</title>
        <meta content={pageDescription} name="description" />
      </Head>

      <div className="min-h-screen bg-[linear-gradient(180deg,#fbf6ef_0%,#f4ede3_56%,#f6f0e8_100%)] text-foreground">
        <PublicNavbar currentHref={currentHref} links={PUBLIC_LEGAL_LINKS} />

        <main className="px-4 pb-20 pt-36 sm:px-6 lg:px-8 lg:pt-40">
          <div className="mx-auto max-w-7xl">
            <section className="rounded-[40px] border border-white/60 bg-white/65 px-6 py-8 shadow-glass backdrop-blur-xl sm:px-8 sm:py-10">
              <Badge variant="outline">Policy centre</Badge>
              <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
                <div className="max-w-3xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                    Clear, human-first legal reading
                  </p>
                  <h1 className="mt-6 font-display text-5xl leading-none tracking-tight sm:text-6xl">
                    {title}
                  </h1>
                  <p className="mt-6 text-base leading-8 text-muted-foreground">{pageDescription}</p>
                </div>

                <Card className="bg-[#211b17] text-white">
                  <CardContent className="space-y-3 p-6">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#dcb86d]">
                      Policy snapshot
                    </p>
                    <p className="text-sm leading-7 text-white/72">
                      Effective {PUBLIC_SITE.effectiveDate}. Questions are answered by email from {PUBLIC_SITE.location}.
                    </p>
                    <Button asChild className="w-full" size="sm">
                      <a href={`mailto:${PUBLIC_SITE.supportEmail}`}>
                        Contact support
                        <ArrowUpRight data-icon="inline-end" />
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </section>

            <div className="mt-8 grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
              <aside className="lg:sticky lg:top-32 lg:self-start">
                <Card className="bg-white/60">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <ScrollText className="size-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                          Quick navigation
                        </p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          Jump straight to the section you need.
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-col gap-2">
                      {sections.map((section) => (
                        <a
                          className="rounded-2xl px-3 py-3 text-sm leading-6 text-muted-foreground transition-colors duration-200 hover:bg-white hover:text-foreground"
                          href={`#${section.id}`}
                          key={section.id}
                        >
                          {section.title}
                        </a>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </aside>

              <div className="space-y-6">
                {summaryCards.length > 0 && (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {summaryCards.map((card) => (
                      <Card className="h-full bg-white/60" key={card.label}>
                        <CardContent className="p-6">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                            {card.label}
                          </p>
                          <h2 className="mt-4 font-display text-3xl leading-none tracking-tight text-foreground">
                            {card.value}
                          </h2>
                          {card.note && (
                            <p className="mt-3 text-sm leading-7 text-muted-foreground">{card.note}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <Card className="overflow-hidden bg-white/68">
                  <CardContent className="p-6 sm:p-8">
                    {intro && (
                      <>
                        <div className="rounded-[28px] border border-border/70 bg-primary/5 px-5 py-4 text-sm leading-7 text-muted-foreground">
                          {intro}
                        </div>
                        <Separator className="my-8" />
                      </>
                    )}

                    <div className="space-y-8">
                      {sections.map((section, index) => (
                        <section className="scroll-mt-32" id={section.id} key={section.id}>
                          <div className="max-w-3xl">
                            <h2 className="font-display text-4xl leading-none tracking-tight text-foreground">
                              {section.title}
                            </h2>
                            <div className="mt-4 whitespace-pre-line text-sm leading-8 text-muted-foreground sm:text-[15px]">
                              {section.content}
                            </div>
                          </div>
                          {index < sections.length - 1 && <Separator className="mt-8" />}
                        </section>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#211b17] text-white">
                  <CardContent className="p-6 sm:p-8">
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                      <div className="max-w-2xl">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#dcb86d]">
                          Contact
                        </p>
                        <h3 className="mt-4 font-display text-4xl leading-none tracking-tight">
                          {contactTitle}
                        </h3>
                        <p className="mt-4 text-sm leading-7 text-white/72">{contactCopy}</p>
                      </div>
                      <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/72">
                        <Mail className="size-4 text-[#dcb86d]" />
                        {PUBLIC_SITE.supportEmail}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>

        <PublicFooter />
      </div>
    </>
  );
}
