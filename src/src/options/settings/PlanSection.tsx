import { useEffect, useState } from 'react';
import { Check, ExternalLink, Sparkles } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import { signOutOnAuthError } from '../../lib/authErrors';
import { invokeAuthedFunction } from '../../lib/supabaseFunctions';
import { BILLING_RETURN_URL } from '../../lib/billingUrls';
import { Button } from '../../components/fz/Button';
import { SettingRow, SettingsSection } from './SettingsPrimitives';

const PRO_PERKS = ['AI Coach', 'Future Self contracts', 'Find sites by name', 'File uploads in Lists'];

export function PlanSection() {
    const { session, subscriptionTier, subscriptionDetails, syncSubscriptionFromDb } = useAuthStore();
    const [busy, setBusy] = useState<'portal' | 'checkout' | null>(null);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const isPro = subscriptionTier === 'pro';
    const accessToken = session?.access_token;

    useEffect(() => {
        void syncSubscriptionFromDb();
    }, [session?.user?.id, syncSubscriptionFromDb]);

    const fail = async (err: unknown, fallback: string) => {
        const signedOut = await signOutOnAuthError(err);
        if (!signedOut) setMessage({ ok: false, text: typeof err === 'string' && err ? err : fallback });
    };

    const openPortal = async () => {
        if (!accessToken) return void signOutOnAuthError('NOT_AUTHENTICATED');
        setBusy('portal');
        setMessage(null);
        try {
            await syncSubscriptionFromDb();
            const { data, error } = await invokeAuthedFunction('create-portal-session', accessToken, { return_url: BILLING_RETURN_URL });
            if (data?.url) {
                window.open(data.url, '_blank', 'noopener,noreferrer');
                if (data.stripeCustomerId) {
                    await chrome.storage.local.set({ subscriptionDetails: { ...(subscriptionDetails ?? {}), stripeCustomerId: data.stripeCustomerId } });
                }
            } else if (data?.code === 'NO_CUSTOMER') {
                const checkout = await invokeAuthedFunction('create-checkout-session', accessToken, { return_url: BILLING_RETURN_URL });
                if (checkout.data?.url) {
                    window.open(checkout.data.url, '_blank', 'noopener,noreferrer');
                    setMessage({ ok: true, text: 'Opening Stripe to link your billing profile…' });
                } else {
                    setMessage({ ok: false, text: data.error || "Couldn't find billing for this account. Try Upgrade to link it." });
                }
            } else {
                await fail(error?.message || data?.error, "Couldn't open the billing portal. Try again in a moment.");
            }
        } catch (e) {
            await fail(e instanceof Error ? e.message : e, "Couldn't open the billing portal. Try again in a moment.");
        }
        setBusy(null);
    };

    const openCheckout = async () => {
        if (!accessToken) return void signOutOnAuthError('NOT_AUTHENTICATED');
        setBusy('checkout');
        setMessage(null);
        try {
            const { data, error } = await invokeAuthedFunction('create-checkout-session', accessToken, { return_url: BILLING_RETURN_URL });
            if (data?.already_subscribed || data?.code === 'ALREADY_SUBSCRIBED') {
                await syncSubscriptionFromDb();
                setMessage({ ok: true, text: data.error || "You're already on Pro." });
                if (data.url) window.open(data.url, '_blank');
            } else if (data?.url) {
                window.open(data.url, '_blank');
            } else {
                await fail(error?.message || data?.error, "Couldn't start checkout. Try again in a moment.");
            }
        } catch (e) {
            await fail(e, "Couldn't start checkout. Try again in a moment.");
        }
        setBusy(null);
    };

    const periodEnd = subscriptionDetails?.currentPeriodEnd
        ? new Date(subscriptionDetails.currentPeriodEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : null;
    const status = isPro
        ? [
              subscriptionDetails?.status === 'trialing' ? 'Trial' : 'Active',
              periodEnd ? (subscriptionDetails?.cancelAtPeriodEnd ? `access until ${periodEnd}` : `renews ${periodEnd}`) : null,
          ]
              .filter(Boolean)
              .join(' · ')
        : 'Free forever — upgrade any time.';

    return (
        <SettingsSection id="plan" title="Plan & billing">
            <SettingRow
                title={isPro ? 'FocuzNow Pro' : 'FocuzNow Free'}
                description={status}
                keywords="plan subscription billing pro upgrade stripe payment invoice cancel renew"
                control={
                    isPro ? (
                        <Button size="sm" loading={busy === 'portal'} iconLeft={<ExternalLink size={13} />} onClick={() => void openPortal()}>
                            Manage billing
                        </Button>
                    ) : (
                        <Button variant="primary" size="sm" loading={busy === 'checkout'} iconLeft={<Sparkles size={13} />} onClick={() => void openCheckout()}>
                            Upgrade to Pro
                        </Button>
                    )
                }
            >
                {!isPro && (
                    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                        {PRO_PERKS.map((perk) => (
                            <li key={perk} className="flex items-center gap-1.5 text-[12px] text-[var(--fz-text-3)]">
                                <Check size={12} className="text-[var(--fz-text-4)]" />
                                {perk}
                            </li>
                        ))}
                    </ul>
                )}
                {isPro && <p className="text-meta mt-2">Invoices, payment method and cancellation are handled in Stripe's portal.</p>}
                {message && (
                    <p role="status" className={`mt-2 text-[12px] ${message.ok ? 'text-[var(--fz-success)]' : 'text-[var(--fz-danger)]'}`}>
                        {message.text}
                    </p>
                )}
            </SettingRow>
        </SettingsSection>
    );
}
