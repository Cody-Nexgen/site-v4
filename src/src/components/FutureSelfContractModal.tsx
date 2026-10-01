import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { FutureSelfContract, FutureSelfDestination } from '../lib/futureSelfTypes';
import { Dialog } from './fz/Dialog';
import { Button } from './fz/Button';
import { Field, Input, Textarea } from './fz/Field';
import { reducedMotion } from '../lib/motion';

type Props = {
    open: boolean;
    isPro: boolean;
    focusMinutes: number;
    onClose: () => void;
    onUpgrade: () => void;
    onStarted: (contract: FutureSelfContract) => void;
};

const STEP = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } };
const STEP_SAFE = reducedMotion.matches() ? { hidden: { opacity: 0 }, show: { opacity: 1 } } : STEP;
const STAGGER = reducedMotion.matches() ? { show: {} } : { show: { transition: { staggerChildren: 0.018 } } };

export function FutureSelfContractModal({
    open,
    isPro,
    focusMinutes,
    onClose,
    onUpgrade,
    onStarted,
}: Props) {
    const [mission, setMission] = useState('');
    const [goal, setGoal] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [plannedMinutes, setPlannedMinutes] = useState(focusMinutes);
    const [destination, setDestination] = useState<FutureSelfDestination | null>(null);
    const [url, setUrl] = useState('');
    const [errors, setErrors] = useState<{ url?: string; form?: string }>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open || !isPro) return;
        setErrors({});
        void chrome.runtime.sendMessage({ type: 'FUTURE_SELF_ACTIVE_TAB' }).then((response) => {
            if (response?.destination) {
                setDestination(response.destination);
                setUrl(response.destination.url);
            }
        });
    }, [open, isPro]);

    const submit = async () => {
        setSaving(true);
        setErrors({});
        if (!url.trim()) {
            setSaving(false);
            setErrors({ url: 'Enter a work destination URL (e.g. docs.google.com).' });
            return;
        }
        if (mission.trim().length < 3 || goal.trim().length < 3 || !targetDate) {
            setSaving(false);
            setErrors({ form: 'Fill in mission, goal, and a future target date.' });
            return;
        }
        let response: { ok?: boolean; error?: string; needsExtension?: boolean; contract?: FutureSelfContract } | undefined;
        try {
            response = await chrome.runtime.sendMessage({
                type: 'FUTURE_SELF_START',
                contract: {
                    mission,
                    overarchingGoal: goal,
                    futureTargetDate: targetDate,
                    plannedMinutesPerDay: plannedMinutes,
                    destination: { ...(destination || {}), url: url.trim() },
                },
            });
        } catch (err) {
            setSaving(false);
            setErrors({ form: err instanceof Error ? err.message : 'Could not reach the extension background.' });
            return;
        }
        setSaving(false);
        if (!response?.ok) {
            if (response?.needsExtension) {
                setErrors({ form: 'Future Self Mode needs the FocuzNow extension open to create a contract.' });
                return;
            }
            setErrors({ form: response?.error || chrome.runtime.lastError?.message || 'Could not create the contract.' });
            return;
        }
        onStarted(response.contract!);
    };

    // §6.5: free users get an upsell dialog with an image slot, not a blue-bordered box.
    if (!isPro) {
        return (
            <Dialog
                open={open}
                onClose={onClose}
                size="sm"
                title="Meet your Future Self"
                description="Build a focus contract, count deliberate overrides, and receive a private daily Focus Mirror."
                footer={
                    <>
                        <Button variant="secondary" onClick={onClose}>Not now</Button>
                        <Button variant="primary" onClick={onUpgrade}>Upgrade to Pro</Button>
                    </>
                }
            >
                <div
                    aria-hidden
                    className="aspect-[16/9] w-full rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] flex items-center justify-center"
                >
                    <span className="text-meta text-[var(--fz-text-4)]">Focus Mirror preview</span>
                </div>
            </Dialog>
        );
    }

    return (
        <Dialog
            open={open}
            onClose={onClose}
            size="md"
            title="What will this focus protect?"
            description="Commit to a destination, a goal, and a daily plan."
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button variant="primary" loading={saving} onClick={() => void submit()}>
                        Commit & start
                    </Button>
                </>
            }
        >
            <motion.div
                className="grid gap-4"
                initial="hidden"
                animate="show"
                variants={STAGGER}
            >
                <motion.div variants={STEP_SAFE}>
                    <Field label="Mission for this focus" htmlFor="fs-mission" error={errors.form && !mission.trim() ? errors.form : undefined}>
                        <Input id="fs-mission" value={mission} onChange={(e) => setMission(e.target.value)} placeholder="Finish the launch proposal" invalid={Boolean(errors.form) && !mission.trim()} />
                    </Field>
                </motion.div>
                <motion.div variants={STEP_SAFE}>
                    <Field label="Overarching goal" htmlFor="fs-goal" error={errors.form && !goal.trim() ? errors.form : undefined}>
                        <Textarea id="fs-goal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Build a sustainable independent business" invalid={Boolean(errors.form) && !goal.trim()} />
                    </Field>
                </motion.div>
                <motion.div variants={STEP_SAFE} className="grid grid-cols-2 gap-3">
                    <Field label="Future target date" htmlFor="fs-date" error={errors.form && !targetDate ? errors.form : undefined}>
                        <Input id="fs-date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} invalid={Boolean(errors.form) && !targetDate} />
                    </Field>
                    <Field label="Planned minutes / day" htmlFor="fs-minutes">
                        <div className="flex items-center gap-1">
                            <Button variant="secondary" size="sm" className="w-7 px-0" onClick={() => setPlannedMinutes((m) => Math.max(1, m - 5))} aria-label="Decrease minutes">−</Button>
                            <Input
                                id="fs-minutes"
                                type="number"
                                min={1}
                                max={720}
                                value={plannedMinutes}
                                onChange={(e) => setPlannedMinutes(Number(e.target.value))}
                                className="flex-1 text-center tabular-nums"
                            />
                            <Button variant="secondary" size="sm" className="w-7 px-0" onClick={() => setPlannedMinutes((m) => Math.min(720, m + 5))} aria-label="Increase minutes">+</Button>
                        </div>
                    </Field>
                </motion.div>
                <motion.div variants={STEP_SAFE}>
                    <Field label="Allowed work destination" htmlFor="fs-url" error={errors.url} helper={!errors.url ? 'Uses your current active tab when available, or enter another URL.' : undefined}>
                        <div className="flex items-center gap-2 rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] px-2.5 focus-within:border-[var(--fz-border-strong)]">
                            {destination?.faviconUrl && <img src={destination.faviconUrl} alt="" className="h-4 w-4 rounded" />}
                            <input
                                id="fs-url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://docs.example.com"
                                aria-invalid={Boolean(errors.url) || undefined}
                                className="min-w-0 flex-1 bg-transparent py-2 text-[13px] text-[var(--fz-text-1)] placeholder:text-[var(--fz-text-4)] outline-none"
                            />
                        </div>
                    </Field>
                </motion.div>
                {errors.form && mission.trim() && goal.trim() && targetDate && (
                    <p className="text-meta text-[var(--fz-danger)]">{errors.form}</p>
                )}
            </motion.div>
        </Dialog>
    );
}
