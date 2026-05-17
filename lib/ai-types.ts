export interface ChatSession {
    id: string;
    user_id: string;
    title: string;
    created_at: string;
    updated_at: string;
}

export interface ChatMessage {
    id?: string;
    session_id?: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    action_data?: ActionPreviewData;
    created_at?: string;
}

export type AIAction =
    | { type: 'set_timer'; domain: string; minutes: number }
    | { type: 'block_site'; domains: string[] }
    | { type: 'unblock_site'; domains: string[] }
    | { type: 'get_blocks'; blocks: string[] };

export interface ActionPreviewData {
    action_type: 'timer' | 'block' | 'unblock' | 'blocks_list';
    data: {
        domain?: string;
        domains?: string[];
        minutes?: number;
        blocks?: string[];
        success?: boolean;
        message?: string;
    };
}

export interface UsageStats {
    request_count: number;
    tokens_used: number;
    limit: number;
}
