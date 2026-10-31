'use strict';

function base64url(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlJSON(value) {
  return base64url(JSON.stringify(value));
}

module.exports = { base64url, base64urlJSON };
