import api from '@/services/api.service';

const catalogService = {
  async getCategories(params = { all: true }) {
    const response = await api.get('/categories', { params });
    return { categories: response.data?.data || [], meta: response.data?.meta || null };
  },

  async getAuthors(params = { all: true }) {
    const response = await api.get('/authors', { params });
    return { authors: response.data?.data || [], meta: response.data?.meta || null };
  },

  async getPublishers(params = { all: true }) {
    const response = await api.get('/publishers', { params });
    return { publishers: response.data?.data || [], meta: response.data?.meta || null };
  },
};

export default catalogService;
