import { useEffect, useState } from 'react';
import { Palette } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import {
    PUBLIC_THEME_IDS,
    CUSTOM_THEME_ID,
    THEME_LABELS,
    setEngineTheme,
    setCustomThemeColors,
    resolveCustomThemeColors,
    applyDocumentTheme,
    applyCustomThemeVars,
    type ThemeId,
    type CustomThemeColors,
} from '../../lib/themes';

const SWATCH: Record<string, string> = {
    blue: 'linear-gradient(135deg, oklch(0.68 0.15 255), oklch(0.78 0.12 255))',
    purple: 'linear-gradient(135deg, oklch(0.68 0.15 295), oklch(0.78 0.12 295))',
    emerald: 'linear-gradient(135deg, oklch(0.68 0.15 155), oklch(0.78 0.12 155))',
    amber: 'linear-gradient(135deg, oklch(0.68 0.15 75), oklch(0.78 0.12 75))',
    rose: 'linear-gradient(135deg, oklch(0.68 0.15 15), oklch(0.78 0.12 15))',
    custom: 'linear-gradient(135deg, var(--theme-primary, #3b82f6), var(--theme-accent, #5ea2ff))',
};

const CUSTOM_PRESETS: { name: string; colors: CustomThemeColors }[] = [
    { name: 'Violet', colors: { primary: '#3b82f6', accent: '#5ea2ff', highlight: '#bfdbfe' } },
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
        <div className="mt-4 p-4 rounded-lg border border-white/8 bg-white/4 space-y-4 pro-card-spring">
            <div className="flex items-center gap-2">
                <Palette size={16} className="text-blue-400" />
                <h4 className="text-sm font-semibold text-white">Custom colors</h4>
            </div>
            <div className="grid grid-cols-3 gap-3">
                {fields.map(({ key, label }) => (
                    <label key={key} className="space-y-1.5">
                        <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest">
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
                                className="w-10 h-10 rounded-lg border border-white/8 bg-transparent cursor-pointer pro-spring-btn"
                            />
                            <input
                                type="text"
                                value={colors[key]}
                                onChange={(e) => {
                                    const next = { ...colors, [key]: e.target.value };
                                    onChange(next);
                                }}
                                onBlur={() => onSave(colors)}
                                className="flex-1 min-w-0 bg-black/40 border border-white/8 rounded-lg px-2 py-1.5 text-[11px] text-white font-mono uppercase"
                            />
                        </div>
                    </label>
                ))}
            </div>
            <div>
                <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-2">
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
                            className="pro-spring-btn px-3 py-1.5 rounded-lg text-[11px] font-bold border border-white/8 bg-white/6 text-white hover:bg-white/10"
                        >
                            {p.name}
                        </button>
                    ))}
                </div>
            </div>
            <div
                className="h-12 rounded-lg border border-white/8 ring-1 ring-white/8"
                style={{
                    background: `linear-gradient(90deg, ${colors.primary}, ${colors.accent}, ${colors.highlight})`,
                }}
            />
        </div>
    );
}

export function ThemeSelector() {
    const { engineState, fetchEngineState } = useAuthStore();
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

    const themes: ThemeId[] = [...PUBLIC_THEME_IDS, CUSTOM_THEME_ID];

    return (
        <div className="glass-edge-card p-4">
            <h3 className="font-semibold text-white mb-1">Accent</h3>
            <p className="text-[11px] text-neutral-500 mb-4">
                Pick an accent color, or choose Custom to define your own palette.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {themes.map((t) => {
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
                            onClick={() => void selectTheme(t)}
                            className={`relative p-3 border rounded-lg transition-all duration-300 pro-theme-btn overflow-hidden min-w-0 ${
                                active
                                    ? 'border-blue-400/50 bg-blue-500/10 shadow-[0_0_20px_rgba(168,85,247,0.25)] scale-[1.02]'
                                    : 'bg-white/6 border-white/8 hover:border-white/16 hover:scale-[1.02]'
                            }`}
                        >
                            <div
                                className="h-10 rounded-lg mb-2 ring-1 ring-white/8"
                                style={swatchStyle}
                            />
                            <div className="flex items-center justify-center gap-1 min-w-0">
                                {t === CUSTOM_THEME_ID && (
                                    <Palette size={11} className="text-blue-400 shrink-0" />
                                )}
                                <span className="text-xs font-bold text-white truncate">
                                    {THEME_LABELS[t]}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {current === CUSTOM_THEME_ID && (
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
