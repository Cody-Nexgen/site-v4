import {
    Apple, Award, Baby, Banknote, Bike, BookOpen, Bookmark, Bot, Box, Briefcase, Brush, Bug, Building, Building2, Cake,
    Calendar, Camera, Car, Cat, ChartLine, Cloud, Code, Coffee, Coins, Compass, Cpu, CreditCard, Crown, Database, Dog,
    Dumbbell, Earth, Feather, FileText, Film, Flag, Flame, FlaskConical, Folder, Gamepad2, Gem, Gift, GitBranch,
    Globe, GraduationCap, Hammer, HandHeart, HardDrive, Headphones, Heart, HeartPulse, Home, Hospital, House, IdCard,
    Joystick, Key, KeyRound, Landmark, Laptop, Layers, Leaf, Library, Lightbulb, Lock, Mail, Map, MapPin, Megaphone,
    MessageCircle, Mic, Monitor, Moon, Mountain, Music, Newspaper, Notebook, Package, Palette, PawPrint, PenTool,
    Phone, PiggyBank, Pill, Pizza, Plane, Plug, Puzzle, Receipt, Rocket, Router, Sailboat, School, Server, Shield,
    ShieldCheck, ShoppingBag, ShoppingCart, Smartphone, Smile, Sparkles, Sprout, Star, Stethoscope, Store, Sun,
    Tablet, Target, Terminal, Ticket, TrainFront, Trees, Trophy, Truck, Tv, Umbrella, University, User, Users,
    Utensils, Video, Wallet, Wifi, Wine, Wrench, Zap,
    type LucideIcon,
} from 'lucide-react';

export type CollectionIcon = { id: string; icon: LucideIcon; keywords: string };
export type CollectionIconGroup = { label: string; icons: CollectionIcon[] };

const i = (id: string, icon: LucideIcon, keywords = ''): CollectionIcon => ({ id, icon, keywords: `${id} ${keywords}` });

/**
 * Icons for vaults and tags. Each is imported by name so only these end up in the build, not all of
 * lucide. Ids are what gets saved with a vault or tag; never rename one that has shipped.
 */
