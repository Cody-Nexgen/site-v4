import type { ReactNode } from 'react';
import { Dialog } from './fz/Dialog';

type Props = {
    open: boolean;
    title: string;
    description?: string;
    onClose: () => void;
    children: ReactNode;
    maxWidth?: string;
    danger?: boolean;
};

export default function SimpleModal({
    open,
    title,
    description,
    onClose,
    children,
    maxWidth = 'max-w-md',
    danger = false,
}: Props) {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={danger ? <span className="text-[var(--fz-danger)]">{title}</span> : title}
            description={description}
            className={maxWidth}
        >
            {children}
        </Dialog>
    );
}
