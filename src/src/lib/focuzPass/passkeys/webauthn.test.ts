import assert from 'node:assert/strict';
import test from 'node:test';
import {
    ES256,
    FOCUZPASS_AAGUID,
    PasskeyError,
    cborEncode,
    checkRpId,
    derToRaw,
    fromBase64Url,
    getAssertion,
    makeCredential,
    rawToDer,
    toBase64Url,
    type CreationOptionsJSON,
    type RequestOptionsJSON,
} from './webauthn';

/* A relying party's view, written separately from the code under test. */

type Decoded = number | string | Uint8Array | Decoded[] | Map<unknown, Decoded>;

function cborDecode(bytes: Uint8Array): Decoded {
    let at = 0;
    const length = (info: number): number => {
        if (info < 24) return info;
        if (info === 24) return bytes[at++]!;
        if (info === 25) return (bytes[at++]! << 8) | bytes[at++]!;
        if (info === 26) return ((bytes[at++]! << 24) >>> 0) + (bytes[at++]! << 16) + (bytes[at++]! << 8) + bytes[at++]!;
        throw new Error('unsupported length');
    };
    const read = (): Decoded => {
        const head = bytes[at++]!;
        const major = head >> 5;
        const n = length(head & 31);
        if (major === 0) return n;
        if (major === 1) return -1 - n;
        if (major === 2) return bytes.slice(at, (at += n));
        if (major === 3) return new TextDecoder().decode(bytes.slice(at, (at += n)));
        if (major === 4) return Array.from({ length: n }, read);
        if (major === 5) {
            const map = new Map<unknown, Decoded>();
            for (let i = 0; i < n; i++) map.set(read(), read());
            return map;
        }
        throw new Error('unsupported major type');
    };
    const value = read();
    assert.equal(at, bytes.length, 'no trailing bytes');
    return value;
}

async function sha256(bytes: Uint8Array) {
    return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource));
}

function parseAuthData(authData: Uint8Array) {
    const flags = authData[32]!;
    const out = {
        rpIdHash: authData.slice(0, 32),
        up: !!(flags & 0x01),
        uv: !!(flags & 0x04),
        be: !!(flags & 0x08),
        bs: !!(flags & 0x10),
        at: !!(flags & 0x40),
        signCount: new DataView(authData.buffer, authData.byteOffset + 33, 4).getUint32(0),
        aaguid: '',
        credentialId: new Uint8Array(),
        cose: null as Map<unknown, Decoded> | null,
    };
    if (out.at) {
        const hex = Array.from(authData.slice(37, 53), (b) => b.toString(16).padStart(2, '0')).join('');
        out.aaguid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
        const idLength = (authData[53]! << 8) | authData[54]!;
        out.credentialId = authData.slice(55, 55 + idLength);
        out.cose = cborDecode(authData.slice(55 + idLength)) as Map<unknown, Decoded>;
    }
    return out;
}

const ORIGIN = 'https://login.example.com';
const challenge = () => toBase64Url(crypto.getRandomValues(new Uint8Array(32)));

function creation(overrides: Partial<CreationOptionsJSON> = {}): CreationOptionsJSON {
    return {
        rp: { id: 'example.com', name: 'Example' },
        user: { id: toBase64Url(new TextEncoder().encode('user-42')), name: 'sam@example.com', displayName: 'Sam Lee' },
        challenge: challenge(),
        pubKeyCredParams: [{ type: 'public-key', alg: -8 }, { type: 'public-key', alg: ES256 }],
        authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
        attestation: 'direct',
        extensions: { credProps: true },
        ...overrides,
    };
}

test('CBOR: canonical encodings match the spec\'s examples', () => {
    const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    assert.equal(hex(cborEncode(new Map([[3, -7], [1, 2]]))), 'a201020326', 'keys sorted, negative ints');
    assert.equal(hex(cborEncode(new Map([['authData', 1], ['fmt', 2], ['attStmt', 3]]))), 'a363666d74026761747453746d7403686175746844617461' + '01');
    assert.equal(hex(cborEncode(1000)), '1903e8');
    assert.equal(hex(cborEncode(new Uint8Array(24))).slice(0, 4), '5818');
});

test('DER signatures: round trip, including high bits and leading zeros', () => {
    for (let i = 0; i < 50; i++) {
        const raw = crypto.getRandomValues(new Uint8Array(64));
        if (i === 0) raw.fill(0, 0, 3);
        if (i === 1) raw[32] = 0xff;
        assert.deepEqual(derToRaw(rawToDer(raw)), raw);
    }
});

