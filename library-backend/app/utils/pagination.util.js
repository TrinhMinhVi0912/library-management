/**
 * Tiện ích xử lý phân trang chuẩn cho toàn hệ thống
 * Quy ước: limit mặc định là 12, tối đa là 100
 */

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 100;

/**
 * Phân tích và chuẩn hóa tham số phân trang từ req.query
 * 
 * @param {object} [query={}] - req.query hoặc object chứa page, limit, sort
 * @param {object} [options={}] - Các cấu hình mặc định bổ sung
 * @param {number} [options.defaultLimit=12] - Limit mặc định nếu không truyền
 * @param {any} [options.defaultSort='-createdAt'] - Thứ tự sắp xếp mặc định
 * @returns {{ page: number, limit: number, skip: number, sort: any }}
 */
const parsePagination = (query = {}, options = {}) => {
  const defaultLimit = options.defaultLimit || DEFAULT_LIMIT;
  const defaultSort = options.defaultSort !== undefined ? options.defaultSort : '-createdAt';

  let page = parseInt(query.page, 10);
  if (isNaN(page) || page < 1) {
    page = DEFAULT_PAGE;
  }

  let limit = parseInt(query.limit, 10);
  if (isNaN(limit) || limit < 1) {
    limit = defaultLimit;
  }
  if (limit > MAX_LIMIT) {
    limit = MAX_LIMIT;
  }

  const skip = (page - 1) * limit;

  let sort = query.sort;
  if (!sort && sort !== '') {
    sort = defaultSort;
  }

  return {
    page,
    limit,
    skip,
    sort,
  };
};

/**
 * Xây dựng đối tượng metadata cho danh sách phân trang
 * 
 * @param {number|object} totalOrObj - Tổng số bản ghi (number) hoặc object { total, page, limit }
 * @param {number} [pageParam] - Trang hiện tại
 * @param {number} [limitParam] - Số lượng trên mỗi trang
 * @returns {{ page: number, limit: number, total: number, totalPages: number }}
 */
const buildPaginationMeta = (totalOrObj, pageParam, limitParam) => {
  let total;
  let page;
  let limit;

  if (typeof totalOrObj === 'object' && totalOrObj !== null) {
    total = Number(totalOrObj.total) || 0;
    page = Number(totalOrObj.page) || DEFAULT_PAGE;
    limit = Number(totalOrObj.limit) || DEFAULT_LIMIT;
  } else {
    total = Number(totalOrObj) || 0;
    page = Number(pageParam) || DEFAULT_PAGE;
    limit = Number(limitParam) || DEFAULT_LIMIT;
  }

  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

  return {
    page,
    limit,
    total,
    totalPages,
  };
};

module.exports = {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  parsePagination,
  buildPaginationMeta,
};
