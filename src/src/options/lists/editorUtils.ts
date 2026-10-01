import { useEffect, useState } from 'react';
import {
    Apple,
    BookOpen,
    Brain,
    Briefcase,
    Calendar,
    Camera,
    CheckSquare,
    Clock,
    Cloud,
    Code2,
    Coffee,
    Compass,
    Dumbbell,
    FileText,
    Flag,
    Flame,
    Folder,
    Gift,
    Globe,
    GraduationCap,
    Hash,
    Heart,
    Home,
    Inbox,
    Key,
    Leaf,
    Lightbulb,
    Link2,
    ListTodo,
    Lock,
    Mail,
    Map,
    MessageCircle,
    Moon,
    Music,
    Palette,
    PenLine,
    Pin,
    Plane,
    Rocket,
    Sparkles,
    Star,
    Sun,
    Target,
    Timer,
    Trophy,
    User,
    Users,
    Wallet,
    Zap,
    type LucideIcon,
} from 'lucide-react';
import type { AttachmentRecord } from '../../lib/attachmentApi';
import type { SavedList } from '../../lib/listTypes';
import { supabase } from '../../lib/supabase';

/* ── icon tokens ──────────────────────────────────────────────────────
 * An icon is stored as a string:
 *   "📌"                      → emoji
 *   "icon:<Name>:<#color>"    → one of ICONS below, tinted
 *   "img:<url or data url>"   → uploaded / linked image
 */

export const ICONS: Record<string, LucideIcon> = {
    FileText, ListTodo, CheckSquare, BookOpen, PenLine, Lightbulb, Target, Rocket, Star, Heart,
    Flame, Zap, Sparkles, Brain, GraduationCap, Briefcase, Calendar, Clock, Timer, Inbox,
    Mail, MessageCircle, Folder, Pin, Flag, Trophy, Gift, Home, Map, Compass,
    Plane, Globe, Sun, Moon, Cloud, Leaf, Apple, Coffee, Dumbbell, Music,
    Camera, Palette, Code2, Key, Lock, Wallet, Users, User, Link2, Hash,
};

export const ICON_COLORS = ['#9b9a97', '#a27763', '#d9730d', '#cb912f', '#448361', '#337ea9', '#9065b0', '#c14c8a', '#d44c47'];

/* ── covers ─────────────────────────────────────────────────────────── */

export const COVERS: { id: string; css: string }[] = [
    { id: 'dusk', css: 'linear-gradient(135deg, #ff9a8b 0%, #ff6a88 55%, #ff99ac 100%)' },
    { id: 'sky', css: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)' },
    { id: 'mint', css: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)' },
    { id: 'orchid', css: 'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)' },
    { id: 'navy', css: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)' },
    { id: 'graphite', css: 'linear-gradient(135deg, #232526 0%, #414345 100%)' },
    { id: 'peach', css: 'linear-gradient(120deg, #f6d365 0%, #fda085 100%)' },
    { id: 'violet', css: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
];

export function coverStyle(cover: string) {
    if (cover.startsWith('gradient:')) {
        return { backgroundImage: COVERS.find((c) => `gradient:${c.id}` === cover)?.css ?? COVERS[0].css };
    }
    return { backgroundImage: `url("${cover.replace(/"/g, '%22')}")`, backgroundSize: 'cover', backgroundPosition: 'center' };
}

/* ── page helpers ───────────────────────────────────────────────────── */

/** Blocks edited as one run of text (Enter / Backspace / arrows flow between them). */
export const TEXTUAL = new Set(['text', 'heading', 'quote', 'callout', 'toggle']);

export function isEmptyList(list: SavedList) {
    return list.blocks.every((block) => {
        if (block.items) return block.items.every((item) => !item.text.trim());
        if (TEXTUAL.has(block.type)) return !block.content.trim();
        return false;
    });
}

export function useIsLightDashboard() {
    const read = () => document.documentElement.dataset.dashboardTheme === 'light';
    const [isLight, setIsLight] = useState(read);
    useEffect(() => {
        const observer = new MutationObserver(() => setIsLight(read()));
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-dashboard-theme'] });
        return () => observer.disconnect();
    }, []);
    return isLight;
}

/** Short-lived signed URL for a stored attachment (images, video, audio). */
export function useAttachmentUrl(attachment?: AttachmentRecord) {
    const [url, setUrl] = useState('');
    const path = attachment?.storagePath;
    useEffect(() => {
        if (!path) return;
        let alive = true;
        void supabase.storage
            .from('attachments')
            .createSignedUrl(path, 3600)
            .then(({ data }) => {
                if (alive) setUrl(data?.signedUrl ?? '');
            });
        return () => {
            alive = false;
        };
    }, [path]);
    return path ? url : '';
}

/** YouTube / Vimeo / Loom page link → embeddable player URL. */
export function videoEmbedUrl(url: string): string | null {
    try {
        const u = new URL(url);
        const host = u.hostname.replace(/^(www|m)\./, '');
        if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
        if (host.endsWith('youtube.com')) {
            const v = u.searchParams.get('v');
            if (v) return `https://www.youtube-nocookie.com/embed/${v}`;
            const m = u.pathname.match(/^\/(shorts|embed|live)\/([\w-]+)/);
            if (m) return `https://www.youtube-nocookie.com/embed/${m[2]}`;
        }
        if (host === 'vimeo.com') {
            const m = u.pathname.match(/^\/(\d+)/);
            if (m) return `https://player.vimeo.com/video/${m[1]}`;
        }
        if (host === 'loom.com') {
            const m = u.pathname.match(/^\/share\/([\w-]+)/);
            if (m) return `https://www.loom.com/embed/${m[1]}`;
        }
    } catch {
        /* not a URL */
    }
    return null;
}
