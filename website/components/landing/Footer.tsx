import { Mark } from './Mark';
import { scrollToId, scrollToY } from './scroll';

type FooterProps = { signedIn: boolean; onLogin: () => void; onPrimary: () => void };

export function Footer({ signedIn, onLogin, onPrimary }: FooterProps) {
    const columns: { title: string; links: { label: string; href?: string; onClick?: () => void }[] }[] = [
        {
            title: 'Product',
            links: [
                { label: 'How it works', onClick: () => scrollToId('product') },
                { label: 'Features', onClick: () => scrollToId('features') },
                { label: 'Pricing', onClick: () => scrollToId('pricing') },
                { label: 'FAQ', onClick: () => scrollToId('faq') },
            ],
        },
        {
            title: 'Account',
            links: signedIn
                ? [{ label: 'Open dashboard', onClick: onPrimary }]
                : [
                      { label: 'Log in', onClick: onLogin },
                      { label: 'Create an account', onClick: onPrimary },
                  ],
        },
        {
            title: 'Company',
            links: [
                { label: 'Support', href: 'mailto:support@focuznow.com' },
                { label: 'Privacy', href: '/privacy.html' },
                { label: 'Terms', href: '/terms.html' },
            ],
        },
    ];

    return (
        <footer style={{ boxShadow: 'inset 0 1px 0 var(--l-border)' }}>
            <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-16 sm:px-8 md:grid-cols-[1.4fr_repeat(3,1fr)]">
                <div>
                    <button type="button" onClick={() => scrollToY(0)} className="flex items-center gap-2.5 rounded-lg" aria-label="Back to top">
                        <Mark size={28} />
                        <span className="text-[16px] font-[620] tracking-[-0.03em]">FocuzNow</span>
                    </button>
                    <p className="mt-4 text-[14px] text-[var(--l-text-3)]">Everything else can wait.</p>
                </div>
                {columns.map((col) => (
                    <div key={col.title}>
                        <div className="text-[13px] font-[560] text-[var(--l-text-2)]">{col.title}</div>
                        <ul className="mt-4 flex flex-col gap-3">
                            {col.links.map((link) => (
                                <li key={link.label}>
                                    {link.href ? (
                                        <a href={link.href} className="fzl-link text-[14px]">
                                            {link.label}
                                        </a>
                                    ) : (
                                        <button type="button" onClick={link.onClick} className="fzl-link text-[14px]">
                                            {link.label}
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
            <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-5 pb-10 text-[13px] text-[var(--l-text-4)] sm:flex-row sm:justify-between sm:px-8">
                <span>© {new Date().getFullYear()} FocuzNow</span>
                <span>Made for people with too many tabs.</span>
            </div>
        </footer>
    );
}
