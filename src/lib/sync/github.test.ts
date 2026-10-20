import { describe, expect, it } from 'vitest';
import { decodeBase64, encodeBase64, REPO_PATTERN } from './github';

describe('base64', () => {
  it('round-trips UTF-8 text, including ₹ and em dashes', () => {
    const text = 'Spent ₹1,200 — worth it. “Quoted”';
    expect(decodeBase64(encodeBase64(text))).toBe(text);
  });

  it('decodes GitHub content with line breaks in it', () => {
    const b64 = encodeBase64('x'.repeat(200));
    const wrapped = b64.replace(/(.{60})/g, '$1\n');
    expect(decodeBase64(wrapped)).toBe('x'.repeat(200));
  });

  it('encodes text larger than one chunk', () => {
    const text = 'abc'.repeat(50_000);
    expect(decodeBase64(encodeBase64(text))).toBe(text);
  });
});

describe('REPO_PATTERN', () => {
  it('accepts owner/name and rejects anything else', () => {
    expect(REPO_PATTERN.test('jaineel1/chronicle-data')).toBe(true);
    expect(REPO_PATTERN.test('chronicle-data')).toBe(false);
    expect(REPO_PATTERN.test('https://github.com/a/b')).toBe(false);
  });
});
