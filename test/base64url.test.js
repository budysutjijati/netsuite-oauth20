'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { base64url, base64urlJSON } = require('../src/core/base64url');

test('base64url produces URL-safe output with no padding', () => {
  // Input chosen to force both '+'/'-' and '/'_' substitution plus '='
  // padding in plain base64, so the assertions exercise every replacement.
  const input = Buffer.from([0xfb, 0xff, 0xbf]);
  const plain = input.toString('base64');
  assert.equal(plain, '+/+/');

  const encoded = base64url(input);
  assert.equal(encoded, '-_-_');
  assert.ok(!encoded.includes('+'));
  assert.ok(!encoded.includes('/'));
  assert.ok(!encoded.includes('='));
});

test('base64url accepts a string input', () => {
  assert.equal(base64url('hi'), Buffer.from('hi').toString('base64url'));
});

test('base64urlJSON base64url-encodes the JSON-stringified value', () => {
  const value = { a: 1, b: 'two' };
  assert.equal(base64urlJSON(value), base64url(JSON.stringify(value)));
});
