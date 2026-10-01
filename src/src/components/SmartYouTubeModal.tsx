import { useEffect, useState } from 'react';
import {
    Car,
    Drama,
    Film,
    FlaskConical,
    Gamepad2,
    GraduationCap,
    HeartHandshake,
    Laugh,
    Lock,
    Music,
    Newspaper,
    PawPrint,
    Plane,
    Sparkles,
    Trophy,
    User,
} from 'lucide-react';
import { Dialog } from './fz/Dialog';
import { Button } from './fz/Button';
import { Switch } from './fz/Switch';
import {
    DEFAULT_BLOCKED_CATEGORY_IDS,
    YOUTUBE_CATEGORIES,
} from '../lib/youtubeDataApi';
import type { SmartYouTubeSettings } from '../lib/youtubeSmartMode';
import { DEFAULT_SMART_YOUTUBE } from '../lib/youtubeSmartMode';

type Props = {
    open: boolean;
    onClose: () => void;
    settings: SmartYouTubeSettings;
    onSave: (next: SmartYouTubeSettings) => Promise<void>;
};

/** §6.6: 16px monochrome glyphs replace the old emoji per category. */
const CATEGORY_ICONS: Record<string, typeof Film> = {
    '1': Film,
    '2': Car,
    '10': Music,
    '15': PawPrint,
    '17': Trophy,
    '19': Plane,
    '20': Gamepad2,
    '22': User,
    '23': Laugh,
    '24': Drama,
    '25': Newspaper,
    '26': Sparkles,
    '27': GraduationCap,
    '28': FlaskConical,
    '29': HeartHandshake,
};

const ALWAYS_ALLOWED = new Set(['27', '28']); // Education, Science & Technology

export default function SmartYouTubeModal({ open, onClose, settings, onSave }: Props) {
    const [draft, setDraft] = useState<SmartYouTubeSettings>(settings);
    const [saving, setSaving] = useState(false);
    const [savedTick, setSavedTick] = useState(false);

    useEffect(() => {
        if (open) {
            setDraft(settings);
            setSavedTick(false);
        }
    }, [open, settings]);

    const toggleCategory = (id: string) => {
        const blocked = new Set(draft.blockedCategoryIds);
        if (blocked.has(id)) blocked.delete(id);
        else blocked.add(id);
        setDraft({ ...draft, blockedCategoryIds: Array.from(blocked) });
    };

    const handleSave = async () => {
        setSaving(true);
        await onSave({ ...draft, useDataApi: true });
        setSaving(false);
        setSavedTick(true);
        window.setTimeout(() => onClose(), 450);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            size="md"
            title="Smart YouTube"
            description="Videos are classified via the YouTube Data API. Education and Science are always allowed."
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button variant="primary" loading={saving} onClick={() => void handleSave()}>
                        {savedTick ? 'Saved' : 'Save & apply'}
                    </Button>
                </>
            }
        >
            <div className="space-y-5">
                <div className="flex items-center justify-between rounded-lg border border-[var(--fz-border)] bg-[var(--fz-bg-raised)] px-3 py-2.5">
                    <span className="text-[13px] font-medium text-[var(--fz-text-1)]">Block Shorts</span>
                    <Switch
                        checked={draft.blockShorts}
                        onCheckedChange={(v) => setDraft({ ...draft, blockShorts: v })}
                        aria-label="Block Shorts"
                    />
                </div>

                <div>
                    <div className="mb-2.5 flex items-center justify-between">
                        <span className="text-label text-[var(--fz-text-3)]">Categories</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDraft({ ...draft, blockedCategoryIds: [...DEFAULT_BLOCKED_CATEGORY_IDS] })}
                        >
                            Reset
                        </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 max-h-[min(50vh,360px)] overflow-y-auto pr-1">
                        {YOUTUBE_CATEGORIES.map((cat) => {
                            const forcedAllow = ALWAYS_ALLOWED.has(cat.id);
                            const blocked = !forcedAllow && draft.blockedCategoryIds.includes(cat.id);
                            const Icon = CATEGORY_ICONS[cat.id] || Film;
                            return (
                                <div
                                    key={cat.id}
                                    className={`flex items-center gap-2.5 rounded-lg border border-[var(--fz-border)] px-2.5 py-2 ${
                                        forcedAllow ? 'opacity-60' : ''
                                    }`}
                                >
                                    {forcedAllow ? (
                                        <Lock size={14} className="shrink-0 text-[var(--fz-text-3)]" aria-hidden />
                                    ) : (
                                        <Icon size={16} className="shrink-0 text-[var(--fz-text-2)]" aria-hidden />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-[13px] font-medium text-[var(--fz-text-1)]">{cat.title}</p>
                                        <p className="text-meta text-[var(--fz-text-3)]">
                                            {forcedAllow ? 'Always allowed' : blocked ? 'Blocked' : 'Allowed'}
                                        </p>
                                    </div>
                                    {!forcedAllow && (
                                        <Switch
                                            checked={blocked}
                                            onCheckedChange={() => toggleCategory(cat.id)}
                                            aria-label={`Block ${cat.title}`}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </Dialog>
    );
}

export function normalizeSmartYouTubeSettings(raw?: Partial<SmartYouTubeSettings>): SmartYouTubeSettings {
    return {
        ...DEFAULT_SMART_YOUTUBE,
        ...raw,
        blockedCategoryIds:
            raw?.blockedCategoryIds?.length
                ? raw.blockedCategoryIds
                : DEFAULT_BLOCKED_CATEGORY_IDS,
        useDataApi: true,
    };
}
