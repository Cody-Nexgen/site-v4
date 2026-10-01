/**
 * PromptInput — morphing AI chat composer (21st.dev-style), adapted to the
 * FocuzNow token system. Features: collapsed pill → expanded card, model
 * picker, Think toggle chip, image + text attachments with gallery, real
 * dictation (getUserMedia + SpeechRecognition), streaming Stop state.
 */
import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useRef,
    useState,
    type ChangeEvent,
    type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { cn } from '@/lib/utils';
import { BeamZMark } from '../BeamZMark';
import { reducedMotion } from '../../lib/motion';
import { ChevronDown, FileText } from 'lucide-react';
import { ThinkLensIcon, ThinkRing } from '../coach/ThinkRing';

const SPRING = 'cubic-bezier(0.175, 0.885, 0.32, 1.275)';
const SPRING_TRANSITION = `max-width 0.4s ${SPRING}, height 0.4s ${SPRING}`;
const SMOOTH_HEIGHT_TRANSITION = `max-width 0.4s ${SPRING}, height 0.15s ease-out`;

const DEFAULT_MODELS = ['FocuzAI', 'FocuzAI Think'];
const THINK_MODEL = 'FocuzAI Think';

export const TEXT_ATTACHMENT_ACCEPT =
    '.txt,.md,.markdown,.csv,.json,.log,.js,.ts,.tsx,.jsx,.py,.html,.css,.xml,.yaml,.yml';
const DEFAULT_ACCEPT = `image/*,${TEXT_ATTACHMENT_ACCEPT}`;
const TEXT_FILE_MAX_BYTES = 1024 * 1024;

export function isTextAttachment(file: File): boolean {
    if (file.type.startsWith('image/')) return false;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    return (
        file.type.startsWith('text/') ||
        ['txt', 'md', 'markdown', 'csv', 'json', 'log', 'js', 'ts', 'tsx', 'jsx', 'py', 'html', 'css', 'xml', 'yaml', 'yml'].includes(ext)
    );
}

/* ---------- inline icons ---------- */

function ArrowUpIcon({ size = 14 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" />
        </svg>
    );
}

function MicIcon({ size = 14 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <rect x="5.5" y="1.5" width="5" height="8" rx="2.5" />
            <path d="M3 8a5 5 0 0 0 10 0M8 13v1.5" />
        </svg>
    );
}

function StopIcon({ size = 12 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
            <rect x="4" y="4" width="8" height="8" rx="1.5" />
        </svg>
    );
}

function PlusIcon({ size = 14 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
            <path d="M8 3.5v9M3.5 8h9" />
        </svg>
    );
}

function CloseIcon({ size = 12 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
    );
}

/* ---------- morphing label ---------- */

