import { describe, it, expect, beforeEach } from 'vitest';
import { errorMessage, tokenStore } from './api.js';

describe('errorMessage', () => {
  it('prefers a plain string detail from the API', () => {
    const error = { response: { data: { detail: 'Product out of stock' } } };
    expect(errorMessage(error)).toBe('Product out of stock');
  });

  it('falls back to a generic message when there is no response', () => {
    expect(errorMessage({ code: 'ECONNABORTED' })).toBe('The request timed out.');
    expect(errorMessage({})).toBe('Cannot reach the API. Is the backend running?');
  });
});

describe('tokenStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and clears the access and refresh tokens', () => {
    expect(tokenStore.access).toBeNull();

    tokenStore.set({ access_token: 'a1', refresh_token: 'r1' });
    expect(tokenStore.access).toBe('a1');
    expect(tokenStore.refresh).toBe('r1');

    tokenStore.clear();
    expect(tokenStore.access).toBeNull();
    expect(tokenStore.refresh).toBeNull();
  });
});
