import api from './api.service';

function getData(response) {
  return response.data?.data;
}

/**
 * Service quản lý kệ sách cá nhân của độc giả
 * Tương ứng backend route: /me/shelves
 */
export const shelfService = {
  /**
   * Lấy danh sách tất cả kệ sách của độc giả (kèm sách trong từng kệ)
   * Backend tự động khởi tạo 3 kệ mặc định nếu chưa có: Muốn đọc, Đang đọc, Đã đọc
   */
  async getMyShelves() {
    const response = await api.get('/me/shelves');
    return getData(response) || [];
  },

  /**
   * Tạo kệ sách tùy chỉnh mới
   * @param {Object} payload { name: string }
   */
  async createShelf(payload) {
    const response = await api.post('/me/shelves', payload);
    return getData(response);
  },

  /**
   * Đổi tên kệ sách tùy chỉnh (không thể đổi tên kệ mặc định)
   * @param {string} shelfId
   * @param {Object} payload { name: string }
   */
  async updateShelf(shelfId, payload) {
    const response = await api.patch(`/me/shelves/${shelfId}`, payload);
    return getData(response);
  },

  /**
   * Xóa kệ sách tùy chỉnh (không thể xóa kệ mặc định)
   * @param {string} shelfId
   */
  async deleteShelf(shelfId) {
    const response = await api.delete(`/me/shelves/${shelfId}`);
    return getData(response);
  },

  /**
   * Thêm một quyển sách vào kệ
   * @param {string} shelfId
   * @param {string} bookId
   */
  async addBookToShelf(shelfId, bookId) {
    const response = await api.post(`/me/shelves/${shelfId}/books/${bookId}`);
    return getData(response);
  },

  /**
   * Xóa một quyển sách khỏi kệ
   * @param {string} shelfId
   * @param {string} bookId
   */
  async removeBookFromShelf(shelfId, bookId) {
    const response = await api.delete(`/me/shelves/${shelfId}/books/${bookId}`);
    return getData(response);
  },

  /**
   * Chuyển sách từ kệ này sang kệ khác (thêm vào kệ đích trước, sau đó xóa khỏi kệ nguồn)
   * @param {string} fromShelfId
   * @param {string} toShelfId
   * @param {string} bookId
   */
  async moveBookBetweenShelves(fromShelfId, toShelfId, bookId) {
    await this.addBookToShelf(toShelfId, bookId);
    await this.removeBookFromShelf(fromShelfId, bookId);
  },
};

export default shelfService;
