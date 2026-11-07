import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let getAccessToken = () => null;
let refreshAccessToken = async () => null;
let onUnauthorized = () => {};
let notifyError = () => {};
let refreshPromise = null;
let expiredSessionKey = null;

export function configureApiAuth(handlers = {}) {
  getAccessToken = handlers.getAccessToken || getAccessToken;
  refreshAccessToken = handlers.refreshAccessToken || refreshAccessToken;
  onUnauthorized = handlers.onUnauthorized || onUnauthorized;
  notifyError = handlers.notifyError || notifyError;
}

function showApiError(error, request) {
  if (request?.silent) return;

  const message = error.response?.data?.message
    || (error.response ? 'Đã xảy ra lỗi khi xử lý yêu cầu.' : 'Không thể kết nối đến máy chủ. Vui lòng thử lại.');
  notifyError(message);
}

function handleExpiredSession(request) {
  const sessionKey = request?._authSessionKey || 'anonymous';
  if (expiredSessionKey === sessionKey) return;

  expiredSessionKey = sessionKey;
  onUnauthorized();
  if (!request?.silent) notifyError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
}

api.interceptors.request.use((request) => {
  const token = getAccessToken();
  request._authSessionKey = token || 'anonymous';
  if (token && !request.skipAuthToken) {
    request.headers.Authorization = `Bearer ${token}`;
  }
  return request;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config;
    const status = error.response?.status;

    if (status === 401 && request && !request.skipAuthRefresh) {
      if (request._authRetried) {
        handleExpiredSession(request);
        return Promise.reject(error);
      }

      request._authRetried = true;
      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }

        const token = await refreshPromise;
        if (!token) throw new Error('Không thể làm mới phiên đăng nhập.');
        expiredSessionKey = null;
        return api(request);
      } catch {
        handleExpiredSession(request);
        return Promise.reject(error);
      }
    }

    if (status >= 400 || !error.response) showApiError(error, request);
    return Promise.reject(error);
  }
);

export default api;