function MorphingText({ text }: { text: string }) {
    const measureRef = useRef<HTMLSpanElement>(null);
    const [width, setWidth] = useState<number>();
    useLayoutEffect(() => {
        const el = measureRef.current;
        if (!el) return;
        const measure = () => {
            const w = el.offsetWidth;
            setWidth(w > 0 ? w : undefined);
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        // Re-measure once webfonts finish loading (Inter swap changes widths).
        document.fonts?.ready.then(measure).catch(() => {});
        return () => ro.disconnect();
    }, [text]);
    return (
        <span
            className="relative inline-block overflow-hidden whitespace-nowrap align-middle"
            style={{
                width: width ?? 'auto',
                transition: `width 0.3s ${SPRING}`,
            }}
        >
            <span ref={measureRef} className="invisible absolute whitespace-nowrap" aria-hidden>
                {text}
            </span>
            <span
                key={text}
                className={cn('inline-block whitespace-nowrap', !reducedMotion.matches() && 'animate-in fade-in zoom-in-95 duration-300')}
            >
                {text}
            </span>
        </span>
    );
}

/* ---------- attachments ---------- */

export type AttachmentItem = {
    file: File;
    url: string;
    isText: boolean;
    textContent?: string;
};

function AttachmentThumb({
    item,
    index,
    onRemove,
    onOpen,
}: {
    item: AttachmentItem;
    index: number;
    onRemove: () => void;
    onOpen: (rect: DOMRect) => void;
}) {
    const ext = item.file.name.split('.').pop()?.toLowerCase() ?? '';
    return (
        <div
            className={cn(
                'group/att relative size-12 shrink-0 overflow-visible',
                !reducedMotion.matches() && 'animate-in fade-in slide-in-from-top-3 zoom-in-90 duration-400',
            )}
            style={{ animationDelay: `${index * 35}ms` }}
        >
            <button
                type="button"
                onClick={
                    item.isText
                        ? undefined
                        : (e) => onOpen((e.currentTarget as HTMLElement).getBoundingClientRect())
                }
                className={cn(
                    'flex size-12 items-center justify-center overflow-hidden rounded-xl border border-[var(--fz-border)] bg-[var(--fz-bg-raised)]',
                    'transition-transform hover:scale-[1.04] active:scale-[0.96]',
                    item.isText && 'cursor-default flex-col gap-0.5 px-1',
                )}
                title={item.file.name}
            >
                {item.isText ? (
                    <>
                        <FileText size={16} strokeWidth={1.5} className="text-[var(--fz-text-3)]" />
                        <span className="w-full truncate text-center text-[9px] leading-tight text-[var(--fz-text-2)]">
                            {item.file.name}
                        </span>
                        <span className="rounded-sm bg-[var(--fz-bg-hover)] px-1 text-[8px] font-medium uppercase text-[var(--fz-text-3)]">
                            {ext}
                        </span>
                    </>
                ) : (
                    <img src={item.url} alt={item.file.name} className="size-full object-cover" />
                )}
            </button>
            <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove ${item.file.name}`}
                className="absolute -right-1.5 -top-1.5 z-10 flex size-4 items-center justify-center rounded-full border border-[var(--fz-border)] bg-[var(--fz-bg-overlay)] text-[var(--fz-text-2)] opacity-0 shadow-sm transition-opacity hover:text-[var(--fz-text-1)] group-hover/att:opacity-100"
            >
                <CloseIcon size={9} />
            </button>
        </div>
    );
}

function AttachmentGalleryModal({
    item,
    thumbRect,
    onClose,
}: {
    item: AttachmentItem;
    thumbRect: DOMRect;
    onClose: () => void;
}) {
    const boxRef = useRef<HTMLDivElement>(null);
    const [closing, setClosing] = useState(false);

    const target = useCallback(() => {
        const img = boxRef.current?.querySelector('img');
        const iw = img?.naturalWidth || 800;
        const ih = img?.naturalHeight || 600;
        const maxW = Math.min(window.innerWidth * 0.86, 560);
        const maxH = Math.min(window.innerHeight * 0.78, 720);
        const scale = Math.min(maxW / iw, maxH / ih, 1);
        const w = iw * scale;
        const h = ih * scale;
        return {
            left: (window.innerWidth - w) / 2,
            top: (window.innerHeight - h) / 2,
            width: w,
            height: h,
        };
    }, []);

    useEffect(() => {
        const box = boxRef.current;
        if (!box) return;
        const from = { left: thumbRect.left, top: thumbRect.top, width: thumbRect.width, height: thumbRect.height };
        Object.assign(box.style, {
            left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, borderRadius: '12px',
        });
        const raf = requestAnimationFrame(() => {
            const to = target();
            box.style.transition = reducedMotion.matches()
                ? 'opacity 0.08s linear'
                : `left 0.45s ${SPRING}, top 0.45s ${SPRING}, width 0.45s ${SPRING}, height 0.45s ${SPRING}, border-radius 0.45s ${SPRING}`;
            Object.assign(box.style, {
                left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px`, borderRadius: '20px',
            });
        });
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setClosing(true);
        };
        window.addEventListener('keydown', onKey);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('keydown', onKey);
        };
    }, [thumbRect, target]);

    useEffect(() => {
        if (!closing) return;
        const box = boxRef.current;
        if (!box) {
            onClose();
            return;
        }
        box.style.transition = reducedMotion.matches()
            ? 'opacity 0.08s linear'
            : 'left 0.3s ease-out, top 0.3s ease-out, width 0.3s ease-out, height 0.3s ease-out, border-radius 0.3s ease-out';
        Object.assign(box.style, {
            left: `${thumbRect.left}px`, top: `${thumbRect.top}px`, width: `${thumbRect.width}px`, height: `${thumbRect.height}px`, borderRadius: '12px',
        });
        const done = () => onClose();
        box.addEventListener('transitionend', done, { once: true });
        const fallback = window.setTimeout(done, 350);
        return () => window.clearTimeout(fallback);
    }, [closing, thumbRect, onClose]);

    return (
        <div className="fixed inset-0 z-[100]">
            <div
                className={cn('absolute inset-0 bg-[var(--fz-bg-app)]/70 backdrop-blur-md', closing && 'opacity-0')}
                style={{ transition: 'opacity 0.3s ease-out' }}
                onClick={() => setClosing(true)}
            />
            <div ref={boxRef} className="fixed overflow-hidden bg-[var(--fz-bg-raised)]">
                <img src={item.url} alt={item.file.name} className="size-full object-contain" />
                <button
                    type="button"
                    onClick={() => setClosing(true)}
                    aria-label="Close"
                    className={cn(
                        'absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition-transform',
                        !reducedMotion.matches() && 'animate-in zoom-in-50 duration-300',
                    )}
                >
                    <CloseIcon size={14} />
                </button>
            </div>
        </div>
    );
}

