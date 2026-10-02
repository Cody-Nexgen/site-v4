import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Check, Plus } from 'lucide-react';
import { hexToHsv, hexToRgb, hsvToHex, normalizeHex, parseRgb, rgbToHex, rgbToHsv, type Hsv } from '../../lib/focuzPass/color';

/**
 * Preset swatches, plus a custom colour: drag the dot around the square (saturation and
 * brightness), pick the hue on the slider, or type a hex or RGB value. Always hands back "#rrggbb".
 */
export function ColorPicker({ value, presets, onChange }: { value: string; presets: string[]; onChange: (hex: string) => void }) {
    const isPreset = presets.includes(value.toLowerCase());
    const [customOpen, setCustomOpen] = useState(!isPreset);
    const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value) ?? { h: 210, s: 0.4, v: 0.72 });
    // What's being typed; null shows the current colour.
    const [hexDraft, setHexDraft] = useState<string | null>(null);
    const [rgbDraft, setRgbDraft] = useState<string | null>(null);
    const areaRef = useRef<HTMLDivElement>(null);

    const apply = (next: Hsv) => {
        setHsv(next);
        setHexDraft(null);
        setRgbDraft(null);
        onChange(hsvToHex(next));
    };
    const fromHex = (hex: string) => {
        const next = hexToHsv(hex);
        // Keep the hue for greys (it's undefined there), so the slider doesn't jump.
        if (next) apply(next.s === 0 ? { ...next, h: hsv.h } : next);
    };

    const pickAt = (event: PointerEvent<HTMLDivElement>) => {
        const box = areaRef.current?.getBoundingClientRect();
        if (!box) return;
        const s = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
        const v = Math.min(1, Math.max(0, 1 - (event.clientY - box.top) / box.height));
        apply({ ...hsv, s, v });
    };
    const nudge = (event: KeyboardEvent<HTMLDivElement>) => {
        const step = event.shiftKey ? 0.1 : 0.02;
        const moves: Record<string, Partial<Hsv>> = {
            ArrowLeft: { s: hsv.s - step },
            ArrowRight: { s: hsv.s + step },
            ArrowUp: { v: hsv.v + step },
            ArrowDown: { v: hsv.v - step },
        };
        const move = moves[event.key];
        if (!move) return;
        event.preventDefault();
        apply({ h: hsv.h, s: Math.min(1, Math.max(0, move.s ?? hsv.s)), v: Math.min(1, Math.max(0, move.v ?? hsv.v)) });
    };

    const hex = normalizeHex(value) ?? hsvToHex(hsv);
    const rgb = hexToRgb(hex)!;

    return (
        <div className="vault-color-picker">
            <div className="vault-color-grid" role="radiogroup" aria-label="Colour">
                {presets.map((preset) => (
                    <button
                        key={preset}
                        type="button"
                        role="radio"
                        aria-checked={value.toLowerCase() === preset}
                        className={value.toLowerCase() === preset ? 'is-selected' : ''}
                        style={{ background: preset }}
                        onClick={() => {
                            fromHex(preset);
                            setCustomOpen(false);
                        }}
                        aria-label={`Use ${preset}`}
                    />
                ))}
                <button
                    type="button"
                    role="radio"
                    aria-checked={!isPreset}
                    aria-expanded={customOpen}
                    className={`vault-color-custom${!isPreset ? ' is-selected' : ''}`}
                    style={!isPreset ? { background: hex } : undefined}
                    onClick={() => setCustomOpen((open) => !open)}
                    aria-label="Custom colour"
                    title="Custom colour"
                >
                    {isPreset ? <Plus size={12} /> : <Check size={11} />}
                </button>
            </div>

            {customOpen && (
                <div className="vault-color-custom-panel">
                    <div
                        ref={areaRef}
                        className="vault-color-area"
                        style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
                        role="slider"
                        tabIndex={0}
                        aria-label="Saturation and brightness"
                        aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
                        onPointerDown={(event) => {
                            event.currentTarget.setPointerCapture(event.pointerId);
                            pickAt(event);
                        }}
                        onPointerMove={(event) => {
                            if (event.currentTarget.hasPointerCapture(event.pointerId)) pickAt(event);
                        }}
                        onKeyDown={nudge}
                    >
                        <span className="vault-color-dot" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex }} />
                    </div>
                    <input
                        className="vault-color-hue"
                        type="range"
                        min={0}
                        max={359}
                        value={Math.round(hsv.h)}
                        aria-label="Hue"
                        onChange={(event) => apply({ ...hsv, h: Number(event.target.value) })}
                    />
                    <div className="vault-color-inputs">
                        <label>
                            <span>Hex</span>
                            <input
                                value={hexDraft ?? hex.toUpperCase()}
                                spellCheck={false}
                                maxLength={7}
                                onChange={(event) => {
                                    setHexDraft(event.target.value);
                                    const clean = normalizeHex(event.target.value);
                                    if (clean && clean.length === 7 && event.target.value.replace('#', '').length === 6) {
                                        fromHex(clean);
                                        setHexDraft(event.target.value);
                                    }
                                }}
                                onBlur={() => {
                                    const clean = hexDraft === null ? null : normalizeHex(hexDraft);
                                    if (clean) fromHex(clean);
                                    setHexDraft(null);
                                }}
                            />
                        </label>
                        <label>
                            <span>RGB</span>
                            <input
                                value={rgbDraft ?? `${rgb.r}, ${rgb.g}, ${rgb.b}`}
                                spellCheck={false}
                                onChange={(event) => {
                                    setRgbDraft(event.target.value);
                                    const parsed = parseRgb(event.target.value);
                                    if (parsed) {
                                        const next = rgbToHsv(parsed);
                                        setHsv(next.s === 0 ? { ...next, h: hsv.h } : next);
                                        onChange(rgbToHex(parsed));
                                    }
                                }}
                                onBlur={() => setRgbDraft(null)}
                            />
                        </label>
                    </div>
                </div>
            )}
        </div>
    );
}
