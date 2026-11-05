import api from '@/services/api.service';

const getData = (response) => response.data?.data;

export async function login(credentials) {
  return getData(await api.post('/auth/login', credentials, { skipAuthToken: true, skipAuthRefresh: true }));
}

export async function refresh() {
  return getData(await api.post('/auth/refresh', {}, { skipAuthRefresh: true }));
}

export async function getCurrentUser() {
  return getData(await api.get('/me'));
}

export async function logout() {
  return getData(await api.post('/auth/logout', {}, { skipAuthRefresh: true }));
}
