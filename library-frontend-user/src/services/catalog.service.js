import api from '@/services/api.service';

const catalogService = {
  async getCategories(params = { all: true }) {
    const response = await api.get('/categories', { params });
    return { categories: response.data?.data || [], meta: response.data?.meta || null };
  },
};

export default catalogService;
