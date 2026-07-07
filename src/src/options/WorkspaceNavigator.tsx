import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, File, Folder, X } from 'lucide-react';
import { WORKSPACE_NAV, tabLabel, tabSection, resolveTabId } from '../lib/workspaceNav';

export type WorkspaceGroup = {
    id: string;
    label: string;
    pages: { tab: string; label: string }[];
};

export const WORKSPACE_GROUPS: WorkspaceGroup[] = WORKSPACE_NAV.map((section) => ({
    id: section.id,
    label: section.label,
    pages: section.tabs.map((t) => ({ tab: t.id, label: t.label })),
}));

export { tabLabel, resolveTabId };

export function tabToGroup(tab: string): WorkspaceGroup {
    const section = tabSection(tab);
    return {
        id: section.id,
        label: section.label,
        pages: section.tabs.map((t) => ({ tab: t.id, label: t.label })),
    };
}

type Props = {
    open: boolean;
    onClose: () => void;
    activeTab: string;
    onNavigate: (tab: string) => void;
};

export function WorkspaceNavigator({ open, onClose, activeTab, onNavigate }: Props) {
    const [folderId, setFolderId] = useState<string | null>(null);
    const resolvedActive = resolveTabId(activeTab);

    useEffect(() => {
        if (!open) setFolderId(null);
    }, [open]);

    const currentFolder = WORKSPACE_GROUPS.find((g) => g.id === folderId);

    const openPage = (tab: string) => {
        onNavigate(tab);
        onClose();
    };

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="fixed inset-0 z-[280] bg-[#121212] flex flex-col"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <header className="h-12 px-5 flex items-center justify-between border-b border-white/10 bg-[#161616]">
                        <div className="flex items-center gap-2 text-[11px] font-bold text-neutral-500 uppercase tracking-widest">
                            {folderId && (
                                <button
                                    type="button"
                                    onClick={() => setFolderId(null)}
                                    className="text-neutral-400 hover:text-white mr-2"
                                >
                                    ←
                                </button>
                            )}
                            <span>{folderId ? currentFolder?.label : 'Folders'}</span>
                        </div>
                        <button type="button" onClick={onClose} className="text-neutral-500 hover:text-white p-1">
                            <X size={16} />
                        </button>
                    </header>

                    <motion.div className="flex-1 overflow-y-auto">
                        <p className="px-5 py-3 text-[10px] font-bold text-neutral-600 uppercase tracking-[0.15em]">
                            {folderId ? 'Pages' : 'Folders'}
                        </p>

                        <div className="border-t border-white/[0.06]">
                            {!folderId
                                ? WORKSPACE_GROUPS.map((group) => (
                                      <button
                                          key={group.id}
                                          type="button"
                                          onClick={() => setFolderId(group.id)}
                                          onDoubleClick={() => setFolderId(group.id)}
                                          className="w-full flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.04] hover:bg-white/[0.03] text-left transition-colors group"
                                      >
                                          <ChevronRight size={14} className="text-neutral-600 flex-shrink-0" />
                                          <div className="w-9 h-9 rounded-lg bg-neutral-800/80 border border-white/10 flex items-center justify-center flex-shrink-0">
                                              <Folder size={18} className="text-neutral-400" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                              <p className="text-sm font-medium text-neutral-200 truncate">{group.label}</p>
                                              <p className="text-xs text-neutral-600">Folder · {group.pages.length} items</p>
                                          </div>
                                          <span className="text-neutral-700 text-sm">—</span>
                                      </button>
                                  ))
                                : currentFolder?.pages.map((page) => (
                                      <button
                                          key={page.tab}
                                          type="button"
                                          onDoubleClick={() => openPage(page.tab)}
                                          onClick={() => openPage(page.tab)}
                                          className={`w-full flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.04] hover:bg-white/[0.03] text-left transition-colors ${
                                              resolvedActive === page.tab ? 'bg-sky-500/10' : ''
                                          }`}
                                      >
                                          <span className="w-[14px]" />
                                          <div className="w-9 h-9 rounded-lg bg-neutral-800/80 border border-white/10 flex items-center justify-center flex-shrink-0">
                                              <File size={16} className="text-neutral-400" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                              <p className="text-sm font-medium text-neutral-200 truncate">{page.label}</p>
                                              <p className="text-xs text-neutral-600">Page</p>
                                          </div>
                                          <span className="text-neutral-700 text-sm">—</span>
                                      </button>
                                  ))}
                        </div>

                        <p className="px-5 py-4 text-[11px] text-neutral-600">
                            {folderId ? 'Click a page to open.' : 'Click a folder to browse its pages.'}
                        </p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
