import assert from 'node:assert/strict';
import test from 'node:test';
import { markLetters, nameInitials, readableTitle, tileHue } from './displayName';

test('Raw web addresses become the site name', () => {
    assert.equal(readableTitle('account.hoyolab.com'), 'Hoyolab');
    assert.equal(readableTitle('login.live.com'), 'Live');
    assert.equal(readableTitle('us05web.zoom.us'), 'Zoom');
    assert.equal(readableTitle('www.loom.com'), 'Loom');
    assert.equal(readableTitle('https://web.gamo.focuznow.com/login'), 'Focuznow');
    assert.equal(readableTitle('shop.bbc.co.uk'), 'Bbc');
    assert.equal(readableTitle('idmsa.apple.com'), 'Apple');
});

test('Names people typed stay as they are', () => {
    assert.equal(readableTitle('Chase Sapphire'), 'Chase Sapphire');
    assert.equal(readableTitle('GitHub'), 'GitHub');
    assert.equal(readableTitle('localhost'), 'localhost');
    assert.equal(readableTitle('Home Wi-Fi'), 'Home Wi-Fi');
    assert.equal(readableTitle(''), '');
});

test('Tile letters and colours', () => {
    assert.equal(markLetters('Hoyolab'), 'Ho');
    assert.equal(markLetters('Focuznow'), 'Fo');
    assert.equal(markLetters('X'), 'X');
    assert.equal(markLetters('!!'), '•');
    assert.equal(tileHue('Focuznow'), tileHue('focuznow'));
});

test('Identity initials', () => {
    assert.equal(nameInitials('Maya Jones'), 'MJ');
    assert.equal(nameInitials('  cher '), 'C');
    assert.equal(nameInitials('maya r. de la cruz'), 'MC');
    assert.equal(nameInitials('Élodie Brun'), 'ÉB');
    assert.equal(nameInitials(''), '');
});
