import type {
    ButtonHTMLAttributes,
    HTMLAttributes,
    InputHTMLAttributes,
    ReactNode,
} from 'react';
import { Button, Card, Input } from '@heroui/react';

const join = (...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(' ');

export function SurfaceCard({
    children,
    className,
    ...props
}: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) {
    return (
        <Card
            className={join(
                'border border-[var(--fz-border)] bg-[var(--fz-surface)] shadow-none',
                className,
            )}
            {...props}
        >
            <Card.Content className="p-0">{children}</Card.Content>
        </Card>
    );
}

type SurfaceButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANT_MAP: Record<SurfaceButtonVariant, 'primary' | 'secondary' | 'ghost' | 'danger'> = {
    primary: 'primary',
    secondary: 'secondary',
    ghost: 'ghost',
    danger: 'danger',
};

export function SurfaceButton({
    children,
    className,
    variant = 'secondary',
    onClick,
    type = 'button',
    disabled,
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: ReactNode;
    variant?: SurfaceButtonVariant;
}) {
    return (
        <Button
            type={type}
            variant={VARIANT_MAP[variant]}
            size="sm"
            isDisabled={disabled}
            className={className}
            aria-label={props['aria-label']}
            onPress={() => {
                if (!onClick) return;
                onClick({} as React.MouseEvent<HTMLButtonElement>);
            }}
        >
            {children}
        </Button>
    );
}

export function DashboardInput({ className, onChange, value, ...props }: InputHTMLAttributes<HTMLInputElement>) {
    return (
        <Input
            className={join('w-full', className)}
            value={value as string | undefined}
            onChange={onChange as never}
            placeholder={props.placeholder}
            type={props.type}
            disabled={props.disabled}
            name={props.name}
            id={props.id}
            aria-label={props['aria-label']}
            min={props.min as number | string | undefined}
            max={props.max as number | string | undefined}
            step={props.step as number | string | undefined}
            autoComplete={props.autoComplete}
            required={props.required}
            readOnly={props.readOnly}
        />
    );
}

export function SectionLabel({
    children,
    className,
    ...props
}: HTMLAttributes<HTMLParagraphElement> & { children?: ReactNode }) {
    return (
        <p
            className={join(
                'text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--fz-text-tertiary)]',
                className,
            )}
            {...props}
        >
            {children}
        </p>
    );
}
