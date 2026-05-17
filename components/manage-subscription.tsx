"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { IconCreditCard, IconX, IconCheck, IconAlertCircle } from "@tabler/icons-react";

interface ManageSubscriptionProps {
    session: any;
    onBack: () => void;
}

export default function ManageSubscriptionPage({ session, onBack }: ManageSubscriptionProps) {
    const [subscription, setSubscription] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [canceling, setCanceling] = useState(false);

    useEffect(() => {
        if (!session) {
            onBack();
            return;
        }
        fetchSubscription();
    }, [session]);

    const fetchSubscription = async () => {
        try {
            const { data, error } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', session.user.id)
                .maybeSingle();

            if (error) throw error;
            setSubscription(data);
        } catch (error) {
            console.error('Error fetching subscription:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCancelSubscription = async () => {
        setCanceling(true);
        try {
            const { data, error } = await supabase.functions.invoke('cancel-subscription', {
                headers: { Authorization: `Bearer ${session.access_token}` }
            });

            if (error) throw error;

            alert('Subscription canceled. You will retain access until the end of your billing cycle.');
            await fetchSubscription();
            setShowCancelModal(false);
        } catch (error: any) {
            console.error('Error canceling subscription:', error);
            alert('Failed to cancel subscription: ' + error.message);
        } finally {
            setCanceling(false);
        }
    };

    const handleChangePaymentMethod = async () => {
        try {
            const { data, error } = await supabase.functions.invoke('create-portal-session', {
                body: { return_url: window.location.href },
                headers: { Authorization: `Bearer ${session.access_token}` }
            });

            if (error) throw error;
            if (data?.url) {
                window.location.href = data.url;
            }
        } catch (error: any) {
            console.error('Error creating portal session:', error);
            alert('Failed to open payment portal: ' + error.message);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-neutral-400">Loading subscription details...</p>
                </div>
            </div>
        );
    }

    const isPro = subscription && ['active', 'trialing'].includes(subscription.status);
    const isCanceled = subscription?.cancel_at_period_end;

    return (
        <div className="min-h-screen bg-black text-white p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-bold">Manage Subscription</h1>
                    <button onClick={onBack} className="text-neutral-400 hover:text-white p-2">
                        <IconX className="w-5 h-5" />
                    </button>
                </div>

                {/* Current Plan Card */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-3xl mb-6">
                    <div className="p-6 border-b border-neutral-800">
                        <div className="flex items-center gap-2 mb-2">
                            <IconCreditCard className="w-5 h-5" />
                            <h2 className="text-xl font-bold">Current Plan</h2>
                        </div>
                        <p className="text-neutral-400 text-sm">Manage your FocuzNow subscription</p>
                    </div>
                    <div className="p-6 space-y-6">
                        {/* Plan Status */}
                        <div className="flex items-center justify-between p-4 bg-black rounded-lg border border-neutral-800">
                            <div>
                                <p className="text-sm text-neutral-400">Plan</p>
                                <p className="text-2xl font-bold">
                                    {isPro ? (
                                        <span className="text-purple-400">Pro</span>
                                    ) : (
                                        <span className="text-neutral-300">Free</span>
                                    )}
                                </p>
                            </div>
                            {isPro && (
                                <div className="flex items-center gap-2 px-3 py-1 bg-green-900/20 border border-green-500/20 rounded-full">
                                    <IconCheck className="w-4 h-4 text-green-500" />
                                    <span className="text-sm text-green-400">Active</span>
                                </div>
                            )}
                        </div>

                        {/* Subscription Details */}
                        {isPro && subscription && (
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="p-4 bg-black rounded-lg border border-neutral-800">
                                    <p className="text-sm text-neutral-400 mb-1">Started</p>
                                    <p className="font-medium">
                                        {new Date(subscription.created_at).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </p>
                                </div>
                                <div className="p-4 bg-black rounded-lg border border-neutral-800">
                                    <p className="text-sm text-neutral-400 mb-1">
                                        {isCanceled ? 'Access Until' : 'Next Billing'}
                                    </p>
                                    <p className="font-medium">
                                        {subscription.current_period_end
                                            ? new Date(subscription.current_period_end).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            })
                                            : 'N/A'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Cancellation Notice */}
                        {isCanceled && (
                            <div className="flex items-start gap-3 p-4 bg-orange-900/20 border border-orange-500/20 rounded-lg">
                                <IconAlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium text-orange-400">Subscription Canceled</p>
                                    <p className="text-sm text-orange-300/80 mt-1">
                                        You will retain Pro access until {new Date(subscription.current_period_end).toLocaleDateString()}.
                                        After that, your account will revert to the Free plan.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-neutral-800">
                            {isPro && !isCanceled && (
                                <>
                                    <button
                                        onClick={handleChangePaymentMethod}
                                        className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-semibold transition-colors"
                                    >
                                        Change Payment Method
                                    </button>
                                    <button
                                        onClick={() => setShowCancelModal(true)}
                                        className="flex-1 px-6 py-3 border border-red-500/20 text-red-400 hover:bg-red-900/10 hover:text-red-300 rounded-xl font-semibold transition-colors"
                                    >
                                        Cancel Subscription
                                    </button>
                                </>
                            )}
                            {!isPro && (
                                <button
                                    onClick={() => window.location.href = '/'}
                                    className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-semibold transition-colors"
                                >
                                    Upgrade to Pro
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Features Comparison */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-3xl">
                    <div className="p-6 border-b border-neutral-800">
                        <h2 className="text-xl font-bold">Plan Features</h2>
                    </div>
                    <div className="p-6">
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Free Plan */}
                            <div>
                                <h3 className="font-semibold mb-3 text-neutral-300">Free Plan</h3>
                                <ul className="space-y-2">
                                    {[
                                        'Core tracking',
                                        'Daily focus score',
                                        'Top 5 site analytics',
                                        'Basic weekly reports',
                                        'Chrome extension'
                                    ].map((feature, i) => (
                                        <li key={i} className="flex items-center gap-2 text-sm text-neutral-400">
                                            <IconCheck className="w-4 h-4 text-neutral-600" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Pro Plan */}
                            <div>
                                <h3 className="font-semibold mb-3 text-purple-400">Pro Plan</h3>
                                <ul className="space-y-2">
                                    {[
                                        'Everything in Free',
                                        'Unlimited site tracking',
                                        'Custom focus goals',
                                        'Advanced analytics',
                                        'Priority support'
                                    ].map((feature, i) => (
                                        <li key={i} className="flex items-center gap-2 text-sm text-neutral-300">
                                            <IconCheck className="w-4 h-4 text-purple-500" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cancel Confirmation Modal */}
            {showCancelModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl">
                        <div className="p-6 border-b border-neutral-800">
                            <h2 className="text-xl font-bold">Cancel Subscription?</h2>
                            <p className="text-neutral-400 text-sm mt-1">
                                Are you sure you want to cancel your Pro subscription?
                            </p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="p-4 bg-orange-900/20 border border-orange-500/20 rounded-lg">
                                <p className="text-sm text-orange-300">
                                    You will retain Pro access until {subscription?.current_period_end
                                        ? new Date(subscription.current_period_end).toLocaleDateString()
                                        : 'the end of your billing cycle'}.
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowCancelModal(false)}
                                    className="flex-1 px-6 py-3 border border-neutral-700 hover:bg-neutral-800 rounded-xl font-semibold transition-colors"
                                    disabled={canceling}
                                >
                                    Keep Subscription
                                </button>
                                <button
                                    onClick={handleCancelSubscription}
                                    className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-semibold transition-colors disabled:opacity-50"
                                    disabled={canceling}
                                >
                                    {canceling ? 'Canceling...' : 'Yes, Cancel'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
