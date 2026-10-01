import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
    return (
        <div
            aria-hidden
            className={cn(
                'rounded-md bg-[var(--fz-bg-hover)]',
                'motion-safe:animate-[fz-shimmer_1.2s_ease-in-out_infinite]',
                'motion-reduce:animate-none',
                className,
            )}
            style={{ backgroundImage: 'linear-gradient(90deg, transparent, var(--fz-bg-active), transparent)', backgroundSize: '200% 100%' }}
        />
    );
}
