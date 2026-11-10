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

  async getMyThreads(params = {}) {
    const response = await api.get('/forum/my/threads', { params });
    return { threads: getData(response) || [], meta: response.data?.meta || null };
  },

  async getMyThread(id) {
    const response = await api.get(`/forum/my/threads/${encodeURIComponent(id)}`);
    return getData(response);
  },

  async updateThread(id, payload) {
    const response = await api.patch(`/forum/threads/${encodeURIComponent(id)}`, payload);
    return getData(response);
  },

  async deleteThread(id) {
    const response = await api.delete(`/forum/threads/${encodeURIComponent(id)}`);
    return getData(response);
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

  /**
   * Tạo bài viết / phản hồi trong một chủ đề (yêu cầu đăng nhập)
   * @param {string} threadId
   * @param {Object} payload { content, parentPost? }
   */
  async createPost(threadId, payload) {
    const response = await api.post(`/forum/threads/${encodeURIComponent(threadId)}/posts`, payload);
    return getData(response);
  },

  /**
   * Cập nhật nội dung bài viết (yêu cầu đăng nhập)
   * @param {string} postId
   * @param {Object} payload { content }
   */
  async updatePost(postId, payload) {
    const response = await api.patch(`/forum/posts/${encodeURIComponent(postId)}`, payload);
    return getData(response);
  },

  /**
   * Xoá bài viết (yêu cầu đăng nhập)
   * @param {string} postId
   */
  async deletePost(postId) {
    const response = await api.delete(`/forum/posts/${encodeURIComponent(postId)}`);
    return getData(response);
  },

  /**
   * Thích hoặc bỏ thích bài viết (yêu cầu đăng nhập)
   * @param {string} postId
   */
  async togglePostLike(postId) {
    const response = await api.post(`/forum/posts/${encodeURIComponent(postId)}/like`);
    return getData(response);
  },

  /**
   * Báo cáo chủ đề hoặc bài viết vi phạm (yêu cầu đăng nhập)
   * @param {Object} payload { targetType: 'thread'|'post', targetId, reason, details? }
   */
  async createReport(payload) {
    const response = await api.post('/forum/reports', payload);
    return getData(response);
  },
};

export default forumService;

