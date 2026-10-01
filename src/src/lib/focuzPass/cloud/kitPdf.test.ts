import assert from 'node:assert/strict';
import test from 'node:test';
import { emergencyKitPdf, recoveryKeyPdf, setupCodePayload, type KitDetails } from './kitPdf';
import { encodeQr } from '../transfer/qr';
import { parseAccountKey } from './keys';

const KIT: KitDetails = {
    email: 'sam.lee@acme-studio.com',
    secretKey: 'A1-7QX2KD-9MPWZ-4RTB8-HN3CF-V6YGJ',
    secretKeyCanonical: 'A17QX2KD9MPWZ4RTB8HN3CFV6YGJ',
    secretKeyId: '7QX2KD',
    created: new Date('2026-09-29T12:00:00Z'),
};

const latin1 = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');

/** Checks the file is a well-formed single-page PDF and returns its text. */
function checkStructure(bytes: Uint8Array): string {
    const pdf = latin1(bytes);
    assert.ok(pdf.startsWith('%PDF-1.4\n'), 'header');
    assert.ok(pdf.endsWith('%%EOF\n'), 'trailer');
    const startxref = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(pdf)?.[1]);
    assert.equal(pdf.slice(startxref, startxref + 4), 'xref');
    const count = Number(/^xref\n0 (\d+)\n/.exec(pdf.slice(startxref))?.[1]);
    const entries = pdf.slice(startxref).split('\n').slice(3, 2 + count);
    assert.equal(entries.length, count - 1);
    entries.forEach((entry, i) => {
        const offset = Number(entry.slice(0, 10));
        assert.ok(pdf.startsWith(`${i + 1} 0 obj\n`, offset), `xref entry ${i + 1} points at its object`);
    });
    const stream = /<< \/Length (\d+) >>\nstream\n/.exec(pdf)!;
    const length = Number(stream[1]);
    assert.equal(pdf.slice(stream.index + stream[0].length + length, stream.index + stream[0].length + length + 10), '\nendstream');
    // Everything after the binary marker line is plain ASCII: the typographic characters go in as escapes.
    const body = bytes.subarray(pdf.indexOf('\n', 9) + 1);
    assert.ok(body.every((b) => b === 10 || (b >= 32 && b <= 126)), 'plain ASCII');
    return pdf;
}

/**
 * The key's text run (Courier, /F3): what it says, and whether it's laid out so copying it can't
 * come out spaced: one text object, one position, no character spacing, no kerning offsets.
 */
function keyRun(pdf: string) {
    const block = /BT \/F3 [^\n]*? ET/.exec(pdf)?.[0] ?? '';
    return {
        text: [...block.matchAll(/\(([^)]*)\) Tj/g)].map((m) => m[1]).join(''),
        gapless: (block.match(/ Td /g) ?? []).length === 1 && / 0 Tc /.test(block) && !/\bTJ\b/.test(block) && !/ [1-9][\d.]* Tc /.test(block),
    };
}

test('Emergency Kit: a valid one-page PDF with the Security Key and blanks for both passwords', () => {
    const pdf = checkStructure(emergencyKitPdf(KIT));
    assert.match(pdf, /\/Count 1 >>/);
    assert.deepEqual(keyRun(pdf), { text: KIT.secretKey, gapless: true }, 'the Security Key, as one run that copies as written');
    assert.ok(pdf.includes(`(${KIT.email}) Tj`), 'email printed');
    assert.ok(pdf.includes('(Key ID 7QX2KD) Tj'));
    assert.ok(pdf.includes('(FocuzNow password) Tj') && pdf.includes('(Master password) Tj'));
    assert.equal(parseAccountKey(keyRun(pdf).text, 'secret'), KIT.secretKeyCanonical, 'and FocuzPass reads what copies');
    assert.match(pdf, /\(A1\) Tj 3 Tr \(-\) Tj 0 Tr \(7QX2KD\) Tj/, 'dashes are in the text but not painted');
    assert.ok(pdf.includes('/URI (https://focuznow.com)'), 'sign-in link');
    assert.ok(pdf.includes('/Title (FocuzPass Emergency Kit)'));
});

test('Emergency Kit: text that could break the file is escaped', () => {
    const pdf = checkStructure(emergencyKitPdf({ ...KIT, email: 'a(b)\\c@example.com' }));
    assert.ok(pdf.includes('(a\\(b\\)\\\\c@example.com) Tj'));
    const odd = checkStructure(emergencyKitPdf({ ...KIT, email: 'zoë@例え.jp' }));
    assert.ok(odd.includes('(zo?@??.jp) Tj'), 'characters the standard fonts lack become ?');
});

test('Emergency Kit: no email still makes a sensible kit', () => {
    const pdf = checkStructure(emergencyKitPdf({ ...KIT, email: undefined }));
    assert.ok(pdf.includes('(For your FocuzNow account \\267 September 29, 2026) Tj'), 'the middle dot goes in as its WinAnsi code');
});

test('Setup code: holds the email and Security Key, and fits a QR code', () => {
    const payload = setupCodePayload(KIT);
    assert.ok(payload.startsWith('FZKIT1'));
    assert.deepEqual(JSON.parse(payload.slice(6)), { e: KIT.email, k: KIT.secretKeyCanonical, i: KIT.secretKeyId });
    const matrix = encodeQr(payload, 'M');
    assert.ok(matrix.size <= 41, `small enough to scan from paper (version ${(matrix.size - 17) / 4})`);
});

test('Recovery key sheet: its own PDF, without the Security Key', () => {
    const pdf = checkStructure(recoveryKeyPdf({ email: KIT.email, recoveryKey: 'R1-4HNWQ8-ZC3RT-7PX2M-KV9DB-F6YJG', created: KIT.created }));
    assert.deepEqual(keyRun(pdf), { text: 'R1-4HNWQ8-ZC3RT-7PX2M-KV9DB-F6YJG', gapless: true });
    assert.ok(!pdf.includes(KIT.secretKeyCanonical) && !pdf.includes('7QX2KD'));
    assert.ok(pdf.includes('/Title (FocuzPass Recovery Key)'));
});