test('Registration: a website can read and trust what FocuzPass returns', async () => {
    const options = creation();
    const { response, secret } = await makeCredential(options, ORIGIN, { userVerified: true, backedUp: true });

    const clientData = JSON.parse(new TextDecoder().decode(fromBase64Url(response.response.clientDataJSON)));
    assert.deepEqual(clientData, { type: 'webauthn.create', challenge: options.challenge, origin: ORIGIN, crossOrigin: false });

    const attestation = cborDecode(fromBase64Url(response.response.attestationObject)) as Map<string, Decoded>;
    assert.equal(attestation.get('fmt'), 'none', 'no attestation even when "direct" is asked for');
    assert.equal((attestation.get('attStmt') as Map<unknown, Decoded>).size, 0);
    const authData = parseAuthData(attestation.get('authData') as Uint8Array);
    assert.deepEqual(authData.rpIdHash, await sha256(new TextEncoder().encode('example.com')));
    assert.deepEqual([authData.up, authData.uv, authData.be, authData.bs, authData.at], [true, true, true, true, true]);
    assert.equal(authData.signCount, 0);
    assert.equal(authData.aaguid, FOCUZPASS_AAGUID);
    assert.equal(toBase64Url(authData.credentialId), response.id);
    assert.equal(authData.cose!.get(1), 2);
    assert.equal(authData.cose!.get(3), ES256);
    assert.equal(authData.cose!.get(-1), 1);
    assert.deepEqual(response.clientExtensionResults, { credProps: { rk: true } });
    assert.equal(secret.rpId, 'example.com');
    assert.equal(new TextDecoder().decode(fromBase64Url(secret.userHandle)), 'user-42');

    // The SPKI public key and the COSE key are the same key.
    const spki = await crypto.subtle.importKey('spki', fromBase64Url(response.response.publicKey) as BufferSource, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
    const jwk = await crypto.subtle.exportKey('jwk', spki);
    assert.deepEqual(fromBase64Url(jwk.x!), authData.cose!.get(-2));
    assert.deepEqual(fromBase64Url(jwk.y!), authData.cose!.get(-3));
});

test('Sign-in: the signature verifies against the key from registration; tampering breaks it', async () => {
    const { response: registration, secret } = await makeCredential(creation(), ORIGIN, { userVerified: true, backedUp: false });
    const publicKey = await crypto.subtle.importKey('spki', fromBase64Url(registration.response.publicKey) as BufferSource, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const request: RequestOptionsJSON = { challenge: challenge(), rpId: 'example.com', allowCredentials: [{ id: secret.credentialId, type: 'public-key' }] };
    const assertion = await getAssertion(request, ORIGIN, secret, { userVerified: false, backedUp: false });

    const authData = fromBase64Url(assertion.response.authenticatorData);
    const clientDataJSON = fromBase64Url(assertion.response.clientDataJSON);
    const signed = Uint8Array.from([...authData, ...(await sha256(clientDataJSON))]);
    const signature = derToRaw(fromBase64Url(assertion.response.signature));
    const verify = (data: Uint8Array) => crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, signature as BufferSource, data as BufferSource);
    assert.equal(await verify(signed), true);
    const tampered = signed.slice();
    tampered[40] ^= 1;
    assert.equal(await verify(tampered), false);

    const parsed = parseAuthData(authData);
    assert.deepEqual([parsed.up, parsed.uv, parsed.be, parsed.bs, parsed.at], [true, false, true, false, false], 'flags say only what is true');
    assert.equal(JSON.parse(new TextDecoder().decode(clientDataJSON)).type, 'webauthn.get');
    assert.equal(assertion.response.userHandle, secret.userHandle);
});

test('Origins: a page gets passkeys only for its own site, on a secure page', async () => {
    assert.deepEqual(checkRpId('https://login.example.com'), { ok: true, rpId: 'login.example.com' });
    assert.deepEqual(checkRpId('https://login.example.com', 'example.com'), { ok: true, rpId: 'example.com' });
    assert.deepEqual(checkRpId('http://localhost:3000'), { ok: true, rpId: 'localhost' });
    for (const [origin, rpId] of [
        ['https://evil.com', 'example.com'],
        ['https://notexample.com', 'example.com'],
        ['https://example.com.evil.com', 'example.com'],
        ['https://login.example.com', 'com'],
        ['https://a.github.io', 'github.io'],
        ['https://shop.example.co.uk', 'co.uk'],
        ['http://example.com', undefined],
        ['https://192.168.1.10', undefined],
        ['chrome-extension://abc', undefined],
    ] as const) {
        assert.equal(checkRpId(origin, rpId).ok, false, `${origin} → ${rpId}`);
    }

    const { secret } = await makeCredential(creation(), ORIGIN, { userVerified: true, backedUp: true });
    await assert.rejects(getAssertion({ challenge: challenge(), rpId: 'example.com' }, 'https://example.org', secret, { userVerified: true, backedUp: true }), (e: unknown) => e instanceof PasskeyError && e.name === 'SecurityError');
    await assert.rejects(getAssertion({ challenge: challenge(), rpId: 'other.example.com' }, 'https://other.example.com', secret, { userVerified: true, backedUp: true }), /another site/);
    await assert.rejects(getAssertion({ challenge: challenge(), allowCredentials: [{ id: 'AAAA', type: 'public-key' }] }, 'https://example.com', secret, { userVerified: true, backedUp: true }), (e: unknown) => e instanceof PasskeyError && e.name === 'NotAllowedError');
});

test('Registration refusals: no ES256, bad account id, short challenge', async () => {
    const flags = { userVerified: true, backedUp: true };
    await assert.rejects(makeCredential(creation({ pubKeyCredParams: [{ type: 'public-key', alg: -257 }] }), ORIGIN, flags), (e: unknown) => e instanceof PasskeyError && e.name === 'NotSupportedError');
    await assert.rejects(makeCredential(creation({ user: { id: toBase64Url(new Uint8Array(65)), name: 'x' } }), ORIGIN, flags), /account id/);
    await assert.rejects(makeCredential(creation({ challenge: toBase64Url(new Uint8Array(8)) }), ORIGIN, flags), /challenge/);
    await assert.rejects(makeCredential(creation({ rp: { id: 'evil.com' } }), ORIGIN, flags), (e: unknown) => e instanceof PasskeyError && e.name === 'SecurityError');
});

test('PRF: the same secret for the same input, different per passkey, as WebAuthn defines it', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const other = crypto.getRandomValues(new Uint8Array(32));
    const first = await makeCredential(creation({ extensions: { prf: { eval: { first: toBase64Url(salt) } } } }), ORIGIN, { userVerified: true, backedUp: true });
    const created = first.response.clientExtensionResults.prf as { enabled: boolean; results: { first: string } };
    assert.equal(created.enabled, true);

    // Independently: HMAC-SHA-256(seed, SHA-256("WebAuthn PRF" || 0x00 || salt)).
    const expected = async (seed: string, input: Uint8Array) => {
        const inner = await sha256(Uint8Array.from([...new TextEncoder().encode('WebAuthn PRF'), 0, ...input]));
        const key = await crypto.subtle.importKey('raw', fromBase64Url(seed) as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        return toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, inner as BufferSource)));
    };
    assert.equal(created.results.first, await expected(first.secret.prfSeed!, salt));

    const got = await getAssertion({ challenge: challenge(), rpId: 'example.com', extensions: { prf: { eval: { first: toBase64Url(salt), second: toBase64Url(other) } } } }, ORIGIN, first.secret, { userVerified: true, backedUp: true });
    const results = (got.clientExtensionResults.prf as { results: { first: string; second: string } }).results;
    assert.equal(results.first, created.results.first, 'same passkey, same input: same secret');
    assert.equal(results.second, await expected(first.secret.prfSeed!, other));

    const second = await makeCredential(creation(), ORIGIN, { userVerified: true, backedUp: true });
    const byCredential = await getAssertion(
        { challenge: challenge(), rpId: 'example.com', extensions: { prf: { eval: { first: toBase64Url(other) }, evalByCredential: { [second.secret.credentialId]: { first: toBase64Url(salt) } } } } },
        ORIGIN, second.secret, { userVerified: true, backedUp: true },
    );
    const secondResult = (byCredential.clientExtensionResults.prf as { results: { first: string } }).results.first;
    assert.notEqual(secondResult, created.results.first, 'another passkey gives another secret');
    assert.equal(secondResult, await expected(second.secret.prfSeed!, salt), 'evalByCredential wins for its passkey');
    assert.equal(second.response.clientExtensionResults.prf, undefined, 'no PRF answer when the site didn\'t ask');

    const old = { ...first.secret, prfSeed: undefined };
    const none = await getAssertion({ challenge: challenge(), rpId: 'example.com', extensions: { prf: { eval: { first: toBase64Url(salt) } } } }, ORIGIN, old, { userVerified: true, backedUp: true });
    assert.equal(none.clientExtensionResults.prf, undefined, 'passkeys from before PRF just don\'t answer it');
});

test('From an iframe on another site: crossOrigin and topOrigin are in what gets signed', async () => {
    const frame = 'https://login.example.com';
    const top = 'https://shop.other.com';
    const made = await makeCredential(creation(), frame, { userVerified: true, backedUp: true }, top);
    assert.deepEqual(JSON.parse(new TextDecoder().decode(fromBase64Url(made.response.response.clientDataJSON))), {
        type: 'webauthn.create', challenge: JSON.parse(new TextDecoder().decode(fromBase64Url(made.response.response.clientDataJSON))).challenge, origin: frame, crossOrigin: true, topOrigin: top,
    });
    const got = await getAssertion({ challenge: challenge(), rpId: 'example.com' }, frame, made.secret, { userVerified: true, backedUp: true }, frame);
    const data = JSON.parse(new TextDecoder().decode(fromBase64Url(got.response.clientDataJSON)));
    assert.equal(data.crossOrigin, false, 'same origin as the top: not cross-origin');
    assert.equal(data.topOrigin, undefined);
});
