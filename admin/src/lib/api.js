/**
 * Single axios instance for the whole app.
 *
 * Two behaviours worth noting:
 *
 * 1. The base URL defaults to the relative path '/api'. Combined with the dev
 *    proxy and the nginx config in production, that means the browser only ever
 *    talks to one origin, so there is no CORS preflight in normal operation and
 *    no environment-specific URL baked into the source.
 *
 * 2. A 401 triggers exactly one refresh attempt, and concurrent 401s share that
 *    single attempt. Without the shared promise, a page firing five parallel
 *    requests would fire five refreshes, and four of the resulting tokens would
 *    invalidate each other.
 */
import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const ACCESS_KEY = 'store.access';
const REFRESH_KEY = 'store.refresh';

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set({ access_token, refresh_token }) {
    if (access_token) localStorage.setItem(ACCESS_KEY, access_token);
    if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = tokenStore.access;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshInFlight = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthCall = original?.url?.includes('/auth/login') ||
                       original?.url?.includes('/auth/refresh');

    if (error.response?.status !== 401 || !original || original._retried || isAuthCall) {
      return Promise.reject(error);
    }

    const refreshToken = tokenStore.refresh;
    if (!refreshToken) {
      tokenStore.clear();
      window.dispatchEvent(new Event('store:unauthorized'));
      return Promise.reject(error);
    }

    original._retried = true;

    // Share one refresh across all concurrent 401s.
    refreshInFlight = refreshInFlight || axios
      .post(`${API_BASE_URL}/auth/refresh`, { refresh_token: refreshToken })
      .finally(() => {
        refreshInFlight = null;
      });

    try {
      const { data } = await refreshInFlight;
      tokenStore.set(data);
      original.headers.Authorization = `Bearer ${data.access_token}`;
      return api(original);
    } catch (refreshError) {
      tokenStore.clear();
      window.dispatchEvent(new Event('store:unauthorized'));
      return Promise.reject(refreshError);
    }
  },
);

/** Turn an axios failure into a message safe to show a user. */
export function errorMessage(error, fallback = 'Something went wrong.') {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  if (error?.code === 'ECONNABORTED') return 'The request timed out.';
  if (!error?.response) return 'Cannot reach the API. Is the backend running?';
  return fallback;
}

export default api;
