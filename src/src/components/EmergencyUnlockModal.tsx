import { useState } from 'react';
import { Button } from './fz/Button';
import { Dialog } from './fz/Dialog';
import { Textarea } from './fz/Field';

type Props = {
    open: boolean;
    domain: string;
    minReasonLength: number;
    onClose: () => void;
    onSubmit: (reason: string) => Promise<void>;
};

export function EmergencyUnlockModal({ open, domain, minReasonLength, onClose, onSubmit }: Props) {
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        setError('');
        if (reason.trim().length < minReasonLength) {
            setError(`Please write at least ${minReasonLength} characters explaining why.`);
            return;
        }
        setSubmitting(true);
        try {
            await onSubmit(reason.trim());
            setReason('');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Request failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        setReason('');
        setError('');
        onClose();
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            title="Emergency unlock"
            size="md"
            footer={
                <>
                    <Button variant="secondary" onClick={handleClose}>Cancel</Button>
                    <Button
                        variant="primary"
                        disabled={submitting || reason.trim().length < minReasonLength}
                        loading={submitting}
                        onClick={() => void handleSubmit()}
                    >
                        {submitting ? 'Requesting…' : 'Grant access'}
                    </Button>
                </>
            }
        >
            <p className="text-body-sm text-[var(--fz-text-2)] leading-relaxed">
                This grants temporary access to <span className="font-medium text-[var(--fz-text-1)]">{domain}</span>.
                You must explain why — this is logged for accountability.
            </p>

            <Textarea
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why do you need access right now? Be honest — patterns are tracked."
                rows={4}
            />

            {error && <p className="text-body-sm text-[var(--fz-danger)]">{error}</p>}

            <p className="text-meta text-[var(--fz-text-3)] text-center">
                Not available during nuclear lockdown. Limited uses per day.
            </p>
        </Dialog>
    );
}
