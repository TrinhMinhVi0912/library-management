import api from '@/services/api.service';

function getData(response) {
  return response.data?.data;
}

const bookService = {
  async listBooks(params = {}) {
    const response = await api.get('/books', { params });
    return { books: getData(response) || [], meta: response.data?.meta || null };
  },

  async suggestBooks(query) {
    const response = await api.get('/books/suggest', { params: { q: query } });
    return getData(response) || [];
  },

  async getHomeBooks() {
    const response = await api.get('/books/home');
    return getData(response) || { newest: [], popular: [], topRated: [] };
  },

  async getBookByIdOrSlug(idOrSlug) {
    const response = await api.get(`/books/${encodeURIComponent(idOrSlug)}`);
    return getData(response);
  },

  async getRelatedBooks(bookId, params = {}) {
    const response = await api.get(`/books/${encodeURIComponent(bookId)}/related`, { params });
    return getData(response) || [];
  },

  async getBookReviews(bookId, params = {}) {
    const response = await api.get(`/books/${encodeURIComponent(bookId)}/reviews`, { params });
    return { reviews: getData(response) || [], meta: response.data?.meta || null };
  },
};

export default bookService;
