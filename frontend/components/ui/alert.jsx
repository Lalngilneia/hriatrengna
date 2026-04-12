import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'rounded-[24px] border px-4 py-3 text-sm leading-6 backdrop-blur-sm',
  {
    variants: {
      variant: {
        default: 'border-border bg-white/65 text-foreground',
        error: 'border-red-200 bg-red-50/90 text-red-700',
        success: 'border-emerald-200 bg-emerald-50/90 text-emerald-700',
        info: 'border-primary/15 bg-primary/10 text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

function Alert({ className, variant, ...props }) {
  return <div className={cn(alertVariants({ variant }), className)} role="alert" {...props} />;
}

export { Alert };
