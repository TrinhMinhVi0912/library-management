const jsonResponse = (description = 'Thành công') => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
});

const errorResponses = {
  401: { description: 'Chưa xác thực' },
  403: { description: 'Không đủ quyền' },
  422: { description: 'Dữ liệu không hợp lệ' },
};

const operation = (summary, tag, { secured = false, requestBody, parameters = [], responses = {} } = {}) => ({
  summary,
  tags: [tag],
  ...(secured ? { security: [{ bearerAuth: [] }] } : { security: [] }),
  ...(parameters.length ? { parameters } : {}),
  ...(requestBody ? { requestBody } : {}),
  responses: { 200: jsonResponse(), 400: { description: 'Yêu cầu không hợp lệ' }, ...errorResponses, ...responses },
});

const idParameter = (name = 'id') => ({
  name,
  in: 'path',
  required: true,
  schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
});

const body = (schema) => ({
  required: true,
  content: { 'application/json': { schema } },
});

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Library Management API',
    version: '1.0.0',
    description: 'API hệ thống quản lý mượn sách. Base API: `/api/v1`. Các route chạy job được ghi riêng ở phần System.',
  },
  servers: [{ url: '/', description: 'Cùng origin với backend đang chạy' }],
  tags: [
    { name: 'Auth', description: 'Đăng nhập, đăng ký và phiên' },
    { name: 'Books', description: 'Danh mục sách công khai và đặt trước' },
    { name: 'Reader', description: 'Giỏ, phiếu mượn và dữ liệu cá nhân' },
    { name: 'Forum', description: 'Chủ đề và bài trả lời' },
    { name: 'Admin', description: 'Chức năng staff/admin' },
    { name: 'System', description: 'Health check và jobs bảo vệ bằng secret' },
  ],
  paths: {
    '/api/v1/auth/register': { post: operation('Đăng ký độc giả', 'Auth', { requestBody: body({ $ref: '#/components/schemas/RegisterRequest' }), responses: { 201: jsonResponse('Tạo tài khoản thành công'), 409: { description: 'Email đã tồn tại' } } }) },
    '/api/v1/auth/login': { post: operation('Đăng nhập', 'Auth', { requestBody: body({ $ref: '#/components/schemas/LoginRequest' }), responses: { 200: jsonResponse('Đăng nhập thành công; refresh token được đặt trong cookie httpOnly'), 401: { description: 'Email hoặc mật khẩu không đúng' } } }) },
    '/api/v1/auth/refresh': { post: operation('Làm mới access token và rotate refresh token', 'Auth', { requestBody: body({ type: 'object', properties: { refreshToken: { type: 'string', description: 'Có thể bỏ qua nếu dùng cookie httpOnly' } } }) }) },
    '/api/v1/auth/logout': { post: operation('Đăng xuất và thu hồi refresh token', 'Auth') },
    '/api/v1/auth/forgot-password': { post: operation('Gửi email đặt lại mật khẩu', 'Auth', { requestBody: body({ type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } }) }) },
    '/api/v1/auth/reset-password': { post: operation('Đặt mật khẩu mới bằng reset token', 'Auth', { requestBody: body({ type: 'object', required: ['token', 'password'], properties: { token: { type: 'string' }, password: { type: 'string', format: 'password' } } }) }) },
    '/api/v1/books': { get: operation('Tìm kiếm và lọc sách', 'Books', { parameters: [{ name: 'q', in: 'query', schema: { type: 'string' } }, { name: 'category', in: 'query', schema: { type: 'string' } }, { name: 'author', in: 'query', schema: { type: 'string' } }, { name: 'available', in: 'query', schema: { type: 'boolean' } }, { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } }] }) },
    '/api/v1/books/{idOrSlug}': { get: operation('Xem chi tiết sách', 'Books', { parameters: [{ name: 'idOrSlug', in: 'path', required: true, schema: { type: 'string' } }] }) },
    '/api/v1/books/{bookId}/reservations': { post: operation('Đặt trước sách đã hết bản công khai', 'Books', { secured: true, parameters: [idParameter('bookId')], responses: { 201: jsonResponse('Đã thêm vào hàng chờ FIFO'), 409: { description: 'Sách còn bản công khai hoặc đã có lượt đặt trước đang hoạt động' } } }) },
    '/api/v1/cart': { get: operation('Xem giỏ mượn', 'Reader', { secured: true }) },
    '/api/v1/cart/items': { post: operation('Thêm sách vào giỏ', 'Reader', { secured: true, requestBody: body({ type: 'object', required: ['bookId'], properties: { bookId: { type: 'string' } } }) }) },
    '/api/v1/loans': { post: operation('Gửi yêu cầu mượn từ giỏ', 'Reader', { secured: true, requestBody: body({ $ref: '#/components/schemas/LoanRequest' }), responses: { 201: jsonResponse('Đã tạo yêu cầu mượn') } }) },
    '/api/v1/me/loans': { get: operation('Xem phiếu mượn của tôi', 'Reader', { secured: true, parameters: [{ name: 'status', in: 'query', schema: { type: 'string' }, required: false }] }) },
    '/api/v1/me/loans/{id}/cancel': { post: operation('Hủy phiếu đang chờ hoặc đã duyệt', 'Reader', { secured: true, parameters: [idParameter()] }) },
    '/api/v1/me/reservations': { get: operation('Xem hàng đặt trước và vị trí FIFO', 'Reader', { secured: true }) },
    '/api/v1/me/reservations/{id}': { delete: operation('Hủy lượt đặt trước', 'Reader', { secured: true, parameters: [idParameter()] }) },
    '/api/v1/forum/threads': {
      get: operation('Danh sách chủ đề', 'Forum'),
      post: operation('Tạo chủ đề', 'Forum', { secured: true, requestBody: body({ type: 'object', required: ['category', 'title', 'content'], properties: { category: { type: 'string' }, title: { type: 'string', maxLength: 150 }, content: { type: 'string', maxLength: 10000 } } }), responses: { 201: jsonResponse('Đã tạo chủ đề'), 429: { description: 'Vượt giới hạn đăng bài' } } }),
    },
    '/api/v1/admin/dashboard/summary': { get: operation('Tổng quan dashboard', 'Admin', { secured: true }) },
    '/api/v1/admin/dashboard/charts': { get: operation('Dữ liệu biểu đồ', 'Admin', { secured: true, parameters: [{ name: 'range', in: 'query', schema: { type: 'string', enum: ['7d', '30d', '12m'], default: '30d' } }] }) },
    '/api/v1/admin/loans/{id}/approve': { post: operation('Duyệt yêu cầu mượn', 'Admin', { secured: true, parameters: [idParameter()] }) },
    '/api/v1/admin/loans/{id}/handover': { post: operation('Xác nhận giao sách', 'Admin', { secured: true, parameters: [idParameter()] }) },
    '/api/v1/admin/loans/{id}/return': { post: operation('Xác nhận trả sách và ghi phạt', 'Admin', { secured: true, parameters: [idParameter()], requestBody: body({ type: 'object', required: ['items'], properties: { items: { type: 'array', items: { type: 'object', required: ['bookId', 'condition'], properties: { bookId: { type: 'string' }, condition: { type: 'string', enum: ['good', 'damaged', 'lost'] }, fineAmount: { type: 'number' }, note: { type: 'string' } } } } } }) }) },
    '/api/v1/admin/loan-return-policy': { get: operation('Chính sách tiền phạt trả sách (staff/admin)', 'Admin', { secured: true }) },
    '/api/v1/admin/renewals': { get: operation('Danh sách yêu cầu gia hạn', 'Admin', { secured: true }) },
    '/api/v1/admin/settings': { get: operation('Xem thiết lập nghiệp vụ', 'Admin', { secured: true }), put: operation('Cập nhật thiết lập nghiệp vụ', 'Admin', { secured: true }) },
    '/api/v1/admin/audit-logs': { get: operation('Nhật ký kiểm toán', 'Admin', { secured: true }) },
    '/health': { get: operation('Kiểm tra sức khỏe backend', 'System', { responses: { 200: jsonResponse('Backend hoạt động') } }) },
    '/jobs/{name}': { post: operation('Chạy job thủ công', 'System', { parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string', enum: ['expirePickup', 'markOverdue', 'dueReminder', 'cleanup', 'expireReservation'] } }, { name: 'x-jobs-secret', in: 'header', required: true, schema: { type: 'string' } }], responses: { 401: { description: 'Thiếu hoặc sai x-jobs-secret' } } }) },
    '/api/v1/system/jobs/{name}': { post: operation('Chạy job thủ công qua API v1', 'System', { parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }, { name: 'x-jobs-secret', in: 'header', required: true, schema: { type: 'string' } }] }) },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Success: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { oneOf: [{ type: 'object', additionalProperties: true }, { type: 'array', items: { type: 'object', additionalProperties: true } }, { type: 'string' }, { type: 'number' }, { type: 'boolean' }] },
          meta: { type: 'object', additionalProperties: true },
        },
      },
      RegisterRequest: { type: 'object', required: ['firstName', 'lastName', 'email', 'password'], properties: { firstName: { type: 'string' }, lastName: { type: 'string' }, email: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password' } } },
      LoginRequest: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password' } } },
      LoanRequest: { type: 'object', required: ['expectedPickupDate'], properties: { expectedPickupDate: { type: 'string', format: 'date-time' }, requestNote: { type: 'string', maxLength: 500 } } },
    },
  },
};
