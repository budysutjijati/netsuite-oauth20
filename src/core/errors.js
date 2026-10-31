'use strict';

const MAX_SNIPPET_LENGTH = 200;

/**
 * Reduces an HTTP error response to a short, human-readable summary instead
 * of a raw (potentially multi-KB HTML) body. Tries, in order: a parsed JSON
 * body's `error_description`/`error`/`message` field, an HTML page's
 * `<title>`, or a truncated plain-text snippet.
 */
function summarizeErrorBody(json, rawText) {
  if (json && typeof json === 'object') {
    if (typeof json.error_description === 'string' && json.error_description) {
      return json.error_description;
    }
    if (typeof json.error === 'string' && json.error) {
      return json.error;
    }
    if (typeof json.message === 'string' && json.message) {
      return json.message;
    }
  }

  if (typeof rawText === 'string' && rawText.length > 0) {
    const titleMatch = rawText.match(/<title>([^<]*)<\/title>/i);
    if (titleMatch) {
      return titleMatch[1].trim();
    }
    return rawText.length > MAX_SNIPPET_LENGTH
      ? `${rawText.slice(0, MAX_SNIPPET_LENGTH)}...`
      : rawText;
  }

  return 'Unknown error';
}

module.exports = { summarizeErrorBody };
