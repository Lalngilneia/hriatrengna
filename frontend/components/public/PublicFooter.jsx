import { HeartHandshake } from 'lucide-react';
import { PUBLIC_LEGAL_LINKS, PUBLIC_SITE } from '@/lib/site';

export default function PublicFooter() {
  return (
    <footer className="border-t border-border/70 px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 rounded-[28px] border border-white/60 bg-white/60 px-6 py-6 shadow-glass backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-muted-foreground">
            <HeartHandshake className="size-4 text-primary" />
            Built with care
          </div>
          <p className="max-w-xl text-sm leading-7 text-muted-foreground">
            {PUBLIC_SITE.companyName} helps families, couples, and studios publish stories with
            dignity, warmth, and lasting access.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <a className="transition-colors duration-200 hover:text-foreground" href="/">
            Home
          </a>
          {PUBLIC_LEGAL_LINKS.map((link) => (
            <a
              className="transition-colors duration-200 hover:text-foreground"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </a>
          ))}
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground/80">
            {new Date().getFullYear()}
          </span>
        </div>
      </div>
    </footer>
  );
}
