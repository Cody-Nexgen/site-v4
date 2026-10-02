import assert from 'node:assert/strict';
import test from 'node:test';
import { hexToHsv, hexToRgb, hsvToHex, normalizeHex, parseRgb, rgbToHex } from './color';

test('Hex input is normalised, junk is refused', () => {
    assert.equal(normalizeHex('#ABC'), '#aabbcc');
    assert.equal(normalizeHex('6e8fb8'), '#6e8fb8');
    assert.equal(normalizeHex(' #6E8FB8 '), '#6e8fb8');
    assert.equal(normalizeHex('#6e8fb'), null);
    assert.equal(normalizeHex('red; background: url(x)'), null);
});

test('RGB text is parsed in the usual shapes', () => {
    assert.deepEqual(parseRgb('rgb(110, 143, 184)'), { r: 110, g: 143, b: 184 });
    assert.deepEqual(parseRgb('110,143,184'), { r: 110, g: 143, b: 184 });
    assert.deepEqual(parseRgb('110 143 184'), { r: 110, g: 143, b: 184 });
    assert.equal(parseRgb('300, 0, 0'), null);
    assert.equal(parseRgb('hello'), null);
});

test('Hex -> HSV -> hex round-trips', () => {
    for (const hex of ['#6e8fb8', '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#cf7f79', '#80b8bd']) {
        assert.equal(hsvToHex(hexToHsv(hex)!), hex);
    }
    assert.equal(rgbToHex(hexToRgb('#d5a16f')!), '#d5a16f');
    assert.equal(rgbToHex({ r: 300, g: -5, b: 127.6 }), '#ff0080');
});
