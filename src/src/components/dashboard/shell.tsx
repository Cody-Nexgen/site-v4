import type { ReactNode } from 'react';
import {
    Alert,
    Button,
    Card,
    Chip,
    EmptyState,
    Input,
    Modal,
    Skeleton,
    Spinner,
    Switch,
    TextField,
    Label,
    Tooltip,
    useOverlayState,
} from '@heroui/react';
import { Inbox } from 'lucide-react';

const join = (...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(' ');

export function PageHeading({
    eyebrow,
    title,
    description,
    actions,
    className,
}: {
    eyebrow?: string;
    title: string;
    description?: string;
    actions?: ReactNode;
    className?: string;
}) {
    return (
        <header
            className={join(
                'flex flex-col gap-4 border-b border-[var(--fz-border)] pb-5 sm:flex-row sm:items-end sm:justify-between',
                className,
            )}
        >
            <div className="min-w-0 space-y-1.5">
                {eyebrow ? (
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--fz-text-tertiary)]">
                        {eyebrow}
                    </p>
                ) : null}
                <h1 className="text-2xl font-semibold tracking-tight text-[var(--fz-text)] sm:text-3xl">
                    {title}
                </h1>
                {description ? (
                    <p className="max-w-2xl text-sm leading-relaxed text-[var(--fz-text-secondary)]">
                        {description}
                    </p>
                ) : null}
            </div>
            {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
    );
}

export function SectionCard({
    title,
    description,
    actions,
    children,
    className,
    contentClassName,
}: {
    title?: string;
    description?: string;
    actions?: ReactNode;
    children?: ReactNode;
    className?: string;
    contentClassName?: string;
}) {
    return (
        <Card
            className={join(
                'border border-[var(--fz-border)] bg-[var(--fz-surface)] shadow-none',
                className,
            )}
        >
            {(title || description || actions) && (
                <Card.Header className="flex flex-row items-start justify-between gap-3 px-5 pt-5">
                    <div className="min-w-0 space-y-1">
                        {title ? <Card.Title className="text-sm font-semibold text-[var(--fz-text)]">{title}</Card.Title> : null}
                        {description ? (
                            <Card.Description className="text-xs text-[var(--fz-text-secondary)]">
                                {description}
                            </Card.Description>
                        ) : null}
                    </div>
                    {actions}
                </Card.Header>
            )}
            <Card.Content className={join('px-5 pb-5', contentClassName)}>{children}</Card.Content>
        </Card>
    );
}

export function MetricCard({
    label,
    value,
    hint,
    accent,
    className,
}: {
    label: string;
    value: string;
    hint?: string;
    accent?: string;
    className?: string;
}) {
    return (
        <Card
            className={join(
                'border border-[var(--fz-border)] bg-[var(--fz-surface)] shadow-none',
                className,
            )}
        >
            <Card.Content className="space-y-2 px-5 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--fz-text-tertiary)]">
                    {label}
                </p>
                <p
                    className="text-2xl font-semibold tabular-nums tracking-tight"
                    style={accent ? { color: accent } : undefined}
                >
                    {value}
                </p>
                {hint ? <p className="text-xs text-[var(--fz-text-secondary)]">{hint}</p> : null}
            </Card.Content>
        </Card>
    );
}

export function DashboardEmptyState({
    title,
    description,
    action,
    icon,
}: {
    title: string;
    description: string;
    action?: ReactNode;
    icon?: ReactNode;
}) {
    return (
        <EmptyState className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--fz-border)] bg-[var(--fz-surface)] px-6 py-12 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--fz-accent-muted)] text-[var(--fz-text-secondary)]">
                {icon ?? <Inbox size={18} aria-hidden="true" />}
            </div>
            <div className="space-y-1">
                <p className="text-sm font-semibold text-[var(--fz-text)]">{title}</p>
                <p className="max-w-sm text-xs leading-relaxed text-[var(--fz-text-secondary)]">{description}</p>
            </div>
            {action}
        </EmptyState>
    );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
    return (
        <div className="flex min-h-[220px] flex-col items-center justify-center gap-3" role="status" aria-live="polite">
            <Spinner />
            <p className="text-sm text-[var(--fz-text-secondary)]">{label}</p>
        </div>
    );
}

