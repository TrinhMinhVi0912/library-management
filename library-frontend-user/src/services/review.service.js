import api from '@/services/api.service';

function getData(response) {
  return response.data?.data;
}

const reviewService = {
  /**
   * Lấy danh sách đánh giá của một cuốn sách
   * @param {string} bookId
   * @param {Object} params
   */
  async getBookReviews(bookId, params = {}) {
    const response = await api.get(`/books/${encodeURIComponent(bookId)}/reviews`, { params });
    return {
      reviews: getData(response) || [],
      meta: response.data?.meta || null,
    };
  },

  /**
   * Kiểm tra độc giả hiện tại có quyền đánh giá sách không
   * @param {string} bookId
   */
  async canReview(bookId) {
    try {
      const response = await api.get(`/books/${encodeURIComponent(bookId)}/reviews/can-review`, {
        silent: true,
      });
      const data = getData(response);
      return Boolean(data?.canReview);
    } catch {
      return false;
    }
  },

  /**
   * Độc giả tạo mới hoặc cập nhật đánh giá cho sách
   * @param {string} bookId
   * @param {{ rating: number, comment?: string }} payload
   */
  async createOrUpdateReview(bookId, payload) {
    const response = await api.post(`/books/${encodeURIComponent(bookId)}/reviews`, payload);
    return getData(response);
  },

  /**
   * Lấy danh sách đánh giá của chính tôi
   * @param {Object} params
   */
  async getMyReviews(params = {}) {
    const response = await api.get('/me/reviews', { params });
    return {
      reviews: getData(response) || [],
      meta: response.data?.meta || null,
    };
  },

  /**
   * Cập nhật đánh giá của chính tôi
   * @param {string} reviewId
   * @param {{ rating?: number, comment?: string }} payload
   */
  async updateOwnReview(reviewId, payload) {
    const response = await api.patch(`/reviews/${encodeURIComponent(reviewId)}`, payload);
    return getData(response);
  },

  /**
   * Xóa đánh giá của chính tôi
   * @param {string} reviewId
   */
  async deleteOwnReview(reviewId) {
    const response = await api.delete(`/reviews/${encodeURIComponent(reviewId)}`);
    return getData(response);
  },
};

export default reviewService;

