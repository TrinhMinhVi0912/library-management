import api from '@/services/api.service';

function getData(response) {
  return response.data?.data;
}

const loanService = {
  // --- Giỏ mượn (Cart) ---
  async getCart() {
    const response = await api.get('/cart');
    return getData(response) || { items: [] };
  },

  async addToCart(bookId) {
    const response = await api.post('/cart/items', { bookId });
    return getData(response) || { items: [] };
  },

  async removeFromCart(bookId) {
    const response = await api.delete(`/cart/items/${encodeURIComponent(bookId)}`);
    return getData(response) || { items: [] };
  },

  // --- Phiếu mượn (Loans) ---
  async submitLoan(payload) {
    const response = await api.post('/loans', payload);
    return getData(response);
  },

  async getMyLoans(params = {}) {
    const response = await api.get('/me/loans', { params });
    return { loans: getData(response) || [], meta: response.data?.meta || null };
  },

  async getMyLoanById(id) {
    const response = await api.get(`/me/loans/${encodeURIComponent(id)}`);
    return getData(response);
  },

  async cancelLoan(id) {
    const response = await api.post(`/me/loans/${encodeURIComponent(id)}/cancel`);
    return getData(response);
  },
};

export default loanService;

