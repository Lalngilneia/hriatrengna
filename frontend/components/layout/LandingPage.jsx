import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  Clock3,
  Flower2,
  Heart,
  ImageIcon,
  LockKeyhole,
  Music4,
  Plus,
  QrCode,
  ShieldCheck,
  Sparkles,
  Video,
} from 'lucide-react';
import PublicNavbar from '@/components/public/PublicNavbar';
import PublicFooter from '@/components/public/PublicFooter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiCall } from '@/lib/api';
import { cn } from '@/lib/utils';
import { captureReferralFromLocation, withReferral } from '@/lib/referral';
import {
  BASE_PHOTOS,
  BASE_VIDEOS,
  DEFAULT_ADDON_PRICES_INR,
  PHOTOS_PER_PACK,
  SUBSCRIPTION_LENGTHS,
  UPFRONT_DISCOUNT_PCT,
  VIDEOS_PER_PACK,
  calculateConfigPrice,
} from '@/lib/constants';

const DEFAULT_CONFIG = {
  planType: 'memorial',
  lengthMonths: 12,
  extraPhotoPacks: 0,
  extraVideoPacks: 0,
  audioEnabled: false,
  themesEnabled: false,
  paymentMode: 'upfront',
};

const STEP_LIMIT = 10;

const MODE_CONTENT = {
  memorial: {
    badge: 'Memorial mode',
    eyebrow: 'Digital memorial publishing',
    title: 'Preserve a life with quiet detail and lasting access.',
    description:
      'Build a tribute page that holds photographs, stories, QR access, and family messages in one respectful, beautifully paced experience.',
    support: [
      'A slower, dignified reading rhythm for remembrance.',
      'QR-led sharing for plaques, services, and keepsakes.',
    ],
    accentLabel: 'Memorials',
    accentCopy: 'Dark, respectful presentation with soft contrast and thoughtful pacing.',
  },
  wedding: {
    badge: 'Wedding mode',
    eyebrow: 'Digital wedding publishing',
    title: 'Turn the celebration into an elegant album guests can revisit.',
    description:
      'Curate vows, galleries, RSVPs, and private moments inside a polished destination that feels as considered as the event itself.',
    support: [
      'An airy visual language for celebration and storytelling.',
      'A seamless home for invitations, galleries, and day-of sharing.',
    ],
    accentLabel: 'Weddings',
    accentCopy: 'Light, elegant presentation with warm highlights and celebratory energy.',
  },
};

const FEATURE_SECTIONS = [
  {
    title: 'Stories that feel complete',
    copy: 'Give one page the work of an invitation suite, gallery, memory book, and private archive.',
    items: [
      { icon: Camera, title: 'Photo-rich storytelling', description: 'Publish galleries, portraits, and key moments with room to breathe.' },
      { icon: Video, title: 'Video keepsakes', description: 'Add speeches, family recordings, or wedding highlights alongside the written story.' },
      { icon: Music4, title: 'Ambient audio', description: 'Optional music and audio uploads give each page a stronger emotional tone.' },
    ],
  },
  {
    title: 'Sharing that feels effortless',
    copy: 'From the first scan to the final tribute, the journey stays clear, mobile-friendly, and premium.',
    items: [
      { icon: QrCode, title: 'QR-ready delivery', description: 'Send guests or visitors straight to the page from plaques, cards, and printed pieces.' },
      { icon: Heart, title: 'Guest tributes', description: 'Invite messages, media, and wishes from family, friends, and guests without friction.' },
      { icon: ShieldCheck, title: 'Privacy controls', description: 'Choose who sees the page with secure sharing and account-backed access.' },
    ],
  },
];

const JOURNEY = [
  {
    step: '01',
    title: 'Choose the experience',
    description: 'Select a memorial or wedding plan and tune the duration and add-ons in real time.',
  },
  {
    step: '02',
    title: 'Shape the story',
    description: 'Upload photos, video, biography details, and the practical information guests need.',
  },
  {
    step: '03',
    title: 'Share beautifully',
    description: 'Use the QR code, direct links, and printable assets wherever people will encounter the page.',
  },
  {
    step: '04',
    title: 'Keep it alive',
    description: 'Collect tributes, revisit the archive, and extend access when you need more time or space.',
  },
];

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.round(Number(value) || 0));
}

