import type { SchedulingLink } from '@/lib/scheduling/types';

export function hostProfileFromLink(link: SchedulingLink) {
    return {
        displayName: link.hostDisplayName || link.hostName || 'Host',
        username: link.hostUsername,
        avatarUrl: link.hostAvatarUrl,
    };
}

type Props = {
    link: SchedulingLink;
    size?: 'md' | 'lg';
};

export default function HostProfile({ link, size = 'md' }: Props) {
    const { displayName, username, avatarUrl } = hostProfileFromLink(link);
    const avatarClass = size === 'lg' ? 'w-14 h-14 rounded-2xl text-base' : 'w-11 h-11 rounded-2xl text-sm';

    return (
        <div className="flex items-center gap-3 mb-6">
            {avatarUrl ? (
                <img
                    src={avatarUrl}
                    alt=""
                    className={`${avatarClass} object-cover shadow-lg shadow-violet-900/20 border border-white/10`}
                />
            ) : (
                <div
                    className={`${avatarClass} bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center font-black shadow-lg shadow-violet-900/30`}
                >
                    {displayName.charAt(0).toUpperCase()}
                </div>
            )}
            <div>
                <p className={`font-bold ${size === 'lg' ? 'text-xl' : ''}`}>{displayName}</p>
                {username ? (
                    <p className="text-xs text-neutral-500">@{username}</p>
                ) : (
                    <p className="text-xs text-neutral-500">Host</p>
                )}
            </div>
        </div>
    );
}