export const COLLECTION_ICON_GROUPS: CollectionIconGroup[] = [
    {
        label: 'General',
        icons: [
            i('folder', Folder, 'files'), i('star', Star, 'favorite'), i('heart', Heart, 'love'), i('bookmark', Bookmark),
            i('flag', Flag), i('layers', Layers, 'stack'), i('box', Box), i('package', Package), i('sparkles', Sparkles, 'magic'),
            i('zap', Zap, 'bolt fast'), i('flame', Flame, 'fire hot'), i('target', Target, 'goal'), i('crown', Crown, 'vip'),
            i('gem', Gem, 'diamond'), i('award', Award), i('trophy', Trophy, 'win'), i('lightbulb', Lightbulb, 'idea'),
            i('puzzle', Puzzle), i('smile', Smile, 'happy'), i('feather', Feather),
        ],
    },
    {
        label: 'Security',
        icons: [
            i('shield', Shield), i('shield-check', ShieldCheck, 'safe'), i('lock', Lock), i('key', Key),
            i('key-round', KeyRound, 'password'), i('id-card', IdCard, 'identity'),
        ],
    },
    {
        label: 'Work & school',
        icons: [
            i('briefcase', Briefcase, 'job'), i('building', Building, 'office company'), i('building-2', Building2, 'office'),
            i('calendar', Calendar), i('mail', Mail, 'email'), i('file-text', FileText, 'document'), i('notebook', Notebook),
            i('chart', ChartLine, 'stats analytics'), i('megaphone', Megaphone, 'marketing'), i('message', MessageCircle, 'chat'),
            i('users', Users, 'team'), i('user', User, 'person'), i('graduation-cap', GraduationCap, 'school college'),
            i('school', School), i('university', University, 'college'), i('book-open', BookOpen, 'read study'),
            i('library', Library), i('pen-tool', PenTool, 'design'),
        ],
    },
    {
        label: 'Money',
        icons: [
            i('wallet', Wallet), i('credit-card', CreditCard, 'card'), i('banknote', Banknote, 'cash'), i('coins', Coins),
            i('piggy-bank', PiggyBank, 'savings'), i('landmark', Landmark, 'bank'), i('receipt', Receipt, 'bills'),
            i('shopping-cart', ShoppingCart, 'shop'), i('shopping-bag', ShoppingBag, 'shop'), i('store', Store, 'shop'),
            i('gift', Gift),
        ],
    },
    {
        label: 'Tech',
        icons: [
            i('laptop', Laptop, 'computer'), i('monitor', Monitor, 'computer desktop'), i('smartphone', Smartphone, 'phone mobile'),
            i('tablet', Tablet), i('code', Code, 'dev'), i('terminal', Terminal, 'dev'), i('git-branch', GitBranch, 'dev'),
            i('server', Server), i('database', Database), i('cloud', Cloud), i('cpu', Cpu, 'chip'), i('hard-drive', HardDrive),
            i('wifi', Wifi, 'internet'), i('router', Router, 'network'), i('plug', Plug), i('bot', Bot, 'ai robot'),
            i('bug', Bug), i('globe', Globe, 'web internet'),
        ],
    },
    {
        label: 'Home & life',
        icons: [
            i('home', Home, 'house'), i('house', House), i('baby', Baby, 'kids family'), i('dog', Dog, 'pet'), i('cat', Cat, 'pet'),
            i('paw', PawPrint, 'pet'), i('utensils', Utensils, 'food'), i('coffee', Coffee), i('pizza', Pizza, 'food'),
            i('apple', Apple, 'food'), i('wine', Wine, 'drink'), i('cake', Cake, 'birthday'), i('wrench', Wrench, 'tools'),
            i('hammer', Hammer, 'tools'), i('brush', Brush, 'paint'), i('palette', Palette, 'art'), i('hand-heart', HandHeart, 'charity'),
            i('phone', Phone, 'call'),
        ],
    },
    {
        label: 'Health',
        icons: [
            i('heart-pulse', HeartPulse, 'health'), i('stethoscope', Stethoscope, 'doctor'), i('hospital', Hospital),
            i('pill', Pill, 'medicine'), i('dumbbell', Dumbbell, 'gym fitness'), i('bike', Bike, 'cycling'),
        ],
    },
    {
        label: 'Travel & outdoors',
        icons: [
            i('plane', Plane, 'flight'), i('car', Car), i('train', TrainFront), i('truck', Truck, 'delivery'), i('sailboat', Sailboat, 'boat'),
            i('map', Map), i('map-pin', MapPin, 'location'), i('compass', Compass), i('earth', Earth, 'world'), i('mountain', Mountain),
            i('trees', Trees, 'forest'), i('leaf', Leaf, 'nature'), i('sprout', Sprout, 'plant'), i('sun', Sun), i('moon', Moon, 'night'),
            i('umbrella', Umbrella, 'weather'), i('ticket', Ticket),
        ],
    },
    {
        label: 'Fun',
        icons: [
            i('gamepad', Gamepad2, 'games'), i('joystick', Joystick, 'games'), i('music', Music), i('headphones', Headphones, 'audio'),
            i('mic', Mic, 'podcast'), i('film', Film, 'movie'), i('tv', Tv, 'streaming'), i('video', Video), i('camera', Camera, 'photo'),
            i('newspaper', Newspaper, 'news'), i('rocket', Rocket, 'launch'), i('flask', FlaskConical, 'science lab'),
        ],
    },
];

const BY_ID: Record<string, LucideIcon> = Object.fromEntries(COLLECTION_ICON_GROUPS.flatMap((group) => group.icons.map((entry) => [entry.id, entry.icon])));

export function collectionIcon(id: string): LucideIcon | undefined {
    return BY_ID[id];
}

/** Icons whose name or keywords contain every word of the query. */
export function searchCollectionIcons(query: string): CollectionIcon[] {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const all = COLLECTION_ICON_GROUPS.flatMap((group) => group.icons);
    return words.length ? all.filter((entry) => words.every((word) => entry.keywords.includes(word))) : all;
}
