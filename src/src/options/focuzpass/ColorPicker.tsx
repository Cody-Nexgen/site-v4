import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Check, Plus } from 'lucide-react';
import { hexToHsv, hexToRgb, hsvToHex, normalizeHex, parseRgb, rgbToHex, rgbToHsv, type Hsv } from '../../lib/focuzPass/color';
import { FloatingPanel } from './FloatingPanel';

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Preset swatches, plus a custom colour in a popover: drag the dot around the square (saturation and
 * brightness), pick the hue on the strip beside it, or type a hex or RGB value. Hands back "#rrggbb".
 */
export function ColorPicker({ value, presets, onChange }: { value: string; presets: string[]; onChange: (hex: string) => void }) {
    const current = value.toLowerCase();
    const isPreset = presets.includes(current);
    const [open, setOpen] = useState(false);
    const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value) ?? { h: 210, s: 0.4, v: 0.72 });
    // What's being typed; null shows the current colour.
    const [draft, setDraft] = useState<string | null>(null);
    const customRef = useRef<HTMLButtonElement>(null);
    const areaRef = useRef<HTMLDivElement>(null);
    const hueRef = useRef<HTMLDivElement>(null);

    const apply = (next: Hsv) => {
        setHsv(next);
        onChange(hsvToHex(next));
    };
    const fromText = (text: string): boolean => {
        const rgb = normalizeHex(text) ? hexToRgb(text) : parseRgb(text);
        if (!rgb) return false;
        const next = rgbToHsv(rgb);
        // Greys have no hue: keep the strip where it was.
        setHsv(next.s === 0 ? { ...next, h: hsv.h } : next);
        onChange(rgbToHex(rgb));
        return true;
    };

    const pickArea = (event: PointerEvent<HTMLDivElement>) => {
        const box = areaRef.current?.getBoundingClientRect();
        if (!box) return;
        apply({ h: hsv.h, s: clamp01((event.clientX - box.left) / box.width), v: clamp01(1 - (event.clientY - box.top) / box.height) });
    };
    const pickHue = (event: PointerEvent<HTMLDivElement>) => {
        const box = hueRef.current?.getBoundingClientRect();
        if (!box) return;
        apply({ ...hsv, h: clamp01((event.clientY - box.top) / box.height) * 359 });
    };
    const nudgeArea = (event: KeyboardEvent<HTMLDivElement>) => {
        const step = event.shiftKey ? 0.1 : 0.02;
        const ds = event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0;
        const dv = event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0;
        if (!ds && !dv) return;
        event.preventDefault();
        apply({ h: hsv.h, s: clamp01(hsv.s + ds), v: clamp01(hsv.v + dv) });
    };
    const nudgeHue = (event: KeyboardEvent<HTMLDivElement>) => {
        const step = event.shiftKey ? 15 : 3;
        const dh = event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0;
        if (!dh) return;
        event.preventDefault();
        apply({ ...hsv, h: (hsv.h + dh + 360) % 360 });
    };

    const hex = normalizeHex(value) ?? hsvToHex(hsv);
    const rgb = hexToRgb(hex)!;

    return (
        <div className="vault-color-grid" role="radiogroup" aria-label="Colour">
            {presets.map((preset) => (
                <button
                    key={preset}
                    type="button"
                    role="radio"
                    aria-checked={current === preset}
                    className={current === preset ? 'is-selected' : ''}
                    style={{ background: preset }}
                    onClick={() => fromText(preset)}
                    aria-label={`Use ${preset}`}
                />
            ))}
            <button
                ref={customRef}
                type="button"
                role="radio"
                aria-checked={!isPreset}
                aria-haspopup="dialog"
                aria-expanded={open}
                className={`vault-color-custom${!isPreset ? ' is-selected' : ''}`}
                style={!isPreset ? { background: hex } : undefined}
                onClick={() => {
                    if (!open) setHsv(hexToHsv(hex) ?? hsv);
                    setOpen((was) => !was);
                }}
                aria-label="Custom colour"
                title="Custom colour"
            >
                {isPreset ? <Plus size={12} /> : <Check size={11} />}
            </button>

            <FloatingPanel anchor={customRef} open={open} onClose={() => setOpen(false)} role="dialog" minWidth={236} maxHeight={320} className="vault-color-popover">
                <div className="vault-color-pickers">
                    <div
                        ref={areaRef}
                        className="vault-color-area"
                        style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
                        role="slider"
                        tabIndex={0}
                        aria-label="Saturation and brightness"
                        aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
                        onKeyDown={nudgeArea}
                        onPointerDown={(event) => {
                            event.currentTarget.setPointerCapture(event.pointerId);
                            pickArea(event);
                        }}
                        onPointerMove={(event) => {
                            if (event.currentTarget.hasPointerCapture(event.pointerId)) pickArea(event);
                        }}
                    >
                        <span className="vault-color-dot" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex }} />
                    </div>
                    <div
                        ref={hueRef}
                        className="vault-color-hue-strip"
                        role="slider"
                        tabIndex={0}
                        aria-label="Hue"
                        aria-orientation="vertical"
                        aria-valuemin={0}
                        aria-valuemax={359}
                        aria-valuenow={Math.round(hsv.h)}
                        onKeyDown={nudgeHue}
                        onPointerDown={(event) => {
                            event.currentTarget.setPointerCapture(event.pointerId);
                            pickHue(event);
                        }}
                        onPointerMove={(event) => {
                            if (event.currentTarget.hasPointerCapture(event.pointerId)) pickHue(event);
                        }}
                    >
                        <span style={{ top: `${(hsv.h / 359) * 100}%`, background: `hsl(${hsv.h} 100% 50%)` }} />
                    </div>
                </div>
                <label className="vault-color-field">
                    <span className="vault-color-field-swatch" style={{ background: hex }} aria-hidden="true" />
                    <input
                        value={draft ?? hex.toUpperCase()}
                        spellCheck={false}
                        aria-label="Hex or RGB colour"
                        title={`RGB ${rgb.r}, ${rgb.g}, ${rgb.b}`}
                        onChange={(event) => {
                            setDraft(event.target.value);
                            const raw = event.target.value.trim().replace(/^#/, '');
                            // Apply as soon as it's a full hex or an RGB triple; partial typing just waits.
                            if (raw.length === 6 || /[,\s]/.test(raw)) fromText(event.target.value);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                if (draft !== null) fromText(draft);
                                setDraft(null);
                            }
                        }}
                        onBlur={() => {
                            if (draft !== null) fromText(draft);
                            setDraft(null);
                        }}
                    />
                    <small>Hex or RGB</small>
                </label>
            </FloatingPanel>
        </div>
    );
}
