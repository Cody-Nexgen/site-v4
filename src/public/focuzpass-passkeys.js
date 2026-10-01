/*
 * FocuzPass passkeys, page side. The extension registers this into pages (their own JavaScript
 * world, every frame) while "Use FocuzPass for passkeys" is on.
 *
 * It takes passkey requests (navigator.credentials.create/get with publicKey), hands them to the
 * FocuzNow content script in the top frame, and hands back what FocuzPass returns. Anything
 * FocuzPass can't or shouldn't handle goes to the browser's own passkeys, as if this weren't here:
 * pages the extension can't reach, iframes the page didn't allow to use passkeys, no passkey saved
 * for the site, or the person choosing another device. Sign-in suggestions in the username field
 * (conditional mediation) run both ways at once: FocuzPass's in its own suggestions, the
 * browser's in its own; whichever the person picks wins.
 *
 * Nothing here is trusted. The page can call or fake any of it; the extension decides everything
 * using origins the browser reports, and keys never reach the page.
 *
 * When FocuzNow updates, pages already open keep this script and get the new one injected too: a
 * newer copy takes over from an older one, going straight to what was there before FocuzPass.
 */
(() => {
    'use strict';
    const STATE = '__focuzPassPasskeyScript';
    const VERSION = 6;
    const previous = window[STATE];
    if ((previous && previous.version >= VERSION) || !navigator.credentials || typeof PublicKeyCredential === 'undefined') return;

    const credentials = navigator.credentials;
    const container = Object.getPrototypeOf(credentials);
    // What the page had before FocuzPass: kept by the copy that came first. (The very first copy
    // marked itself with a plain flag, and only ever wrapped the browser's own methods.)
    const natives = previous
        ? previous.natives
        : window.__focuzPassPasskeys === true
          ? { create: container.create, get: container.get }
          : { create: credentials.create, get: credentials.get };
    Object.defineProperty(window, STATE, { value: { version: VERSION, natives }, configurable: true });
    const nativeCreate = (options) => natives.create.call(credentials, options);
    const nativeGet = (options) => natives.get.call(credentials, options);
    const REQUEST = 'focuzpass-passkey:request';
    const RESPONSE = 'focuzpass-passkey:response';
    const ACK = 'focuzpass-passkey:ack';
    const CANCEL = 'focuzpass-passkey:cancel';
    const WARM = 'focuzpass-passkey:warm';
    const ERROR_NAMES = ['NotAllowedError', 'InvalidStateError', 'SecurityError', 'NotSupportedError', 'AbortError'];
    const inFrame = window.top !== window;
    // In an iframe, the FocuzNow content script that answers is the top frame's.
    const target = inFrame ? window.top : window;
    const targetOrigin = inFrame ? (location.ancestorOrigins && location.ancestorOrigins[location.ancestorOrigins.length - 1]) || '*' : location.origin;

    /** An iframe may use passkeys only if its page allowed it (allow="publickey-credentials-…"). */
    const allowedHere = (feature) => {
        if (!inFrame) return true;
        try {
            const policy = document.permissionsPolicy || document.featurePolicy;
            return policy ? policy.allowsFeature(feature) : false;
        } catch {
            return false;
        }
    };

    const toBytes = (source) => (source instanceof ArrayBuffer ? new Uint8Array(source) : new Uint8Array(source.buffer, source.byteOffset, source.byteLength));
    const b64u = (source) => {
        let binary = '';
        for (const byte of toBytes(source)) binary += String.fromCharCode(byte);
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    };
    const unb64u = (value) => {
        const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4));
        const out = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
        return out.buffer;
    };
    const descriptors = (list) => (list || []).map((d) => ({ id: b64u(d.id), type: 'public-key', transports: Array.isArray(d.transports) ? d.transports.slice(0, 8) : undefined }));

    const prfInputs = (inputs) => (inputs && inputs.first ? { first: b64u(inputs.first), second: inputs.second ? b64u(inputs.second) : undefined } : undefined);
    const extensionsJSON = (ext) => {
        if (!ext) return undefined;
        const out = {};
        if (ext.credProps) out.credProps = true;
        if (ext.prf) {
            const byCredential = {};
            for (const [id, inputs] of Object.entries(ext.prf.evalByCredential || {})) byCredential[id] = prfInputs(inputs);
            out.prf = { eval: prfInputs(ext.prf.eval), evalByCredential: Object.keys(byCredential).length ? byCredential : undefined };
        }
        return Object.keys(out).length ? out : undefined;
    };
    /** PRF results come back as base64url; the page expects ArrayBuffers. */
    const extensionResults = (json) => {
        const results = { ...(json || {}) };
        if (results.prf && results.prf.results) {
            const r = results.prf.results;
            results.prf = { ...results.prf, results: { first: unb64u(r.first), ...(r.second ? { second: unb64u(r.second) } : {}) } };
        }
        return results;
    };

    const creationJSON = (o) => ({
        rp: { id: o.rp && o.rp.id, name: o.rp && o.rp.name },
        user: { id: b64u(o.user.id), name: o.user.name, displayName: o.user.displayName },
        challenge: b64u(o.challenge),
        pubKeyCredParams: (o.pubKeyCredParams || []).map((p) => ({ type: p.type, alg: p.alg })),
        timeout: o.timeout,
        excludeCredentials: descriptors(o.excludeCredentials),
        authenticatorSelection: o.authenticatorSelection ? { ...o.authenticatorSelection } : undefined,
        attestation: o.attestation,
        extensions: extensionsJSON(o.extensions),
    });
    const requestJSON = (o) => ({
        challenge: b64u(o.challenge),
        timeout: o.timeout,
        rpId: o.rpId,
        allowCredentials: descriptors(o.allowCredentials),
        userVerification: o.userVerification,
        extensions: extensionsJSON(o.extensions),
    });

    /** A real-looking PublicKeyCredential: the browser's prototypes, with the values as own properties. */
    const credentialFrom = (json, kind) => {
        const r = json.response;
        let response;
        if (kind === 'create') {
            const authData = unb64u(r.authenticatorData);
            const publicKey = unb64u(r.publicKey);
            response = Object.create(AuthenticatorAttestationResponse.prototype, {
                clientDataJSON: { value: unb64u(r.clientDataJSON) },
                attestationObject: { value: unb64u(r.attestationObject) },
                getTransports: { value: () => r.transports.slice() },
                getAuthenticatorData: { value: () => authData },
                getPublicKey: { value: () => publicKey },
                getPublicKeyAlgorithm: { value: () => r.publicKeyAlgorithm },
            });
        } else {
            response = Object.create(AuthenticatorAssertionResponse.prototype, {
                clientDataJSON: { value: unb64u(r.clientDataJSON) },
                authenticatorData: { value: unb64u(r.authenticatorData) },
                signature: { value: unb64u(r.signature) },
                userHandle: { value: r.userHandle ? unb64u(r.userHandle) : null },
            });
        }
        const extensions = extensionResults(json.clientExtensionResults);
        return Object.create(PublicKeyCredential.prototype, {
            id: { value: json.id, enumerable: true },
            rawId: { value: unb64u(json.rawId), enumerable: true },
            type: { value: 'public-key', enumerable: true },
            response: { value: response, enumerable: true },
            authenticatorAttachment: { value: 'platform', enumerable: true },
            getClientExtensionResults: { value: () => ({ ...extensions }) },
            toJSON: { value: () => json },
        });
    };

    let sequence = 0;
    const newId = () => `fzpk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${++sequence}`;
    const cancel = (id) => target.postMessage({ type: CANCEL, id }, targetOrigin);

    /**
     * Ask FocuzPass. Resolves { fallback }, { error } or { credential }; rejects only on abort. If no
     * content script acknowledges within 1.5 s, it resolves { fallback }.
     *
     * Answers marked `live` come from a FocuzNow content script that can reach the extension. One
     * without it comes from a copy older than that mark, which may be one cut off by an update (it
     * says "use the browser" to everything), so it only counts if no live one speaks up.
     */
    const ask = (id, op, payload, signal) =>
        new Promise((resolve, reject) => {
            let live = false;
            let ackTimer = 0;
            let resendTimer = 0;
            let staleTimer = 0;
            const finish = (settle, value) => {
                window.removeEventListener('message', onMessage);
                window.clearTimeout(ackTimer);
                window.clearTimeout(staleTimer);
                window.clearInterval(resendTimer);
                if (signal) signal.removeEventListener('abort', onAbort);
                settle(value);
            };
            const onMessage = (event) => {
                if (event.source !== target || !event.data || event.data.id !== id) return;
                const fresh = event.data.live === true;
                if (event.data.type === ACK && fresh) {
                    live = true;
                    window.clearInterval(resendTimer);
                    window.clearTimeout(staleTimer);
                } else if (event.data.type === RESPONSE) {
                    if (fresh) finish(resolve, event.data);
                    else if (!live && !staleTimer) {
                        const answer = event.data;
                        staleTimer = window.setTimeout(() => finish(resolve, answer), 600);
                    }
                }
            };
            const onAbort = () => {
                cancel(id);
                finish(reject, signal.reason instanceof DOMException ? signal.reason : new DOMException('The operation was aborted.', 'AbortError'));
            };
            window.addEventListener('message', onMessage);
            if (signal) {
                if (signal.aborted) return onAbort();
                signal.addEventListener('abort', onAbort, { once: true });
            }
            // The content script loads a moment after the page starts: a request sent before it listens
            // would be lost, so it goes again until acknowledged (repeats are ignored there).
            const request = { type: REQUEST, id, op, payload };
            target.postMessage(request, targetOrigin);
            resendTimer = window.setInterval(() => target.postMessage(request, targetOrigin), 150);
            // Still no answer (a page the extension can't run on): the browser's own passkeys.
            ackTimer = window.setTimeout(() => {
                if (!live && !staleTimer) finish(resolve, { fallback: true });
            }, 1500);
        });

    const settle = (result, kind, fallback) => {
        if (!result || result.fallback) {
            // The page may have started sign-in suggestions again while FocuzPass was asking; left
            // waiting, they'd make the browser refuse this ("A request is already pending").
            // Stopping it takes the browser (and Windows) a moment; asking again straight away can get
            // the new request cancelled with it.
            const stopped = stopSuggestions();
            const started = performance.now();
            const state = `active=${navigator.userActivation ? navigator.userActivation.isActive : '?'} focus=${document.hasFocus()} ${document.visibilityState} suggestions=${stopped ? 'stopped' : 'none'}`;
            const pause = stopped ? new Promise((r) => window.setTimeout(r, 400)) : Promise.resolve();
            return pause.then(fallback).then(
                (credential) => {
                    console.info(`[FocuzPass] the browser's own passkeys answered after ${Math.round(performance.now() - started)}ms (${state})`);
                    return credential;
                },
                (error) => {
                    const options = (lastOptions && lastOptions.publicKey) || {};
                    const allowed = (options.allowCredentials || []).map((c) => (c.transports || []).join('+') || 'any').join(', ');
                    console.info(`[FocuzPass] the browser's own passkeys refused after ${Math.round(performance.now() - started)}ms (${state}; allow: ${allowed || 'none'}; uv: ${options.userVerification}; mediation: ${lastOptions && lastOptions.mediation}): ${error && error.name}: ${error && error.message}`);
                    throw error;
                },
            );
        }
        if (result.error) {
            const name = ERROR_NAMES.includes(result.error.name) ? result.error.name : 'NotAllowedError';
            throw new DOMException(String(result.error.message || 'The operation either timed out or was not allowed.'), name);
        }
        return credentialFrom(result.credential, kind);
    };

    const create = function create(options) {
        lastOptions = options;
        if (!options || !options.publicKey || !allowedHere('publickey-credentials-create')) return nativeCreate(options);
        let payload;
        try {
            payload = { options: creationJSON(options.publicKey) };
        } catch {
            return nativeCreate(options);
        }
        stopSuggestions();
        return ask(newId(), 'create', payload, options.signal).then((result) => settle(result, 'create', () => nativeCreate(options)));
    };

    /**
     * Sign-in suggestions: the browser's own request runs as usual (with a signal we can stop), and
     * FocuzPass offers its passkeys in its own suggestions. The first one the person picks wins.
     */
    /**
     * The sign-in suggestions request waiting in the background, if any. A real request replaces it,
     * as it does in the browser; left waiting, it blocks the browser's own passkeys ("A request is
     * already pending"), so "Use another device" did nothing.
     */
    let suggestions = null;
    /** True if one was waiting (and is now stopped). */
    const stopSuggestions = () => {
        if (!suggestions) return false;
        suggestions();
        return true;
    };

    const conditionalGet = (options, payload) =>
        new Promise((resolve, reject) => {
            stopSuggestions();
            const id = newId();
            let done = false;
            const ours = new AbortController();
            const stop = () => {
                if (done) return;
                done = true;
                cancel(id);
                ours.abort();
                reject(new DOMException('A new passkey request replaced this one.', 'AbortError'));
            };
            suggestions = stop;
            const settled = () => {
                if (suggestions === stop) suggestions = null;
            };
            const signal = options.signal && AbortSignal.any ? AbortSignal.any([options.signal, ours.signal]) : ours.signal;
            nativeGet({ ...options, signal }).then(
                (credential) => {
                    if (done) return;
                    done = true;
                    settled();
                    cancel(id);
                    resolve(credential);
                },
                (error) => {
                    if (done || ours.signal.aborted) return;
                    done = true;
                    settled();
                    cancel(id);
                    reject(error);
                },
            );
            ask(id, 'get', { ...payload, conditional: true }, options.signal).then(
                (result) => {
                    if (done || !result || !result.credential) return;
                    done = true;
                    settled();
                    ours.abort();
                    resolve(credentialFrom(result.credential, 'get'));
                },
                () => undefined,
            );
        });

    let lastOptions = null;
    const get = function get(options) {
        lastOptions = options;
        if (!options || !options.publicKey || options.mediation === 'immediate' || !allowedHere('publickey-credentials-get')) return nativeGet(options);
        let payload;
        try {
            payload = { options: requestJSON(options.publicKey) };
        } catch {
            return nativeGet(options);
        }
        if (options.mediation === 'conditional') return conditionalGet(options, payload);
        stopSuggestions();
        return ask(newId(), 'get', payload, options.signal).then((result) => settle(result, 'get', () => nativeGet(options)));
    };

    // Sites check for passkey support before showing a passkey button: a cue to wake FocuzNow's
    // service worker now, so it isn't still starting when the person clicks.
    if (!inFrame) {
        for (const name of ['isUserVerifyingPlatformAuthenticatorAvailable', 'isConditionalMediationAvailable', 'getClientCapabilities']) {
            const original = PublicKeyCredential[name];
            if (typeof original !== 'function') continue;
            try {
                Object.defineProperty(PublicKeyCredential, name, {
                    configurable: true,
                    writable: true,
                    value: function () {
                        window.postMessage({ type: WARM, id: 'warm' }, location.origin);
                        return original.apply(this, arguments);
                    },
                });
            } catch {
                /* locked */
            }
        }
    }

    // Replaces an older copy's methods too. If something else on the page has locked them, the page
    // keeps what it has.
    for (const [name, method] of [['create', create], ['get', get]]) {
        try {
            Object.defineProperty(credentials, name, { value: method, writable: true, configurable: true, enumerable: true });
        } catch {
            try {
                credentials[name] = method;
            } catch {
                /* locked */
            }
        }
    }
})();
