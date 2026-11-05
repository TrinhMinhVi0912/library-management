import { io } from 'socket.io-client';

const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
const listeners = new Map();
let socket = null;
let getToken = () => null;
let refreshToken = async () => null;
let refreshing = null;

export function configureSocketAuth(handlers) {
  getToken = handlers.getToken;
  refreshToken = handlers.refreshToken;
}

function dispatch(event, payload) {
  listeners.get(event)?.forEach((handler) => handler(payload));
}

async function renewSocketSession() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const token = await refreshToken();
    if (!token || !socket) return false;
    socket.auth = { token };
    if (!socket.connected) socket.connect();
    return true;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export function connectSocket() {
  const token = getToken();
  if (!token) return null;

  if (!socket) {
    socket = io(socketUrl, {
      autoConnect: false,
      auth: { token },
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socket.onAny(dispatch);
    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') renewSocketSession();
    });
    socket.on('connect_error', (error) => {
      if (error.message.includes('hết hạn')) renewSocketSession();
    });
    socket.io.on('reconnect_attempt', () => {
      const latestToken = getToken();
      if (latestToken) socket.auth = { token: latestToken };
    });
  } else {
    socket.auth = { token };
  }

  if (!socket.connected) socket.connect();
  return socket;
}

export function onSocketEvent(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => listeners.get(event)?.delete(handler);
}

export function disconnectSocket() {
  if (!socket) return;
  socket.disconnect();
  socket = null;
}
