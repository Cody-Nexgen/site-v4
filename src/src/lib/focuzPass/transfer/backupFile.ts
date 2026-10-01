import type { VaultExportPackage } from '../types';

/** Reads a .focuzpass backup file. The service worker checks it properly before opening it. */
export async function readBackupFile(file: File): Promise<VaultExportPackage> {
    if (file.size > 64 * 1024 * 1024) throw new Error('That file is too big to be a FocuzPass backup.');
    const notBackup = 'That isn\'t a FocuzPass backup file.';
    let pkg: unknown;
    try {
        pkg = JSON.parse(await file.text());
    } catch {
        throw new Error(notBackup);
    }
    if ((pkg as { format?: string })?.format !== 'focuzpass-export') throw new Error(notBackup);
    return pkg as VaultExportPackage;
}
