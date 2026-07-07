import { FunctionsHttpError } from '@supabase/supabase-js';
import { isAuthError, signOutOnAuthError } from './authErrors';
import { supabase } from './supabase';

export type StripeSessionResponse = {
    url?: string;
    error?: string;
    code?: string;
    already_subscribed?: boolean;
    manage_subscription_url?: string;
    stripeCustomerId?: string;
};

async function messageFromFunctionError(error: unknown): Promise<string | undefined> {
    if (!(error instanceof FunctionsHttpError)) return undefined;
    try {
        const payload = (await error.context.json()) as {
            error?: string;
            message?: string;
            code?: string;
        };
        if (payload?.error) return payload.error;
        if (payload?.message) return payload.message;
        if (payload?.code === 'NO_CUSTOMER') {
            return 'No Stripe billing profile yet. Subscribe to Pro first, then you can manage billing.';
        }
    } catch {
        /* ignore parse errors */
    }
    return undefined;
}

/** Invoke a Supabase Edge Function with the user's JWT (required for most functions). */
export async function invokeAuthedFunction(
    functionName: string,
    accessToken: string,
    body?: Record<string, unknown>,
) {
    const result = await supabase.functions.invoke<StripeSessionResponse>(functionName, {
        body: body ?? {},
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (result.error) {
        const detail = await messageFromFunctionError(result.error);
        const authTarget = detail || result.error.message;
        await signOutOnAuthError(authTarget);
        return {
            data: result.data,
            error: { ...result.error, message: detail || result.error.message },
        };
    }

    if (result.data?.error) {
        if (isAuthError(result.data.error)) {
            await signOutOnAuthError(result.data.error);
        }
        return result;
    }

    return result;
}
