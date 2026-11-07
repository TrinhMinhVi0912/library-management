import api from './api.service';

function getData(response) {
  return response.data?.data;
}

/**
 * Service diễn đàn trao đổi (Forum) dành cho người dùng
 * Tương ứng backend route: /forum/...
 */
export const forumService = {
  /**
   * Lấy danh sách tất cả chuyên mục diễn đàn
   * Public: không cần đăng nhập
   */
  async getCategories() {
    const response = await api.get('/forum/categories');
    return getData(response) || [];
  },

  /**
   * Lấy danh sách chủ đề có phân trang, lọc và sắp xếp
   * @param {Object} params { page, limit, category, book, q, sort: 'latest'|'active'|'popular'|'views' }
   * Public: không cần đăng nhập
   */
  async getThreads(params = {}) {
    const response = await api.get('/forum/threads', { params });
    return {
      threads: getData(response) || [],
      meta: response.data?.meta || null,
    };
  },

  /**
   * Lấy chi tiết một chủ đề theo ID hoặc Slug
   * @param {string} idOrSlug
   */
  async getThread(idOrSlug) {
    const response = await api.get(`/forum/threads/${encodeURIComponent(idOrSlug)}`);
    return getData(response);
  },

  /**
   * Lấy danh sách bài viết / phản hồi trong một chủ đề
   * @param {string} threadId
   * @param {Object} params { page, limit }
   */
  async getPosts(threadId, params = {}) {
    const response = await api.get(`/forum/threads/${encodeURIComponent(threadId)}/posts`, { params });
    return {
      posts: getData(response) || [],
      meta: response.data?.meta || null,
    };
  },

  /**
   * Tạo chủ đề mới (yêu cầu đăng nhập)
   * @param {Object} payload { category, title, content, book?, tags? }
   */
  async createThread(payload) {
    const response = await api.post('/forum/threads', payload);
    return getData(response);
  },

  /**
   * Thích hoặc bỏ thích chủ đề (yêu cầu đăng nhập)
   * @param {string} threadId
   */
  async toggleThreadLike(threadId) {
    const response = await api.post(`/forum/threads/${encodeURIComponent(threadId)}/like`);
    return getData(response);
  },
};

export default forumService;

