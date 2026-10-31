'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeErrorBody } = require('../src/core/errors');

test('prefers error_description from a parsed JSON body', () => {
  const json = { error: 'invalid_request', error_description: 'missing scope' };
  assert.equal(summarizeErrorBody(json, JSON.stringify(json)), 'missing scope');
});

test('falls back to error when error_description is absent', () => {
  const json = { error: 'invalid_grant' };
  assert.equal(summarizeErrorBody(json, JSON.stringify(json)), 'invalid_grant');
});

test('falls back to message when error/error_description are absent', () => {
  const json = { message: 'something went wrong' };
  assert.equal(summarizeErrorBody(json, JSON.stringify(json)), 'something went wrong');
});

test('extracts an HTML <title> when json is not usable', () => {
  const html = '<html><head><title>502 Bad Gateway</title></head><body>oops</body></html>';
  assert.equal(summarizeErrorBody(null, html), '502 Bad Gateway');
});

test('truncates long plain text with no JSON or <title>', () => {
  const text = 'x'.repeat(250);
  const result = summarizeErrorBody(null, text);
  assert.equal(result, `${'x'.repeat(200)}...`);
});

test('returns short plain text unmodified', () => {
  assert.equal(summarizeErrorBody(null, 'short text'), 'short text');
});

test('returns Unknown error when there is nothing to go on', () => {
  assert.equal(summarizeErrorBody(null, ''), 'Unknown error');
  assert.equal(summarizeErrorBody(null, null), 'Unknown error');
  assert.equal(summarizeErrorBody({}, ''), 'Unknown error');
});
