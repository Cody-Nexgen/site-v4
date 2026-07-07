// Mock Chrome API for browser testing
export const mockChrome = {
    runtime: {
        sendMessage: async (msg: any) => {
            console.log('[MockChrome] sendMessage:', msg);
            if (msg.type === 'GET_STATE') {
                return {
                    ok: true,
                    state: {
                        blocklist: {},
                        categoriesActive: {},
                        schedules: {},
                        timers: {}
                    }
                };
            }
            return { ok: true };
        },
        onMessage: {
            addListener: () => { }
        }
    },
    storage: {
        local: {
            get: (keys: string[], cb: (result: any) => void) => {
                console.log('[MockChrome] storage.local.get:', keys);
                const result: any = {};
                keys.forEach(k => {
                    if (k === 'hasSeenOnboarding') result[k] = false; // Always show onboarding in preview
                    if (k === 'devMode') result[k] = true; // Default to dev mode in preview
                });
                cb(result);
            },
            set: (items: any) => {
                console.log('[MockChrome] storage.local.set:', items);
            }
        }
    },
    tabs: {
        query: async () => {
            return [];
        },
        create: async (props: any) => {
            console.log('[MockChrome] tabs.create:', props);
        }
    }
};

// Inject into window if not present
if (typeof window !== 'undefined' && !(window as any).chrome?.runtime) {
    (window as any).chrome = mockChrome;
}
