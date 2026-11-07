import api from '@/services/api.service';

const getData = (response) => response.data?.data;

const reservationService = {
  async getMyReservations(params = {}) {
    const response = await api.get('/me/reservations', { params });
    return {
      reservations: getData(response) || [],
      meta: response.data?.meta || { page: 1, limit: 10, total: 0, totalPages: 1 },
    };
  },

  async createReservation(bookId) {
    const response = await api.post(`/books/${encodeURIComponent(bookId)}/reservations`);
    return getData(response);
  },

  async cancelReservation(reservationId) {
    const response = await api.delete(`/me/reservations/${encodeURIComponent(reservationId)}`);
    return getData(response);
  },
};

export default reservationService;
