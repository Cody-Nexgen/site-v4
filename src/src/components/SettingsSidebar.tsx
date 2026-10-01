import { useState, useEffect } from 'react';
import { X, User, CreditCard, Moon, Sun, Monitor, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store';

interface SettingsSidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SettingsSidebar({ isOpen, onClose }: SettingsSidebarProps) {
    const { session, signOut, subscriptionTier } = useAuthStore();
    const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');

    // Load theme from storage on mount
    useEffect(() => {
        chrome.storage.local.get(['theme'], (result) => {
            if (result.theme && typeof result.theme === 'string') {
                const validTheme = result.theme as 'dark' | 'light' | 'system';
                setTheme(validTheme);
                applyTheme(validTheme);
            }
        });
    }, []);

    const applyTheme = (newTheme: 'dark' | 'light' | 'system') => {
        let effectiveTheme = newTheme;

        if (newTheme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            effectiveTheme = prefersDark ? 'dark' : 'light';
        }

        // Apply theme to document
        if (effectiveTheme === 'light') {
            document.documentElement.classList.add('light-theme');
            document.documentElement.classList.remove('dark-theme');
        } else {
            document.documentElement.classList.add('dark-theme');
            document.documentElement.classList.remove('light-theme');
        }
    };

    const handleThemeChange = async (newTheme: 'dark' | 'light' | 'system') => {
        setTheme(newTheme);
        await chrome.storage.local.set({ theme: newTheme });
        applyTheme(newTheme);
    };

    const handleManageSubscription = () => {
        if (!session) {
            alert('Please log in to manage your subscription');
            return;
        }
        chrome.tabs.create({ url: 'https://focuznow.com/manage_subscription' });
    };

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <div
                className={`
          fixed top-0 right-0 h-full w-80 bg-neutral-950 border-l border-white/8 z-50 transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
            >
                <div className="flex items-center justify-between p-4 border-b border-white/8">
                    <h2 className="text-lg font-semibold text-white">Settings</h2>
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-neutral-400 hover:text-white">
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                <div className="p-4 space-y-6">
                    {/* Account Section */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Account</h3>

                        <div className="bg-neutral-900/50 rounded-lg p-3 border border-white/8 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400">
                                <User className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">
                                    {session?.user?.email || 'Not logged in'}
                                </p>
                                <p className="text-xs text-neutral-500 capitalize">
                                    {subscriptionTier === 'pro' ? (
                                        <span className="text-blue-400 font-semibold">Pro Plan</span>
                                    ) : (
                                        'Free Plan'
                                    )}
                                </p>
                            </div>
                        </div>

                        <Button
                            variant="outline"
                            className="w-full justify-start text-neutral-300 border-white/8 hover:bg-white/6 hover:text-white"
                            onClick={handleManageSubscription}
                        >
                            <CreditCard className="mr-2 h-4 w-4" />
                            Manage Subscription
                        </Button>

                        <Button
                            variant="ghost"
                            className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-900/10"
                            onClick={() => {
                                signOut();
                                onClose();
                            }}
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            Sign Out
                        </Button>
                    </div>

                    {/* Appearance Section */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Appearance</h3>

                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => handleThemeChange('light')}
                                className={`flex flex-col items-center gap-2 p-2 rounded-lg border transition-all ${theme === 'light'
                                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
                                    : 'bg-neutral-900/50 border-white/8 text-neutral-500 hover:bg-white/6'
                                    }`}
                            >
                                <Sun className="h-5 w-5" />
                                <span className="text-xs">Light</span>
                            </button>

                            <button
                                onClick={() => handleThemeChange('dark')}
                                className={`flex flex-col items-center gap-2 p-2 rounded-lg border transition-all ${theme === 'dark'
                                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
                                    : 'bg-neutral-900/50 border-white/8 text-neutral-500 hover:bg-white/6'
                                    }`}
                            >
                                <Moon className="h-5 w-5" />
                                <span className="text-xs">Dark</span>
                            </button>

                            <button
                                onClick={() => handleThemeChange('system')}
                                className={`flex flex-col items-center gap-2 p-2 rounded-lg border transition-all ${theme === 'system'
                                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
                                    : 'bg-neutral-900/50 border-white/8 text-neutral-500 hover:bg-white/6'
                                    }`}
                            >
                                <Monitor className="h-5 w-5" />
                                <span className="text-xs">System</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
