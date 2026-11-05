import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let getAccessToken = () => null;
let refreshAccessToken = async () => null;
let onUnauthorized = () => {};
let refreshPromise = null;

export function configureApiAuth(handlers) {
  getAccessToken = handlers.getAccessToken;
  refreshAccessToken = handlers.refreshAccessToken;
  onUnauthorized = handlers.onUnauthorized;
}

api.interceptors.request.use((request) => {
  const token = getAccessToken();
  if (token && !request.skipAuthToken) request.headers.Authorization = `Bearer ${token}`;
  return request;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config;
    const isRefreshRequest = request?.url?.includes('/auth/refresh');
    if (error.response?.status !== 401 || !request || request._retried || request.skipAuthRefresh || isRefreshRequest) {
      return Promise.reject(error);
    }

    request._retried = true;
    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const token = await refreshPromise;
      if (!token) throw error;
      request.headers.Authorization = `Bearer ${token}`;
      return api(request);
    } catch (refreshError) {
      onUnauthorized();
      return Promise.reject(refreshError);
    }
  }
);

export default api;
