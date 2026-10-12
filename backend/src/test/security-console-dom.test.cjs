const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'src/main/resources/templates/dashboards/security.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'src/main/resources/static/smartapartment/js/security-console.js'), 'utf8');

test('security template has unique IDs and properly nested containers', () => {
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, 'Duplicate IDs break dashboard actions');
    const stack = [];
    const voids = new Set(['meta', 'link', 'input', 'img', 'br', 'hr', 'source', 'area', 'base', 'embed', 'wbr']);
    for (const match of html.matchAll(/<(\/?)([a-z][a-z0-9-]*)\b[^>]*>/gi)) {
        const tag = match[2].toLowerCase();
        if (voids.has(tag)) continue;
        if (match[1]) assert.equal(stack.pop(), tag, `Mismatched closing ${tag}`);
        else stack.push(tag);
    }
    assert.deepEqual(stack, []);
});

test('every literal DOM lookup has a corresponding static or dynamic element', () => {
    const available = new Set([...(`${html}\n${js}`).matchAll(/\bid="([a-zA-Z][a-zA-Z0-9_-]*)"/g)].map(m => m[1]));
    for (const match of js.matchAll(/\$\('([a-zA-Z][a-zA-Z0-9_-]*)'\)/g)) {
        assert.ok(available.has(match[1]), `Missing element ${match[1]}`);
    }
});

test('console JavaScript parses and shared legacy handlers are excluded', () => {
    assert.doesNotThrow(() => new vm.Script(js));
    assert.ok(html.includes('/smartapartment/js/security-console.js'));
    assert.ok(!/onclick=|dashboard-controls\.js|security-gate-live\.js|fragments\/layout/.test(html));
});

test('every navigation destination has an implemented route', () => {
    for (const match of html.matchAll(/data-nav="([a-z]+)"/g)) {
        assert.ok(new RegExp(`(?:\\{|,)${match[1]}:`).test(js), `Missing route ${match[1]}`);
    }
});
