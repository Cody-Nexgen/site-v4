import { create, getNumericDate } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

type ServiceAccount = {
    client_email: string;
    private_key: string;
    project_id?: string;
};

let cachedToken: { token: string; exp: number } | null = null;
let cachedCryptoKey: { email: string; key: CryptoKey } | null = null;

/** Supabase secrets / .env sometimes store JSON with escaped newlines in the PEM. */
export function parseServiceAccountJson(raw: string): ServiceAccount {
    let parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
    }
    const sa = parsed as ServiceAccount;
    if (!sa?.client_email || !sa?.private_key) {
        throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_JSON');
    }
    sa.private_key = sa.private_key.replace(/\\n/g, '\n').trim();
    return sa;
}

async function importPkcs8PrivateKey(pem: string): Promise<CryptoKey> {
    const body = pem
        .replace(/-----BEGIN PRIVATE KEY-----/g, '')
        .replace(/-----END PRIVATE KEY-----/g, '')
        .replace(/\s/g, '');
    const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
    return await crypto.subtle.importKey(
        'pkcs8',
        der,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign'],
    );
}

async function getSigningKey(sa: ServiceAccount): Promise<CryptoKey> {
    if (cachedCryptoKey?.email === sa.client_email) {
        return cachedCryptoKey.key;
    }
    const key = await importPkcs8PrivateKey(sa.private_key);
    cachedCryptoKey = { email: sa.client_email, key };
    return key;
}

export async function getGoogleAccessTokenFromServiceAccount(
    serviceAccountJson: string,
): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (cachedToken && cachedToken.exp > now + 60) {
        return cachedToken.token;
    }

    const sa = parseServiceAccountJson(serviceAccountJson);
    const cryptoKey = await getSigningKey(sa);

    const jwt = await create(
        { alg: 'RS256', typ: 'JWT' },
        {
            iss: sa.client_email,
            sub: sa.client_email,
            aud: 'https://oauth2.googleapis.com/token',
            iat: getNumericDate(0),
            exp: getNumericDate(3600),
            scope: 'https://www.googleapis.com/auth/cloud-platform',
        },
        cryptoKey,
    );

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt,
        }),
    });

    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
        throw new Error(
            tokenJson.error_description || tokenJson.error || 'Google token exchange failed',
        );
    }

    cachedToken = {
        token: tokenJson.access_token as string,
        exp: now + ((tokenJson.expires_in as number) || 3600),
    };
    return cachedToken.token;
}

export function projectIdFromServiceAccount(serviceAccountJson: string): string | null {
    try {
        return parseServiceAccountJson(serviceAccountJson).project_id ?? null;
    } catch {
        return null;
    }
}
