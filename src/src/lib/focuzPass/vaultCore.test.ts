import assert from 'node:assert/strict';
import test from 'node:test';
import { vaultDomainMatch, vaultSiteOf } from './vaultCore';

test('Logins match across one site, exact address ranked first', () => {
    assert.equal(vaultDomainMatch('idmsa.apple.com', 'idmsa.apple.com'), 2);
    assert.equal(vaultDomainMatch('https://www.apple.com/', 'apple.com'), 2);
    assert.equal(vaultDomainMatch('appleid.apple.com', 'developer.apple.com'), 1);
    assert.equal(vaultDomainMatch('apple.com', 'idmsa.apple.com'), 1);
    assert.equal(vaultDomainMatch('shop.bbc.co.uk', 'bbc.co.uk'), 1);
    assert.equal(vaultDomainMatch('apple.com', 'apple.co.uk'), 0);
    assert.equal(vaultDomainMatch('evilapple.com', 'apple.com'), 0);
    assert.equal(vaultDomainMatch('', 'apple.com'), 0);
});

test('Shared hosting, IPs and public endings never match across subdomains', () => {
    assert.equal(vaultDomainMatch('alice.github.io', 'bob.github.io'), 0);
    assert.equal(vaultDomainMatch('alice.github.io', 'alice.github.io'), 2);
    assert.equal(vaultDomainMatch('my-app.vercel.app', 'other.vercel.app'), 0);
    assert.equal(vaultDomainMatch('a.b.up.railway.app', 'c.up.railway.app'), 0);
    assert.equal(vaultDomainMatch('foo.co.uk', 'bar.co.uk'), 0);
    assert.equal(vaultDomainMatch('192.168.1.1', '192.168.1.2'), 0);
    assert.equal(vaultSiteOf('localhost'), 'localhost');
    assert.equal(vaultSiteOf('login.live.com'), 'live.com');
});
