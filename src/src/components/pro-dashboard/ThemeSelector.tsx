import { useEffect, useState } from 'react';
import { Lock, Palette } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import {
    PUBLIC_THEME_IDS,
    PRO_GOLD_THEME_ID,
    CUSTOM_THEME_ID,
    THEME_LABELS,
    canUseTheme,
    setEngineTheme,
    setCustomThemeColors,
    resolveCustomThemeColors,
    applyDocumentTheme,
    applyCustomThemeVars,
    type ThemeId,
    type CustomThemeColors,
} from '../../lib/themes';

const SWATCH: Record<string, string> = {
    purple: 'linear-gradient(135deg, #7c3aed, #a855f7)',
    emerald: 'linear-gradient(135deg, #059669, #34d399)',
    amber: 'linear-gradient(135deg, #d97706, #fbbf24)',
    rose: 'linear-gradient(135deg, #e11d48, #fb7185)',
    pro: 'linear-gradient(135deg, #8b6914, #d4af37 40%, #ffd700 70%, #f5e6a8)',
    custom: 'linear-gradient(135deg, var(--theme-primary, #7c3aed), var(--theme-accent, #a855f7))',
};

const CUSTOM_PRESETS: { name: string; colors: CustomThemeColors }[] = [
    { name: 'Violet', colors: { primary: '#7c3aed', accent: '#a855f7', highlight: '#c4b5fd' } },
    { name: 'Ocean', colors: { primary: '#0284c7', accent: '#38bdf8', highlight: '#7dd3fc' } },
    { name: 'Mint', colors: { primary: '#059669', accent: '#34d399', highlight: '#6ee7b7' } },
    { name: 'Sunset', colors: { primary: '#ea580c', accent: '#fb923c', highlight: '#fdba74' } },
    { name: 'Rose', colors: { primary: '#e11d48', accent: '#fb7185', highlight: '#fda4af' } },
];

function CustomThemeEditor({
    colors,
    onChange,
    onSave,
}: {
    colors: CustomThemeColors;
    onChange: (next: CustomThemeColors) => void;
    onSave: (next: CustomThemeColors) => void;
}) {
    const fields: { key: keyof CustomThemeColors; label: string }[] = [
        { key: 'primary', label: 'Primary' },
        { key: 'accent', label: 'Accent' },
        { key: 'highlight', label: 'Highlight' },
    ];

    return (
        <div className="mt-4 p-4 rounded-2xl border border-white/10 bg-white/[0.03] space-y-4 pro-card-spring">
            <div className="flex items-center gap-2">
                <Palette size={16} className="text-purple-400" />
                <h4 className="text-sm font-semibold text-white">Custom colors</h4>
            </div>
            <div className="grid grid-cols-3 gap-3">
                {fields.map(({ key, label }) => (
                    <label key={key} className="space-y-1.5">
                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                            {label}
                        </span>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={colors[key]}
                                onChange={(e) => {
                                    const next = { ...colors, [key]: e.target.value };
                                    onChange(next);
                                }}
                                className="w-10 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer pro-spring-btn"
                            />
                            <input
                                type="text"
                                value={colors[key]}
                                onChange={(e) => {
                                    const next = { ...colors, [key]: e.target.value };
                                    onChange(next);
                                }}
                                onBlur={() => onSave(colors)}
                                className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white font-mono uppercase"
                            />
                        </div>
                    </label>
                ))}
            </div>
            <div>
                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">
                    Quick presets
                </p>
                <div className="flex flex-wrap gap-2">
                    {CUSTOM_PRESETS.map((p) => (
                        <button
                            key={p.name}
                            type="button"
                            onClick={() => {
                                onChange(p.colors);
                                onSave(p.colors);
                            }}
                            className="pro-spring-btn px-3 py-1.5 rounded-lg text-[10px] font-bold border border-white/10 bg-white/5 text-white hover:bg-white/10"
                        >
                            {p.name}
                        </button>
                    ))}
                </div>
            </div>
            <div
                className="h-12 rounded-xl border border-white/10 ring-1 ring-white/10"
                style={{
                    background: `linear-gradient(90deg, ${colors.primary}, ${colors.accent}, ${colors.highlight})`,
                }}
            />
        </div>
    );
}

