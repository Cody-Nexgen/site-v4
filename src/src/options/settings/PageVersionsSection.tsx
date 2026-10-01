import { RotateCcw } from 'lucide-react';
import { VERSIONED_PAGES, legacyCount, resetPageVersions, setPageVersion, usePageVersions, type PageVersion } from '../../lib/pageVersions';
import { Button } from '../../components/fz/Button';
import { SegmentedControl } from '../../components/fz/SegmentedControl';
import { SettingRow, SettingsSection } from './SettingsPrimitives';

export function PageVersionsSection() {
    const versions = usePageVersions();
    const legacy = legacyCount(versions);

    return (
        <SettingsSection
            id="versions"
            title="Page versions"
            description={
                legacy
                    ? `${legacy} ${legacy === 1 ? 'page uses' : 'pages use'} the legacy design. Your data is the same in both versions.`
                    : 'Prefer an older design? Switch any page back. Your data is the same in both versions.'
            }
            action={
                legacy > 0 && (
                    <Button variant="ghost" size="sm" iconLeft={<RotateCcw size={13} />} onClick={() => void resetPageVersions()}>
                        Use new everywhere
                    </Button>
                )
            }
        >
            {VERSIONED_PAGES.map((page) => {
                const value: PageVersion = versions[page.id] === 'legacy' ? 'legacy' : 'new';
                return (
                    <SettingRow
                        key={page.id}
                        title={page.label}
                        description={value === 'legacy' ? `Using the legacy design. New: ${page.whatsNew}` : page.whatsNew}
                        keywords={`legacy classic old new version design ${page.whatsNew}`}
                        control={
                            <SegmentedControl
                                size="sm"
                                idPrefix={`settings-ver-${page.id}`}
                                value={value}
                                onChange={(v) => void setPageVersion(page.id, v)}
                                options={[
                                    { value: 'new' as const, label: 'New' },
                                    { value: 'legacy' as const, label: 'Legacy' },
                                ]}
                            />
                        }
                    />
                );
            })}
        </SettingsSection>
    );
}
