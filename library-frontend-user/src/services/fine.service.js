import api from '@/services/api.service';

const getData = (response) => response.data?.data;
const getMeta = (response) => response.data?.meta;

export const fineService = {
  /**
   * Lấy danh sách các khoản phạt của người dùng hiện tại
   * @param {Object} params - Query params (status, page, limit, sort)
   */
  async getMyFines(params = {}) {
    const response = await api.get('/me/fines', { params });
    return {
      items: getData(response) || [],
      meta: getMeta(response) || { page: 1, limit: 20, total: 0, totalPages: 1 },
    };
  },
};

export default fineService;

