import { useEffect } from 'react';
import { MotionConfig } from 'framer-motion';
import '@fontsource-variable/inter/opsz.css';
import 'lenis/dist/lenis.css';
import './landing.css';
import { Bento } from './Bento';
import { Faq } from './Faq';
import { FinalCta } from './FinalCta';
import { loadDisplayFont } from './fonts';
import { Footer } from './Footer';
import { Hero } from './Hero';
import { Nav } from './Nav';
import { PaletteDemo } from './PaletteDemo';
import { Pricing } from './Pricing';
import { Privacy } from './Privacy';
import { startSmoothScroll } from './scroll';
import { ProductTabs } from './stage/ProductTabs';
import { Statement } from './Statement';

loadDisplayFont();

type LandingPageProps = {
    signedIn: boolean;
    onGetStarted: () => void;
    onLogin: () => void;
    onOpenDashboard: () => void;
};

export default function LandingPage({ signedIn, onGetStarted, onLogin, onOpenDashboard }: LandingPageProps) {
    const onPrimary = signedIn ? onOpenDashboard : onGetStarted;

    useEffect(() => startSmoothScroll(), []);

    useEffect(() => {
        const previous = document.title;
        document.title = 'FocuzNow · Everything else can wait';
        return () => {
            document.title = previous;
        };
    }, []);

    return (
        <MotionConfig reducedMotion="user">
            <div className="fzl">
                <a
                    href="#main"
                    className="fixed left-4 top-3 z-[80] -translate-y-20 rounded-full bg-[var(--l-text-1)] px-4 py-2 text-[14px] font-[560] text-[var(--l-on-light)] focus:translate-y-0"
                >
                    Skip to content
                </a>
                <Nav signedIn={signedIn} onPrimary={onPrimary} onLogin={onLogin} />
                <main id="main">
                    <Hero signedIn={signedIn} onPrimary={onPrimary} />
                    <ProductTabs />
                    <Statement />
                    <Bento />
                    <Privacy />
                    <Pricing signedIn={signedIn} onPrimary={onPrimary} />
                    <Faq />
                    <FinalCta signedIn={signedIn} onPrimary={onPrimary} />
                </main>
                <Footer signedIn={signedIn} onLogin={onLogin} onPrimary={onPrimary} />
                <PaletteDemo signedIn={signedIn} onPrimary={onPrimary} />
            </div>
        </MotionConfig>
    );
}
