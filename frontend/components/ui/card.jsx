import * as React from 'react';
import { cn } from '@/lib/utils';

const Card = React.forwardRef(function Card({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-[28px] border border-white/60 bg-white/70 text-card-foreground shadow-glass backdrop-blur-xl',
        className
      )}
      {...props}
    />
  );
});

const CardHeader = React.forwardRef(function CardHeader({ className, ...props }, ref) {
  return <div ref={ref} className={cn('flex flex-col gap-3 p-6', className)} {...props} />;
});

const CardTitle = React.forwardRef(function CardTitle({ className, ...props }, ref) {
  return (
    <h3
      ref={ref}
      className={cn('font-display text-3xl leading-none tracking-tight text-foreground', className)}
      {...props}
    />
  );
});

const CardDescription = React.forwardRef(function CardDescription({ className, ...props }, ref) {
  return (
    <p
      ref={ref}
      className={cn('text-sm leading-7 text-muted-foreground', className)}
      {...props}
    />
  );
});

const CardContent = React.forwardRef(function CardContent({ className, ...props }, ref) {
  return <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />;
});

const CardFooter = React.forwardRef(function CardFooter({ className, ...props }, ref) {
  return <div ref={ref} className={cn('flex items-center gap-3 p-6 pt-0', className)} {...props} />;
});

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