export function ThemeSelector() {
    const { engineState, fetchEngineState, subscriptionTier, upgradeToPro } = useAuthStore();
    const isPro = subscriptionTier === 'pro';
    const current = engineState.theme || 'purple';
    const savedColors = resolveCustomThemeColors(engineState.customTheme);
    const [draftColors, setDraftColors] = useState<CustomThemeColors>(savedColors);

    useEffect(() => {
        setDraftColors(savedColors);
    }, [savedColors.primary, savedColors.accent, savedColors.highlight, current]);

    const previewCustom = (colors: CustomThemeColors) => {
        applyCustomThemeVars(colors);
        const { engineState: st, subscriptionTier: tier } = useAuthStore.getState();
        applyDocumentTheme({ ...st, theme: CUSTOM_THEME_ID, customTheme: colors }, tier === 'pro');
    };

    const selectTheme = async (t: ThemeId) => {
        if (!canUseTheme(t, isPro)) {
            void upgradeToPro();
            return;
        }
        if (t === CUSTOM_THEME_ID) {
            await setCustomThemeColors(draftColors);
        } else {
            await setEngineTheme(t);
        }
        await fetchEngineState();
        const { engineState: st, subscriptionTier: tier } = useAuthStore.getState();
        applyDocumentTheme(st, tier === 'pro');
    };

    const saveCustom = async (next: CustomThemeColors) => {
        setDraftColors(next);
        previewCustom(next);
        await setCustomThemeColors(next);
        await fetchEngineState();
    };

    const themes: ThemeId[] = [...PUBLIC_THEME_IDS, PRO_GOLD_THEME_ID, CUSTOM_THEME_ID];

    return (
        <div className="glass-edge-card p-4">
            <h3 className="font-semibold text-white mb-1">Theme</h3>
            <p className="text-[10px] text-neutral-500 mb-4">
                {isPro
                    ? 'Pro Gold and Custom are exclusive to subscribers.'
                    : 'Upgrade to Pro to unlock Gold and Custom themes.'}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {themes.map((t) => {
                    const locked = !canUseTheme(t, isPro);
                    const active = current === t;
                    const swatchStyle =
                        t === CUSTOM_THEME_ID
                            ? {
                                  background: `linear-gradient(135deg, ${draftColors.primary}, ${draftColors.accent})`,
                              }
                            : { background: SWATCH[t] };

                    return (
                        <button
                            key={t}
                            type="button"
                            disabled={locked}
                            onClick={() => void selectTheme(t)}
                            className={`relative p-3 border rounded-2xl transition-all duration-300 pro-theme-btn overflow-hidden min-w-0 ${
                                active
                                    ? t === PRO_GOLD_THEME_ID
                                        ? 'border-amber-200/60 bg-amber-500/10 shadow-[0_0_24px_rgba(212,175,55,0.35)] scale-[1.02]'
                                        : 'border-purple-400/50 bg-purple-500/10 shadow-[0_0_20px_rgba(168,85,247,0.25)] scale-[1.02]'
                                    : locked
                                      ? 'bg-white/[0.02] border-white/5 opacity-50 cursor-not-allowed'
                                      : 'bg-white/5 border-white/10 hover:border-white/30 hover:scale-[1.02]'
                            }`}
                        >
                            <div
                                className="h-10 rounded-xl mb-2 ring-1 ring-white/10"
                                style={swatchStyle}
                            />
                            <div className="flex items-center justify-center gap-1 min-w-0">
                                {t === PRO_GOLD_THEME_ID && (
                                    <span className="text-amber-300 text-[10px] pro-badge-star shrink-0">
                                        ✦
                                    </span>
                                )}
                                {t === CUSTOM_THEME_ID && (
                                    <Palette size={11} className="text-purple-400 shrink-0" />
                                )}
                                <span className="text-xs font-bold text-white truncate">
                                    {THEME_LABELS[t]}
                                </span>
                                {locked && <Lock size={10} className="text-neutral-500 shrink-0" />}
                            </div>
                            {isProExclusiveLabel(t) && !locked && (
                                <span className="absolute top-1 right-1 text-[8px] font-black uppercase tracking-widest text-white/80 bg-white/10 px-1 rounded">
                                    Pro
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {isPro && current === CUSTOM_THEME_ID && (
                <CustomThemeEditor
                    colors={draftColors}
                    onChange={(next) => {
                        setDraftColors(next);
                        previewCustom(next);
                    }}
                    onSave={(next) => void saveCustom(next)}
                />
            )}
        </div>
    );
}

function isProExclusiveLabel(t: ThemeId): boolean {
    return t === PRO_GOLD_THEME_ID || t === CUSTOM_THEME_ID;
}
