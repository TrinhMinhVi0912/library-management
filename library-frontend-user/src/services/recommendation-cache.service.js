const STORAGE_KEY = 'library.recommendations.session';
let inFlightRequest = null;
let cacheGeneration = 0;

function getStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

const recommendationCacheService = {
  get(userId) {
    const storage = getStorage();
    if (!storage || !userId) return null;

    try {
      const cached = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
      return cached?.userId === String(userId) && Array.isArray(cached.books) ? cached.books : null;
    } catch {
      storage.removeItem(STORAGE_KEY);
      return null;
    }
  },

  set(userId, books) {
    const storage = getStorage();
    if (!storage || !userId || !Array.isArray(books)) return;

    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({ userId: String(userId), books }));
    } catch {
      // Storage quota or browser privacy settings should not block recommendations.
    }
  },

  async load(userId, loader) {
    const cachedBooks = this.get(userId);
    if (cachedBooks) return cachedBooks;
    if (!userId || typeof loader !== 'function') return [];

    const normalizedUserId = String(userId);
    if (inFlightRequest?.userId === normalizedUserId) return inFlightRequest.promise;

    const generationAtStart = cacheGeneration;
    const promise = Promise.resolve()
      .then(loader)
      .then((result) => {
        const books = Array.isArray(result) ? result : result?.books || [];
        if (generationAtStart === cacheGeneration) this.set(normalizedUserId, books);
        return books;
      })
      .finally(() => {
        if (inFlightRequest?.promise === promise) inFlightRequest = null;
      });

    inFlightRequest = { userId: normalizedUserId, promise };
    return promise;
  },

  clear() {
    cacheGeneration += 1;
    inFlightRequest = null;
    getStorage()?.removeItem(STORAGE_KEY);
  },
};

export default recommendationCacheService;
