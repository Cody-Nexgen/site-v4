import { useEffect, useState } from 'react';
import { useAuthStore } from '../../lib/store';
import { useProDashboardVisuals } from '../../lib/proDashboard';
import {
    getDashboardColorMode,
    normalizeThemeForUser,
    setDashboardColorMode,
    setEngineTheme,
    subscribeToDashboardColorMode,
    type DashboardColorMode,
} from '../../lib/themes';
import { ACCENTS, accentHueFor, accentSwatch, applyAccentHue, readCustomHue, writeCustomHue, type AccentId } from '../../lib/accents';
import { readSidebarDefaultMode, setSidebarDefaultMode, useSidebarStyle, type SidebarMode } from '../../lib/sidebar';
import { SegmentedControl } from '../../components/fz/SegmentedControl';
import { Switch } from '../../components/fz/Switch';
import { SettingRow, SettingsSection } from './SettingsPrimitives';

export function AppearanceSection() {
    const engineTheme = useAuthStore((s) => s.engineState.theme);
    const { enabled: motionOn, setEnabled: setMotionOn } = useProDashboardVisuals();
    const [colorMode, setColorMode] = useState<DashboardColorMode>(() => getDashboardColorMode());
    const [customHue, setCustomHue] = useState(() => readCustomHue());
    const [sidebarDefault, setSidebarDefault] = useState<SidebarMode>(() => readSidebarDefaultMode());
    const sidebarStyle = useSidebarStyle();
    const accentId = normalizeThemeForUser(engineTheme, true);

    useEffect(() => subscribeToDashboardColorMode(setColorMode), []);

    const pickAccent = (id: string, hue?: number) => {
        if (id === 'custom') {
            const h = hue ?? customHue;
            if (hue !== undefined) {
                writeCustomHue(h);
                setCustomHue(h);
            }
            applyAccentHue(h);
        } else {
            applyAccentHue(accentHueFor(id));
        }
        void setEngineTheme(id as AccentId);
    };

    const swatchRing = (active: boolean) =>
        active ? 'ring-2 ring-[var(--fz-text-1)] ring-offset-2 ring-offset-[var(--dashboard-surface-raised)]' : 'ring-1 ring-[var(--fz-border)]';

    return (
        <SettingsSection id="appearance" title="Appearance">
            <SettingRow
                title="Theme"
                description="Light, dark, or match your system."
                keywords="dark mode light mode color scheme night"
                control={
                    <SegmentedControl
                        size="sm"
                        idPrefix="settings-theme"
                        value={colorMode}
                        onChange={(m) => {
                            setColorMode(m);
                            void setDashboardColorMode(m);
                        }}
                        options={[
                            { value: 'light' as const, label: 'Light' },
                            { value: 'dark' as const, label: 'Dark' },
                            { value: 'system' as const, label: 'System' },
                        ]}
                    />
                }
            />
            <SettingRow
                title="Accent color"
                description="Used for focus rings, progress and highlights."
                keywords="accent colour highlight hue tint"
                control={
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        {ACCENTS.filter((a) => a.id !== 'custom').map((a) => (
                            <button
                                key={a.id}
                                type="button"
                                title={a.label}
                                aria-label={`${a.label} accent`}
                                aria-pressed={accentId === a.id}
                                onClick={() => pickAccent(a.id)}
                                className={`size-5 rounded-full transition-transform hover:scale-110 ${swatchRing(accentId === a.id)}`}
                                style={{ background: accentSwatch(a.hue) }}
                            />
                        ))}
                        <button
                            type="button"
                            title="Custom"
                            aria-label="Custom accent"
                            aria-pressed={accentId === 'custom'}
                            onClick={() => pickAccent('custom')}
                            className={`size-5 rounded-full transition-transform hover:scale-110 ${swatchRing(accentId === 'custom')}`}
                            style={{ background: 'conic-gradient(from 0deg, oklch(0.68 0.15 15), oklch(0.68 0.15 160), oklch(0.68 0.15 255), oklch(0.68 0.15 15))' }}
                        />
                    </div>
                }
            >
                {accentId === 'custom' && (
                    <div className="mt-3 flex items-center gap-3">
                        <span className="text-meta w-10 shrink-0">Hue</span>
                        <input
                            type="range"
                            min={0}
                            max={360}
                            value={customHue}
                            aria-label="Custom accent hue"
                            onChange={(e) => pickAccent('custom', Number(e.target.value))}
                            className="h-1.5 w-full cursor-pointer appearance-none rounded-full"
                            style={{
                                background:
                                    'linear-gradient(90deg, oklch(0.68 0.15 0), oklch(0.68 0.15 60), oklch(0.68 0.15 120), oklch(0.68 0.15 180), oklch(0.68 0.15 240), oklch(0.68 0.15 300), oklch(0.68 0.15 360))',
                            }}
                        />
                        <span className="size-5 shrink-0 rounded-full ring-1 ring-[var(--fz-border)]" style={{ background: accentSwatch(customHue) }} />
                    </div>
                )}
            </SettingRow>
            <SettingRow
                title="Reduce motion"
                description="Fewer animations and transitions across the dashboard."
                keywords="animation motion accessibility calm"
                control={<Switch checked={!motionOn} onCheckedChange={(v) => void setMotionOn(!v)} aria-label="Reduce motion" />}
            />
            {sidebarStyle === 'modern' && (
                <SettingRow
                    title="Sidebar opens as"
                    description="Full labels, or a slim rail of icons."
                    keywords="sidebar navigation rail collapsed expanded menu"
                    control={
                        <SegmentedControl
                            size="sm"
                            idPrefix="settings-sidebar"
                            value={sidebarDefault}
                            onChange={(m) => {
                                setSidebarDefault(m);
                                setSidebarDefaultMode(m);
                            }}
                            options={[
                                { value: 'expanded' as const, label: 'Expanded' },
                                { value: 'rail' as const, label: 'Rail' },
                            ]}
                        />
                    }
                />
            )}
        </SettingsSection>
    );
}