export function ErrorState({
    title = 'Something went wrong',
    description,
    onRetry,
}: {
    title?: string;
    description: string;
    onRetry?: () => void;
}) {
    return (
        <Alert status="danger" className="items-start">
            <Alert.Indicator />
            <Alert.Content>
                <Alert.Title>{title}</Alert.Title>
                <Alert.Description>{description}</Alert.Description>
            </Alert.Content>
            {onRetry ? (
                <Button size="sm" variant="outline" onPress={onRetry}>
                    Try again
                </Button>
            ) : null}
        </Alert>
    );
}

export function SettingsSection({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: ReactNode;
}) {
    return (
        <SectionCard title={title} description={description} contentClassName="space-y-4">
            {children}
        </SectionCard>
    );
}

export function SettingRow({
    title,
    description,
    control,
}: {
    title: string;
    description?: string;
    control: ReactNode;
}) {
    return (
        <div className="flex items-start justify-between gap-6">
            <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-[var(--fz-text)]">{title}</p>
                {description ? (
                    <p className="max-w-lg text-xs leading-relaxed text-[var(--fz-text-secondary)]">{description}</p>
                ) : null}
            </div>
            <div className="shrink-0">{control}</div>
        </div>
    );
}

export function DashboardSwitch({
    isSelected,
    onChange,
    'aria-label': ariaLabel,
}: {
    isSelected: boolean;
    onChange: (value: boolean) => void;
    'aria-label': string;
}) {
    return (
        <Switch isSelected={isSelected} onChange={onChange} aria-label={ariaLabel}>
            <Switch.Content>
                <Switch.Control>
                    <Switch.Thumb />
                </Switch.Control>
            </Switch.Content>
        </Switch>
    );
}

export function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
    pending = false,
    onConfirm,
    onClose,
}: {
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    pending?: boolean;
    onConfirm: () => void;
    onClose: () => void;
}) {
    const state = useOverlayState({
        isOpen: open,
        onOpenChange: (next) => {
            if (!next) onClose();
        },
    });

    return (
        <Modal state={state}>
            <Modal.Backdrop>
                <Modal.Container>
                    <Modal.Dialog className="border border-[var(--fz-border-strong)] bg-[var(--fz-surface-raised)]">
                        <Modal.CloseTrigger />
                        <Modal.Header>
                            <Modal.Heading>{title}</Modal.Heading>
                        </Modal.Header>
                        <Modal.Body>
                            <p className="text-sm text-[var(--fz-text-secondary)]">{description}</p>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button slot="close" variant="ghost" isDisabled={pending}>
                                {cancelLabel}
                            </Button>
                            <Button
                                variant={danger ? 'danger' : 'primary'}
                                isPending={pending}
                                onPress={onConfirm}
                            >
                                {confirmLabel}
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}

export function StatusChip({
    children,
    tone = 'neutral',
}: {
    children: ReactNode;
    tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}) {
    const tones: Record<typeof tone, string> = {
        neutral: 'bg-[var(--fz-accent-muted)] text-[var(--fz-text-secondary)]',
        success: 'bg-emerald-500/10 text-emerald-400',
        warning: 'bg-amber-500/10 text-amber-400',
        danger: 'bg-red-500/10 text-red-400',
        info: 'bg-sky-500/10 text-sky-400',
    };
    return <Chip className={join('border-0 shadow-none', tones[tone])}>{children}</Chip>;
}

export function DashboardTextField({
    label,
    value,
    onChange,
    placeholder,
    type = 'text',
    onSubmit,
    className,
}: {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: string;
    onSubmit?: () => void;
    className?: string;
}) {
    return (
        <TextField className={join('w-full', className)}>
            {label ? <Label>{label}</Label> : null}
            <Input
                type={type}
                value={value}
                placeholder={placeholder}
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') onSubmit?.();
                }}
            />
        </TextField>
    );
}

export function IconTooltip({ label, children }: { label: string; children: ReactNode }) {
    return (
        <Tooltip>
            <Tooltip.Trigger>{children}</Tooltip.Trigger>
            <Tooltip.Content arrowBoundaryOffset={0}>{label}</Tooltip.Content>
        </Tooltip>
    );
}

export function PageSkeleton() {
    return (
        <div className="space-y-4" aria-hidden="true">
            <Skeleton className="h-8 w-48 rounded-lg" />
            <Skeleton className="h-4 w-80 rounded-lg" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-24 rounded-xl" />
                ))}
            </div>
            <Skeleton className="h-64 rounded-xl" />
        </div>
    );
}

export { Button, Card, Input, Chip, Spinner, Skeleton, Alert, Modal };
