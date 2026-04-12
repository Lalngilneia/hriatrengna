import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { withReferral } from '@/lib/referral';

const DEFAULT_LINKS = [
  { label: 'How it works', href: '/#how' },
  { label: 'Features', href: '/#features' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'Affiliate Programme', href: '/affiliate' },
];

function NavAction({ href, onClick, children, variant = 'ghost', className }) {
  if (onClick) {
    return (
      <Button className={className} onClick={onClick} type="button" variant={variant}>
        {children}
      </Button>
    );
  }

  return (
    <Button asChild className={className} variant={variant}>
      <a href={href}>{children}</a>
    </Button>
  );
}

export default function PublicNavbar({
  links = DEFAULT_LINKS,
  onLogin,
  onSignup,
  loginHref,
  signupHref,
  currentHref,
  className,
}) {
  const [open, setOpen] = useState(false);
  const resolvedLoginHref = loginHref || withReferral('/login');
  const resolvedSignupHref = signupHref || withReferral('/signup');

  return (
    <header className={cn('fixed inset-x-0 top-0 z-50 px-4 py-4 sm:px-6', className)}>
      <div className="mx-auto max-w-7xl">
        <div className="rounded-[32px] border border-white/60 bg-white/65 px-4 py-3 shadow-glass backdrop-blur-xl sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <a className="flex items-center gap-3 text-foreground" href="/">
              <span className="flex size-11 items-center justify-center overflow-hidden rounded-full border border-primary/20 bg-primary/10 shadow-sm">
                <img
                  alt="Hriatrengna logo"
                  className="size-7 object-contain"
                  src="/favicon-96x96.png"
                />
              </span>
              <span className="font-display text-2xl tracking-tight">Hriatrengna</span>
            </a>

            <nav className="hidden items-center gap-2 md:flex">
              {links.map((link) => (
                <a
                  className={cn(
                    'rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors duration-200 hover:bg-white hover:text-foreground',
                    currentHref === link.href && 'bg-white text-foreground shadow-sm'
                  )}
                  href={link.href}
                  key={link.href}
                >
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="hidden items-center gap-3 md:flex">
              <NavAction href={resolvedLoginHref} onClick={onLogin} variant="ghost">
                Sign in
              </NavAction>
              <NavAction href={resolvedSignupHref} onClick={onSignup}>
                Create Album
              </NavAction>
            </div>

            <Button
              aria-expanded={open}
              aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
              className="md:hidden"
              onClick={() => setOpen((value) => !value)}
              size="icon"
              type="button"
              variant="outline"
            >
              {open ? <X /> : <Menu />}
            </Button>
          </div>

          {open && (
            <div className="mt-4 flex flex-col gap-3 border-t border-border/70 pt-4 md:hidden">
              {links.map((link) => (
                <a
                  className={cn(
                    'rounded-2xl px-4 py-3 text-sm text-muted-foreground transition-colors duration-200 hover:bg-white hover:text-foreground',
                    currentHref === link.href && 'bg-white text-foreground shadow-sm'
                  )}
                  href={link.href}
                  key={link.href}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="flex flex-col gap-3 pt-2">
                <NavAction
                  className="w-full"
                  href={resolvedLoginHref}
                  onClick={onLogin ? () => {
                    setOpen(false);
                    onLogin();
                  } : undefined}
                  variant="outline"
                >
                  Sign in
                </NavAction>
                <NavAction
                  className="w-full"
                  href={resolvedSignupHref}
                  onClick={onSignup ? () => {
                    setOpen(false);
                    onSignup();
                  } : undefined}
                >
                  Create Album
                </NavAction>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