/* ---------- speech recognition (minimal typing) ---------- */

type SpeechRecognitionLike = {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
    onerror: ((e: { error?: string }) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
    abort: () => void;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
    const w = window as unknown as Record<string, unknown>;
    return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
        | (new () => SpeechRecognitionLike)
        | null;
}

/* ---------- PromptInput ---------- */

export type PromptInputSubmitMeta = { model: string; attachments: AttachmentItem[] };

export type PromptInputProps = {
    value?: string;
    onChange?: (v: string) => void;
    onSubmit?: (value: string, meta: PromptInputSubmitMeta) => void;
    placeholder?: string;
    isStreaming?: boolean;
    onStop?: () => void;
    disabled?: boolean;
    collapsedWidth?: number;
    expandedWidth?: number;
    startExpanded?: boolean;
    /** When false the composer never collapses back to the pill. */
    collapsible?: boolean;
    models?: string[];
    model?: string;
    onModelChange?: (m: string) => void;
    accept?: string;
    onError?: (msg: string) => void;
    className?: string;
};

export const PromptInput = forwardRef<HTMLDivElement, PromptInputProps>(function PromptInput(
    {
        value,
        onChange,
        onSubmit,
        placeholder = 'Ask anything',
        isStreaming = false,
        onStop,
        disabled = false,
        collapsedWidth = 320,
        expandedWidth = 480,
        startExpanded = false,
        collapsible = true,
        models = DEFAULT_MODELS,
        model,
        onModelChange,
        accept = DEFAULT_ACCEPT,
        onError,
        className,
    },
    ref,
) {
    const [expanded, setExpanded] = useState(startExpanded);
    const [isSmoothResize, setIsSmoothResize] = useState(false);
    const [localValue, setLocalValue] = useState(value ?? '');
    const controlled = value !== undefined;
    const inputValue = controlled ? value! : localValue;
    const setInputValue = useCallback(
        (v: string) => {
            if (!controlled) setLocalValue(v);
            onChange?.(v);
        },
        [controlled, onChange],
    );

    const [internalModel, setInternalModel] = useState(models[0]);
    const selectedModel = model ?? internalModel;
    const setSelectedModel = (m: string) => {
        if (model === undefined) setInternalModel(m);
        onModelChange?.(m);
    };
    const isThinking = selectedModel === THINK_MODEL;

    const [isModelSelectOpen, setIsModelSelectOpen] = useState(false);
    const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
    const [activeAttachment, setActiveAttachment] = useState<{ item: AttachmentItem; rect: DOMRect } | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [audioData, setAudioData] = useState<number[]>([0, 0, 0, 0, 0]);
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);
    const [containerHeight, setContainerHeight] = useState(116);
    const [scrollFade, setScrollFade] = useState({ top: 0, bottom: 0 });

    const rootRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => rootRef.current as HTMLDivElement);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const modelButtonRef = useRef<HTMLButtonElement>(null);
    const modelMenuRef = useRef<HTMLDivElement>(null);
    const baselineRef = useRef('');
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const rafRef = useRef(0);
    const attachmentsRef = useRef(attachments);
    attachmentsRef.current = attachments;

    const hasContent = inputValue.trim().length > 0 || attachments.length > 0;

    // Auto-expand when there's content; collapse on blur when empty.
    useEffect(() => {
        if (hasContent) setExpanded(true);
    }, [hasContent]);

    // Close the model menu on outside press / Esc. (A fixed backdrop breaks under
    // transformed ancestors such as framer-motion layout wrappers.)
    useEffect(() => {
        if (!isModelSelectOpen) return;
        const onDown = (e: MouseEvent) => {
            const t = e.target as Node;
            if (modelMenuRef.current?.contains(t) || modelButtonRef.current?.contains(t)) return;
            setIsModelSelectOpen(false);
        };
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsModelSelectOpen(false);
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [isModelSelectOpen]);

    const transition = isSmoothResize ? SMOOTH_HEIGHT_TRANSITION : SPRING_TRANSITION;

    const updateHeight = useCallback(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = 'auto';
        const next = Math.min(Math.max(ta.scrollHeight, 68), 160);
        ta.style.height = `${next}px`;
        ta.style.overflowY = ta.scrollHeight > 160 ? 'auto' : 'hidden';
        setContainerHeight(next + 48);
    }, []);

    useEffect(() => {
        if (expanded) updateHeight();
    }, [expanded, inputValue, updateHeight]);

    const onTextareaScroll = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        const max = ta.scrollHeight - ta.clientHeight;
        setScrollFade({
            top: Math.min(ta.scrollTop / 24, 1),
            bottom: Math.min(Math.max((max - ta.scrollTop) / 24, 0), 1),
        });
    };

    const expand = () => {
        setIsSmoothResize(false);
        setExpanded(true);
        requestAnimationFrame(() => {
            const ta = textareaRef.current;
            if (ta) {
                ta.focus();
                ta.selectionStart = ta.selectionEnd = ta.value.length;
            }
        });
    };

    const collapseIfEmpty = () => {
        if (collapsible && !hasContent && !isRecording && !isModelSelectOpen) {
            setIsSmoothResize(true);
            setExpanded(false);
        }
    };

    const submit = () => {
        const text = inputValue.trim();
        if ((!text && !attachments.length) || disabled) return;
        onSubmit?.(text, { model: selectedModel, attachments });
        if (!controlled) setLocalValue('');
        setAttachments([]);
    };

    const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isStreaming) submit();
        } else if (e.key === 'Escape' && !inputValue) {
            collapseIfEmpty();
        }
    };

    /* ----- attachments ----- */

    const addFiles = (files: FileList | File[]) => {
        for (const file of Array.from(files)) {
            if (isTextAttachment(file)) {
                if (file.size > TEXT_FILE_MAX_BYTES) {
                    onError?.(`${file.name} is too large`);
                    continue;
                }
                const item: AttachmentItem = { file, url: '', isText: true };
                file.text().then((t) => {
                    item.textContent = t.slice(0, 20_000);
                }).catch(() => {});
                setAttachments((prev) => [...prev, item]);
            } else if (file.type.startsWith('image/')) {
                const url = URL.createObjectURL(file);
                setAttachments((prev) => [...prev, { file, url, isText: false }]);
            }
        }
    };

    const removeAttachment = (idx: number) => {
        setAttachments((prev) => {
            const item = prev[idx];
            if (item?.url) URL.revokeObjectURL(item.url);
            return prev.filter((_, i) => i !== idx);
        });
    };

    // Unmount-only cleanup (attachments read via ref so thumbs don't break on change).
    useEffect(() => {
        return () => {
            attachmentsRef.current.forEach((a) => a.url && URL.revokeObjectURL(a.url));
            recognitionRef.current?.abort();
            cancelAnimationFrame(rafRef.current);
            streamRef.current?.getTracks().forEach((t) => t.stop());
            void audioCtxRef.current?.close().catch(() => {});
        };
    }, []);

    /* ----- dictation ----- */

    const stopRecording = useCallback(() => {
        recognitionRef.current?.stop();
        recognitionRef.current = null;
        cancelAnimationFrame(rafRef.current);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        void audioCtxRef.current?.close().catch(() => {});
        audioCtxRef.current = null;
        setIsRecording(false);
        setAudioData([0, 0, 0, 0, 0]);
    }, []);

    const startRecording = useCallback(async () => {
        const Ctor = getSpeechRecognitionCtor();
        if (!Ctor) {
            onError?.("Dictation isn't supported in this browser");
            return;
        }
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
            onError?.('Microphone access was blocked');
            return;
        }
        streamRef.current = stream;

        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        const bands = [0, 0, 0, 0, 0];
        const tick = () => {
            analyser.getByteFrequencyData(buf);
            const per = Math.floor(buf.length / 5);
            for (let b = 0; b < 5; b++) {
                let sum = 0;
                for (let i = b * per; i < (b + 1) * per; i++) sum += buf[i];
                bands[b] = sum / per / 255;
            }
            setAudioData([...bands]);
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);

        baselineRef.current = inputValue;
        const rec = new Ctor();
        recognitionRef.current = rec;
        rec.lang = navigator.language;
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = (e) => {
            let finals = '';
            let interim = '';
            for (let i = 0; i < e.results.length; i++) {
                const r = e.results[i];
                if (r.isFinal) finals += r[0].transcript;
                else interim += r[0].transcript;
            }
            const base = baselineRef.current;
            const sep = base && !base.endsWith(' ') ? ' ' : '';
            setInputValue(base + sep + finals + interim);
            const ta = textareaRef.current;
            if (ta) ta.scrollTop = ta.scrollHeight;
        };
        rec.onerror = (e) => {
            if (e.error === 'no-speech' || e.error === 'aborted') {
                stopRecording();
                return;
            }
            stopRecording();
            onError?.(`Dictation failed${e.error ? `: ${e.error}` : ''}`);
        };
        rec.onend = () => {
            if (recognitionRef.current === rec) stopRecording();
        };
        rec.start();
        setIsRecording(true);
    }, [inputValue, onError, setInputValue, stopRecording]);

    /* ----- render ----- */

    const action = isStreaming ? 'stop' : isRecording ? 'stop' : hasContent ? 'send' : 'mic';

    return (
        <div
            ref={rootRef}
            className={cn('relative flex flex-col', className)}
            style={{
                maxWidth: expanded ? expandedWidth : collapsedWidth,
                height: expanded ? containerHeight + (attachments.length ? 68 : 0) : 48,
                transition: reducedMotion.matches() ? 'none' : transition,
            }}
        >
            <style>{`
                .fz-pi-visualizer { display: flex; align-items: center; gap: 3px; height: 24px; }
                .fz-pi-visualizer span { width: 4px; border-radius: 2px; background: var(--fz-accent); transition: height 80ms linear; }
                .fz-pi-textarea::placeholder { color: var(--fz-border-strong); }
                .fz-pi-textarea { scrollbar-width: thin; scrollbar-color: var(--fz-border) transparent; }
            `}</style>

            {/* Attachment strip — slides up above the card */}
            {expanded && attachments.length > 0 && (
                <div
                    className={cn(
                        'flex h-[68px] items-center gap-2 overflow-x-auto rounded-t-2xl border border-b-0 border-[var(--fz-border)] bg-[var(--fz-bg-raised)] px-3',
                        !reducedMotion.matches() && 'animate-in fade-in slide-in-from-bottom-4 duration-300',
                    )}
                >
                    {attachments.map((item, i) => (
                        <AttachmentThumb
                            key={`${item.file.name}-${i}`}
                            item={item}
                            index={i}
                            onRemove={() => removeAttachment(i)}
                            onOpen={(rect) => setActiveAttachment({ item, rect })}
                        />
                    ))}
                </div>
            )}

            {/* Card */}
            <div
                className={cn(
                    'relative flex min-h-0 w-full flex-1 flex-col border bg-[var(--fz-bg-raised)]',
                    expanded
                        ? attachments.length
                            ? 'rounded-b-2xl rounded-t-none'
                            : 'rounded-2xl'
                        : 'rounded-full',
                    'border-[var(--fz-border)] focus-within:border-[var(--fz-border-strong)]',
                )}
                style={{ boxShadow: 'var(--fz-elev-card)' }}
                onMouseDown={(e) => {
                    // Keep textarea focus when pressing buttons inside the card (prevents blur-collapse).
                    const t = e.target as HTMLElement;
                    if (expanded && t !== textareaRef.current && t.closest('button')) e.preventDefault();
                }}
            >
                {!expanded ? (
                    <button
                        type="button"
                        onClick={expand}
                        disabled={disabled}
                        className="flex h-full w-full items-center px-4 text-left text-[15px] text-[var(--fz-text-4)]"
                    >
                        {placeholder}
                    </button>
                ) : (
                    <>
                        <ThinkRing active={isThinking} working={isThinking && isStreaming} squareTop={attachments.length > 0} />
                        <div className="relative min-h-0 flex-1 overflow-hidden rounded-t-[inherit]">
                            {scrollFade.top > 0 && (
                                <div
                                    className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6"
                                    style={{ background: 'linear-gradient(180deg, var(--fz-bg-raised), transparent)', opacity: scrollFade.top }}
                                />
                            )}
                            <textarea
                                ref={textareaRef}
                                value={inputValue}
                                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setInputValue(e.target.value)}
                                onKeyDown={onKeyDown}
                                onBlur={(e) => {
                                    // Clicking the composer's own controls must not collapse it.
                                    if (rootRef.current?.contains(e.relatedTarget as Node | null)) return;
                                    collapseIfEmpty();
                                }}
                                onScroll={onTextareaScroll}
                                placeholder={isRecording ? 'Listening…' : placeholder}
                                disabled={disabled}
                                className="fz-pi-textarea h-full w-full resize-none bg-transparent px-4 pt-3.5 text-[15px] leading-relaxed text-[var(--fz-text-1)] outline-none"
                            />
                            {scrollFade.bottom > 0 && (
                                <div
                                    className="pointer-events-none absolute inset-x-0 bottom-0 h-6"
                                    style={{ background: 'linear-gradient(0deg, var(--fz-bg-raised), transparent)', opacity: scrollFade.bottom }}
                                />
                            )}
                        </div>

                        {/* Bottom action row */}
                        <div
                            className={cn(
                                'flex h-12 items-center gap-1 px-2 transition-opacity',
                                isRecording && 'pointer-events-none opacity-40 blur-[1px]',
                            )}
                        >
                            {/* Model picker */}
                            <div className="relative">
                                <button
                                    ref={modelButtonRef}
                                    type="button"
                                    onClick={() => setIsModelSelectOpen((v) => !v)}
                                    className="flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[13px] text-[var(--fz-text-3)] transition-colors hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]"
                                >
                                    <ModelIcon name={selectedModel} />
                                    <MorphingText text={selectedModel} />
                                    <ChevronDown size={12} strokeWidth={1.75} />
                                </button>
                                {isModelSelectOpen && (
                                    <>
                                        <div
                                            ref={modelMenuRef}
                                            className={cn(
                                                'absolute bottom-full left-0 z-50 mb-2 w-44 overflow-hidden rounded-2xl border border-[var(--fz-border)] bg-[var(--fz-bg-overlay)] p-1 backdrop-blur',
                                                !reducedMotion.matches() && 'animate-in fade-in slide-in-from-bottom-2 zoom-in-95 duration-200',
                                            )}
                                            style={{ boxShadow: 'var(--fz-elev-card)' }}
                                        >
                                            <div
                                                className="pointer-events-none absolute left-1 top-1 h-[34px] w-[calc(100%-8px)] rounded-xl bg-[var(--fz-bg-hover)] transition-transform duration-150"
                                                style={{
                                                    transform: `translateY(${(hoverIdx ?? models.indexOf(selectedModel)) * 34}px)`,
                                                    opacity: hoverIdx === null && !models.includes(selectedModel) ? 0 : 1,
                                                }}
                                            />
                                            {models.map((m, i) => (
                                                <button
                                                    key={m}
                                                    type="button"
                                                    onMouseEnter={() => setHoverIdx(i)}
                                                    onMouseLeave={() => setHoverIdx(null)}
                                                    onClick={() => {
                                                        setSelectedModel(m);
                                                        setIsModelSelectOpen(false);
                                                    }}
                                                    className="relative z-10 flex h-[34px] w-full items-center gap-2 rounded-xl px-2.5 text-left text-[13px] text-[var(--fz-text-2)] hover:text-[var(--fz-text-1)]"
                                                >
                                                    <ModelIcon name={m} />
                                                    {m}
                                                    {m === selectedModel && (
                                                        <span className="ml-auto text-[var(--fz-text-3)]">✓</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Think chip */}
                            <button
                                type="button"
                                aria-pressed={isThinking}
                                onClick={() => setSelectedModel(isThinking ? models[0] : THINK_MODEL)}
                                className={cn(
                                    'flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[13px] transition-colors',
                                    isThinking
                                        ? 'bg-[var(--fz-bg-active)] text-[var(--fz-text-1)] shadow-[var(--fz-edge)]'
                                        : 'text-[var(--fz-text-3)] hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]',
                                )}
                            >
                                <ThinkLensIcon open={isThinking} />
                                Think
                            </button>

                            {/* Attach */}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="ml-auto flex size-7 items-center justify-center rounded-full text-[var(--fz-text-3)] transition-colors hover:bg-[var(--fz-bg-hover)] hover:text-[var(--fz-text-1)]"
                                aria-label="Attach files"
                            >
                                <PlusIcon size={14} />
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept={accept}
                                className="hidden"
                                onChange={(e) => {
                                    if (e.target.files) addFiles(e.target.files);
                                    e.target.value = '';
                                }}
                            />
                        </div>
                    </>
                )}

                {/* Visualizer (left of action button while recording) */}
                {isRecording && expanded && (
                    <div className={cn('absolute bottom-3 right-12 z-10', !reducedMotion.matches() && 'animate-in fade-in slide-in-from-right-2 duration-200')}>
                        <div className="fz-pi-visualizer">
                            {audioData.map((v, i) => (
                                <span key={i} style={{ height: `${Math.max(4, v * 24)}px` }} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Action button */}
                {expanded && (
                    <button
                        type="button"
                        onClick={() => {
                            if (action === 'stop') {
                                if (isStreaming) onStop?.();
                                else stopRecording();
                            } else if (action === 'send') {
                                submit();
                            } else {
                                void startRecording();
                            }
                        }}
                        disabled={disabled}
                        aria-label={action === 'stop' ? 'Stop' : action === 'send' ? 'Send' : 'Dictate'}
                        className={cn(
                            'absolute bottom-2 right-2 z-10 flex size-8 items-center justify-center rounded-full transition-transform',
                            'bg-[var(--fz-accent)] text-[var(--fz-accent-fg)] hover:scale-105 active:scale-95 disabled:opacity-50',
                        )}
                        style={{ boxShadow: 'var(--fz-btn-edge)' }}
                    >
                        <span
                            key={action}
                            className={cn('flex items-center justify-center', !reducedMotion.matches() && 'animate-in fade-in zoom-in-75 duration-200')}
                        >
                            {action === 'stop' ? <StopIcon /> : action === 'send' ? <ArrowUpIcon /> : <MicIcon />}
                        </span>
                    </button>
                )}
            </div>

            {activeAttachment && (
                <AttachmentGalleryModal
                    item={activeAttachment.item}
                    thumbRect={activeAttachment.rect}
                    onClose={() => setActiveAttachment(null)}
                />
            )}
        </div>
    );
});

function ModelIcon({ name }: { name: string }) {
    if (name === THINK_MODEL) {
        return (
            <span className="relative flex size-4 shrink-0 items-center justify-center">
                <BeamZMark size={14} title="" />
                <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-[var(--fz-bg-overlay)] text-[var(--fz-text-1)]">
                    <ThinkLensIcon open size={8} />
                </span>
            </span>
        );
    }
    return (
        <span className="flex size-4 shrink-0 items-center justify-center">
            <BeamZMark size={14} title="" />
        </span>
    );
}