function Stepper({ label, description, value, onDecrease, onIncrease }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[24px] border border-border/80 bg-white/75 px-4 py-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-sm leading-6 text-muted-foreground">{description}</div>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={onDecrease} size="icon" type="button" variant="outline">
          <span aria-hidden="true" className="text-lg leading-none">-</span>
        </Button>
        <span className="min-w-8 text-center text-sm font-semibold text-foreground">{value}</span>
        <Button onClick={onIncrease} size="icon" type="button" variant="outline">
          <Plus />
        </Button>
      </div>
    </div>
  );
}

function FeatureGroup({ section }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_minmax(0,1.1fr)] lg:gap-12">
      <div className="max-w-md">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">{section.title}</p>
        <h3 className="mt-4 font-display text-4xl leading-none tracking-tight text-foreground sm:text-5xl">
          {section.copy}
        </h3>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {section.items.map((item) => (
          <Card className="h-full bg-white/65" key={item.title}>
            <CardContent className="flex h-full flex-col gap-4 p-6">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <item.icon className="size-5" />
              </div>
              <div className="space-y-2">
                <h4 className="text-base font-semibold tracking-[0.02em] text-foreground">{item.title}</h4>
                <p className="text-sm leading-7 text-muted-foreground">{item.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StickyCheckoutBar({ total, planType, onSignup }) {
  return (
    <div className="fixed inset-x-0 bottom-4 z-40 px-4 lg:hidden">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-4 rounded-[28px] border border-white/70 bg-[#221d18]/90 px-4 py-3 text-white shadow-velvet backdrop-blur-xl">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.24em] text-white/60">{planType}</div>
          <div className="truncate font-display text-2xl tracking-tight">{total}</div>
        </div>
        <Button className="shrink-0" onClick={onSignup} size="sm" type="button">
          Create Album
        </Button>
      </div>
    </div>
  );
}

export default function LandingPage({ onLogin, onSignup }) {
  const pricingRef = useRef(null);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [addonPrices, setAddonPrices] = useState(DEFAULT_ADDON_PRICES_INR);

  useEffect(() => {
    captureReferralFromLocation();
  }, []);

  useEffect(() => {
    apiCall(`/api/payments/pricing-options?type=${config.planType}`)
      .then((data) => {
        if (!data.addons?.length) return;
        const nextPrices = {};
        data.addons.forEach((addon) => {
          nextPrices[addon.key] = addon.priceInr;
        });
        setAddonPrices((current) => ({ ...current, ...nextPrices }));
      })
      .catch(() => {});
  }, [config.planType]);

  const currentMode = MODE_CONTENT[config.planType];
  const lengthRow =
    SUBSCRIPTION_LENGTHS.find((length) => length.months === config.lengthMonths) || SUBSCRIPTION_LENGTHS[0];
  const baseMonthlyInr =
    config.planType === 'wedding' ? lengthRow.weddingMonthlyInr : lengthRow.memorialMonthlyInr;
  const pricing = calculateConfigPrice(config, addonPrices, baseMonthlyInr);

  const setValue = (key, value) => {
    setConfig((current) => ({ ...current, [key]: value }));
  };

  const adjustValue = (key, delta) => {
    setConfig((current) => ({
      ...current,
      [key]: Math.max(0, Math.min(STEP_LIMIT, current[key] + delta)),
    }));
  };

  const handleSignup = () => {
    if (onSignup) {
      onSignup();
      return;
    }
    window.location.assign(withReferral('/signup'));
  };

  const handleLogin = () => {
    if (onLogin) {
      onLogin();
      return;
    }
    window.location.assign(withReferral('/login'));
  };

  const scrollToPricing = () => {
    pricingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const trustItems = [
    { icon: LockKeyhole, label: 'Secure account access' },
    { icon: BadgeCheck, label: 'Live pricing with upfront savings' },
    { icon: Clock3, label: 'Built for quick setup on mobile and desktop' },
  ];

  const addOnSummary = [
    `${BASE_PHOTOS + config.extraPhotoPacks * PHOTOS_PER_PACK} photos`,
    `${BASE_VIDEOS + config.extraVideoPacks * VIDEOS_PER_PACK} videos`,
    config.audioEnabled ? 'Audio enabled' : null,
    config.themesEnabled ? 'Expanded themes' : null,
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#faf5ee_0%,#f6efe7_45%,#f3ebe2_100%)] text-foreground">
      <PublicNavbar onLogin={handleLogin} onSignup={handleSignup} />
      <main>
        <section className="relative overflow-hidden px-4 pb-20 pt-36 sm:px-6 lg:px-8 lg:pb-24 lg:pt-40">
          <div className="absolute inset-0 -z-10 bg-grain opacity-80" />
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
            <div className="max-w-2xl">
              <Badge className="mb-6" variant="outline">
                {currentMode.badge}
              </Badge>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
                {currentMode.eyebrow}
              </p>
              <h1 className="mt-6 font-display text-[clamp(3.4rem,8vw,6.5rem)] leading-[0.92] tracking-tight text-foreground">
                {currentMode.title}
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-muted-foreground sm:text-lg">
                {currentMode.description}
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <Button className="min-w-[180px]" onClick={handleSignup} size="lg" type="button">
                  Create Album
                  <ArrowRight data-icon="inline-end" />
                </Button>
                <Button onClick={scrollToPricing} size="lg" type="button" variant="outline">
                  Explore pricing
                </Button>
              </div>

              <div className="mt-10 grid gap-4 border-t border-border/80 pt-6 sm:grid-cols-2">
                {currentMode.support.map((item) => (
                  <div className="max-w-xs text-sm leading-7 text-muted-foreground" key={item}>
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-10 flex flex-wrap gap-3">
                {trustItems.map((item) => (
                  <div
                    className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/65 px-4 py-2 text-sm text-muted-foreground shadow-glass backdrop-blur-md"
                    key={item.label}
                  >
                    <item.icon className="size-4 text-primary" />
                    {item.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="overflow-hidden rounded-[40px] border border-white/70 bg-[#221d18] shadow-velvet">
                <div className="relative aspect-[4/5] overflow-hidden">
                  <img
                    alt="Hriatrengna digital album preview"
                    className="h-full w-full object-cover"
                    src="/hero-cover.png"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,16,12,0.06)_0%,rgba(20,16,12,0.16)_32%,rgba(20,16,12,0.74)_100%)]" />
                  <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                    <div className="max-w-md rounded-[28px] border border-white/10 bg-black/25 p-5 text-white backdrop-blur-md">
                      <h2 className="mt-3 font-display text-4xl leading-none tracking-tight">
                        One beautiful destination for story, tribute, and access.
                      </h2>
                      <p className="mt-4 text-sm leading-7 text-white/72">
                        Guests scan once and arrive at a page that feels polished, readable, and emotionally tuned to the moment.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Card className="bg-white/60">
                  <CardContent className="p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                      {currentMode.accentLabel}
                    </p>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                      {currentMode.accentCopy}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-[#201b16] text-white">
                  <CardContent className="p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60">
                      Best for conversion
                    </p>
                    <p className="mt-3 text-sm leading-7 text-white/72">
                      Put pricing, proof, and a calm CTA within one scroll so visitors understand the offer quickly.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-16">
            {FEATURE_SECTIONS.map((section) => (
              <FeatureGroup key={section.title} section={section} />
            ))}
          </div>
        </section>

        <section className="bg-[#1f1a16] px-4 py-20 text-white sm:px-6 lg:px-8" id="how">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#dcb86d]">
                How it works
              </p>
              <h2 className="mt-6 font-display text-5xl leading-none tracking-tight sm:text-6xl">
                From first setup to long-term access, the path stays simple.
              </h2>
            </div>

            <div className="mt-12 grid gap-4 lg:grid-cols-4">
              {JOURNEY.map((item) => (
                <div
                  className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-transform duration-200 hover:-translate-y-1 hover:bg-white/10"
                  key={item.step}
                >
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#dcb86d]">
                    {item.step}
                  </p>
                  <h3 className="mt-5 text-xl font-semibold tracking-[0.02em] text-white">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-white/68">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="px-4 py-20 sm:px-6 lg:px-8" id="pricing" ref={pricingRef}>
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.82fr_minmax(0,1.18fr)] lg:gap-16">
            <div className="max-w-xl">
              <Badge className="mb-6">Real-time pricing</Badge>
              <h2 className="font-display text-5xl leading-none tracking-tight text-foreground sm:text-6xl">
                Build a plan that matches the story, the scale, and the time horizon.
              </h2>
              <p className="mt-6 text-base leading-8 text-muted-foreground">
                Use the configurator to see monthly or upfront totals instantly. Upfront billing is highlighted as the best value, and mobile visitors always keep the CTA in reach.
              </p>

              <div className="mt-10 grid gap-4">
                {[
                  { icon: Camera, label: 'Steppers are capped at 10 packs for a cleaner buying flow.' },
                  { icon: BadgeCheck, label: `Upfront billing applies an extra ${UPFRONT_DISCOUNT_PCT}% discount.` },
                  { icon: Flower2, label: 'Memorial and wedding modes carry different mood and copy cues.' },
                ].map((item) => (
                  <div className="flex items-start gap-3" key={item.label}>
                    <div className="mt-1 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <item.icon className="size-4" />
                    </div>
                    <p className="text-sm leading-7 text-muted-foreground">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <Card className="overflow-hidden border-white/70 bg-white/70">
              <CardContent className="p-5 sm:p-7">
                <Tabs
                  onValueChange={(value) => setValue('planType', value)}
                  value={config.planType}
                >
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                          Album type
                        </p>
                        <p className="mt-2 text-sm leading-7 text-muted-foreground">
                          Switch between memorial and wedding journeys without losing your current configuration.
                        </p>
                      </div>
                      <TabsList>
                        <TabsTrigger value="memorial">Memorial</TabsTrigger>
                        <TabsTrigger value="wedding">Wedding</TabsTrigger>
                      </TabsList>
                    </div>

                    <TabsContent className="mt-0" value="memorial">
                      <div className="rounded-[28px] border border-border/70 bg-[#211b17] p-5 text-white">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#dcb86d]">
                          Memorial presentation
                        </p>
                        <p className="mt-3 text-sm leading-7 text-white/72">
                          Darker surfaces, quieter emphasis, and a respectful reading pace for remembrance.
                        </p>
                      </div>
                    </TabsContent>
                    <TabsContent className="mt-0" value="wedding">
                      <div className="rounded-[28px] border border-border/70 bg-[#fff8f1] p-5 text-foreground">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                          Wedding presentation
                        </p>
                        <p className="mt-3 text-sm leading-7 text-muted-foreground">
                          Lighter surfaces, warmer highlights, and a celebratory visual rhythm for event sharing.
                        </p>
                      </div>
                    </TabsContent>
                  </div>
                </Tabs>

                <Separator className="my-7" />

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                    Duration
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {SUBSCRIPTION_LENGTHS.map((length) => {
                      const monthlyRate =
                        config.planType === 'wedding'
                          ? length.weddingMonthlyInr
                          : length.memorialMonthlyInr;

                      return (
                        <button
                          className={cn(
                            'rounded-[24px] border px-4 py-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5',
                            config.lengthMonths === length.months
                              ? 'border-primary bg-primary/10 shadow-glass'
                              : 'border-border/80 bg-white/70'
                          )}
                          key={length.months}
                          onClick={() => setValue('lengthMonths', length.months)}
                          type="button"
                        >
                          <div className="text-sm font-semibold tracking-[0.02em] text-foreground">
                            {length.label}
                          </div>
                          <div className="mt-2 text-sm text-muted-foreground">
                            {formatCurrency(monthlyRate)}/mo
                          </div>
                          <div className="mt-2 text-xs uppercase tracking-[0.18em] text-primary">
                            {length.discountPct > 0 ? `${length.discountPct}% saved` : 'Standard'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Separator className="my-7" />

                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                      Add-ons
                    </p>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      Add extra room only where it matters. All add-ons update the total instantly.
                    </p>
                  </div>

                  <Stepper
                    description={`${PHOTOS_PER_PACK} additional photos per pack`}
                    label="Extra photo packs"
                    onDecrease={() => adjustValue('extraPhotoPacks', -1)}
                    onIncrease={() => adjustValue('extraPhotoPacks', 1)}
                    value={config.extraPhotoPacks}
                  />
                  <Stepper
                    description={`${VIDEOS_PER_PACK} additional videos per pack`}
                    label="Extra video packs"
                    onDecrease={() => adjustValue('extraVideoPacks', -1)}
                    onIncrease={() => adjustValue('extraVideoPacks', 1)}
                    value={config.extraVideoPacks}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-center justify-between rounded-[24px] border border-border/80 bg-white/75 px-4 py-4">
                      <div>
                        <div className="text-sm font-medium text-foreground">Audio uploads</div>
                        <div className="text-sm leading-6 text-muted-foreground">
                          {formatCurrency(addonPrices.audio_toggle)}/month
                        </div>
                      </div>
                      <Switch
                        checked={config.audioEnabled}
                        onCheckedChange={(checked) => setValue('audioEnabled', checked)}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-[24px] border border-border/80 bg-white/75 px-4 py-4">
                      <div>
                        <div className="text-sm font-medium text-foreground">Expanded themes</div>
                        <div className="text-sm leading-6 text-muted-foreground">
                          {formatCurrency(addonPrices.themes_toggle)}/month
                        </div>
                      </div>
                      <Switch
                        checked={config.themesEnabled}
                        onCheckedChange={(checked) => setValue('themesEnabled', checked)}
                      />
                    </div>
                  </div>
                </div>

                <Separator className="my-7" />

                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                    Billing preference
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      className={cn(
                        'rounded-[28px] border px-5 py-5 text-left transition-all duration-200 hover:-translate-y-0.5',
                        config.paymentMode === 'monthly'
                          ? 'border-primary bg-primary/10 shadow-glass'
                          : 'border-border/80 bg-white/70'
                      )}
                      onClick={() => setValue('paymentMode', 'monthly')}
                      type="button"
                    >
                      <div className="text-sm font-semibold tracking-[0.02em] text-foreground">
                        Monthly billing
                      </div>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">
                        Pay as you go and keep the plan flexible.
                      </p>
                    </button>

                    <button
                      className={cn(
                        'relative rounded-[28px] border px-5 py-5 text-left transition-all duration-200 hover:-translate-y-0.5',
                        config.paymentMode === 'upfront'
                          ? 'border-primary bg-[#201b16] text-white shadow-velvet'
                          : 'border-border/80 bg-white/70'
                      )}
                      onClick={() => setValue('paymentMode', 'upfront')}
                      type="button"
                    >
                      <span className="absolute right-4 top-4 rounded-full bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-foreground">
                        Best value
                      </span>
                      <div
                        className={cn(
                          'text-sm font-semibold tracking-[0.02em]',
                          config.paymentMode === 'upfront' ? 'text-white' : 'text-foreground'
                        )}
                      >
                        Pay upfront
                      </div>
                      <p
                        className={cn(
                          'mt-2 text-sm leading-7',
                          config.paymentMode === 'upfront' ? 'text-white/72' : 'text-muted-foreground'
                        )}
                      >
                        One payment for the full term plus an extra {UPFRONT_DISCOUNT_PCT}% off.
                      </p>
                    </button>
                  </div>
                </div>

                <div className="mt-7 rounded-[32px] bg-[#211b17] p-6 text-white">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#dcb86d]">
                        Total due
                      </p>
                      <div className="mt-3 font-display text-5xl leading-none tracking-tight">
                        {formatCurrency(pricing.totalChargedInr)}
                      </div>
                      <div className="mt-2 text-sm leading-7 text-white/68">
                        {config.paymentMode === 'upfront'
                          ? `${lengthRow.label} billed upfront`
                          : 'Per month billing'}
                      </div>
                    </div>

                    <div className="max-w-xs">
                      <div className="text-sm leading-7 text-white/72">
                        Includes {addOnSummary.join(' • ')}.
                      </div>
                      {config.paymentMode === 'upfront' && (
                        <div className="mt-2 text-sm font-medium text-[#f3d189]">
                          You save {formatCurrency(pricing.upfrontDiscountInr)} with upfront billing.
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator className="my-5 bg-white/10" />

                  <div className="grid gap-3 text-sm text-white/72 sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <BadgeCheck className="size-4 text-[#dcb86d]" />
                      Live breakdown powered by current pricing rules
                    </div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-[#dcb86d]" />
                      Secure checkout handled through Razorpay
                    </div>
                  </div>

                  <Button className="mt-6 w-full" onClick={handleSignup} size="lg" type="button">
                    Create Album
                    <ArrowRight data-icon="inline-end" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
      <PublicFooter />
      <StickyCheckoutBar
        onSignup={handleSignup}
        planType={config.planType}
        total={formatCurrency(pricing.totalChargedInr)}
      />
    </div>
  );
}
