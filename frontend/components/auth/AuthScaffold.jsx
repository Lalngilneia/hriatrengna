import PublicFooter from '@/components/public/PublicFooter';
import PublicNavbar from '@/components/public/PublicNavbar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export default function AuthScaffold({
  eyebrow,
  title,
  description,
  children,
  sideBadge = 'Secure access',
  sideTitle = 'Calm, premium access for every album.',
  sideCopy = 'The same editorial design language from the public site carries through the sign-in and recovery flow, so nothing feels abrupt or improvised.',
  highlights = [],
}) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#faf5ee_0%,#f6efe6_54%,#f5eee4_100%)] text-foreground">
      <PublicNavbar />

      <main className="px-4 pb-20 pt-36 sm:px-6 lg:px-8 lg:pt-40">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
              {eyebrow}
            </p>
            <h1 className="mt-6 font-display text-5xl leading-none tracking-tight sm:text-6xl">
              {title}
            </h1>
            <p className="mt-6 text-base leading-8 text-muted-foreground">{description}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              {highlights.map((item) => (
                <div
                  className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/65 px-4 py-2 text-sm text-muted-foreground shadow-glass backdrop-blur-md"
                  key={item.label}
                >
                  <item.icon className="size-4 text-primary" />
                  {item.label}
                </div>
              ))}
            </div>

            <Card className="mt-8 bg-[#211b17] text-white">
              <CardContent className="p-6">
                <Badge variant="secondary">{sideBadge}</Badge>
                <h2 className="mt-5 font-display text-4xl leading-none tracking-tight">
                  {sideTitle}
                </h2>
                <p className="mt-4 text-sm leading-7 text-white/72">{sideCopy}</p>
              </CardContent>
            </Card>
          </div>

          <div>{children}</div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
