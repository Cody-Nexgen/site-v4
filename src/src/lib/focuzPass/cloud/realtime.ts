/**
 * Realtime for FocuzPass Cloud. After a device pushes, it sends an empty "changed" message on a
 * Supabase Realtime broadcast channel, and the account's other devices pull straight away. The
 * message carries nothing; the channel name comes from the account key, which the server never
 * has, so nobody else can name the channel to listen or send. Broadcast needs no table or
 * migration. If a message is ever missed, the regular syncs still catch up.
 */

const encoder = new TextEncoder();

/** The account's channel: the same on every device that has the account key, unguessable elsewhere. */
export async function realtimeChannelName(accountKey: Uint8Array, userId: string): Promise<string> {
    const key = await crypto.subtle.importKey('raw', accountKey as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`focuzpass:realtime:v1|${userId}`)));
    return `fp-${Array.from(mac.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

type ChannelLike = {
    on(type: 'broadcast', filter: { event: string }, callback: () => void): ChannelLike;
    subscribe(callback?: (status: string) => void): ChannelLike;
    send(message: { type: 'broadcast'; event: string; payload: Record<string, never> }): Promise<unknown>;
};

/** The slice of the Supabase client realtime uses. */
export type RealtimeLike = {
    channel(name: string, options?: { config?: { broadcast?: { self?: boolean } } }): ChannelLike;
    removeChannel(channel: ChannelLike): Promise<unknown>;
};

export class CloudRealtime {
    private channel: ChannelLike | null = null;
    private name: string | null = null;
    private joined = false;

    constructor(
        private readonly client: RealtimeLike,
        private readonly onChanged: () => void,
    ) {}

    get connected() {
        return this.joined;
    }

    /** Joins the account's channel (leaving any other). */
    async connect(name: string) {
        if (this.name === name && this.channel) return;
        await this.disconnect();
        this.name = name;
        this.channel = this.client
            .channel(name, { config: { broadcast: { self: false } } })
            .on('broadcast', { event: 'changed' }, () => this.onChanged())
            .subscribe((status) => {
                this.joined = status === 'SUBSCRIBED';
                // Back after a dropped connection: something may have changed meanwhile.
                if (this.joined) this.onChanged();
            });
    }

    /** Tells the other devices something changed. */
    nudge() {
        if (!this.channel || !this.joined) return;
        void this.channel.send({ type: 'broadcast', event: 'changed', payload: {} }).catch(() => undefined);
    }

    async disconnect() {
        const channel = this.channel;
        this.channel = null;
        this.name = null;
        this.joined = false;
        if (channel) await this.client.removeChannel(channel).catch(() => undefined);
    }
}
