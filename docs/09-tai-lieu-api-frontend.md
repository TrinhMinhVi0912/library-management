# Tài liệu API dành cho frontend

Tài liệu này mô tả contract HTTP thực tế để xây frontend mà không cần dò controller. Backend hiện là nguồn chuẩn; khi route/validator thay đổi cần cập nhật tài liệu này. Base URL lấy từ cấu hình môi trường, ví dụ `https://<api-host>/api/v1`.

## 1. Quy ước chung

### Request

- JSON request gửi `Content-Type: application/json`.
- Request có xác thực gửi `Authorization: Bearer <accessToken>`.
- Các API có thể refresh/đăng xuất cần gửi cookie: browser Axios `withCredentials: true`; fetch dùng `credentials: 'include'`.
- Upload gửi `multipart/form-data`, field tên `file` (không tự gán boundary).
- Ngày giờ response là ISO 8601; ID là MongoDB ObjectId dạng chuỗi.

### Response

Phần lớn endpoint thành công trả:

```json
{ "success": true, "data": {}, "meta": {} }
```

`meta` chỉ xuất hiện khi endpoint phân trang/có metadata. Endpoint danh sách thường trả mảng trong `data` và metadata phân trang ngoài `data`:

```json
{
  "success": true,
  "data": [],
  "meta": { "page": 1, "limit": 12, "total": 0, "totalPages": 0 }
}
```

Lỗi chuẩn:

```json
{ "success": false, "message": "Dữ liệu không hợp lệ", "code": "ERROR_CODE", "errors": [{ "field": "email", "message": "..." }] }
```

`code`/`errors` có thể không có. Các status thường gặp: `400` request sai, `401` chưa đăng nhập/token sai, `403` sai quyền, `404` không tồn tại, `409` xung đột trạng thái/dữ liệu trùng, `422` Joi validation, `429` vượt rate-limit, `500` lỗi server. Không dựa vào nội dung stack trace ở production.

### Pagination và sắp xếp

Các list endpoint hỗ trợ `page`/`limit` nếu nêu bên dưới; page bắt đầu từ 1. Các list chính giới hạn limit tối đa 100. Sort thường dùng chuỗi field, ví dụ `-createdAt` giảm dần; giá trị cụ thể tùy schema từng nhóm. Dùng `meta` trả về làm nguồn phân trang.

### Auth và vai trò

Role: `reader`, `staff`, `admin`. Route admin yêu cầu Bearer; phần lớn cho staff/admin, một số chỉ admin (được ghi rõ). Không lưu refresh token từ JSON: refresh token được đặt trong cookie `httpOnly` tên `refreshToken`.

## 2. Auth và hồ sơ

| Method | Path | Quyền | Input | Response `data` |
|---|---|---|---|---|
| POST | `/auth/register` | Khách | `{firstName,lastName,email,password,birthDate?,gender?,address?,phone?}` | `{user,accessToken}`; HTTP 201 và cookie refresh |
| POST | `/auth/login` | Khách | `{email,password}` | `{user,accessToken}`; cookie refresh |
| POST | `/auth/refresh` | Cookie refresh hoặc body `{refreshToken}` | Body tùy chọn | `{user,accessToken}`; cookie được rotate |
| POST | `/auth/logout` | Khách/đã đăng nhập | Cookie refresh hoặc body `{refreshToken}` | `{message}`; xóa cookie |
| POST | `/auth/forgot-password` | Khách | `{email}` | `{message}`; gửi link email nếu mailer cấu hình |
| POST | `/auth/reset-password` | Khách có reset token | `{token,newPassword}` | `{message}` |
| GET | `/me` | Đăng nhập | — | Hồ sơ user hiện tại |
| PATCH | `/me` | Đăng nhập | `firstName,lastName,birthDate,gender,address,phone` (các trường cập nhật) | User đã cập nhật |
| PATCH | `/me/password` | Đăng nhập | Mật khẩu hiện tại và mật khẩu mới (xem validator `changePasswordSchema`) | `{message}` |
| POST | `/me/avatar` | Đăng nhập | multipart field `file` | User/ảnh avatar đã cập nhật |

Quy tắc mật khẩu đăng ký/reset: 8–100 ký tự, ít nhất một chữ cái và một chữ số. Giới tính: `male|female|other`. Email được trim/lowercase. Cookie refresh: `httpOnly`, path `/`, secure/sameSite theo cấu hình backend.

## 3. Sách và danh mục công khai

| Method | Path | Query/params | Response `data` |
|---|---|---|---|
| GET | `/books` | `q,category,author,publisher,year,available,sort,page,limit`; sort `relevance|new|popular|az` | Mảng sách active + `meta` |
| GET | `/books/suggest` | `q` | Mảng gợi ý (tối đa 8) |
| GET | `/books/home` | — | Object các nhóm sách trang chủ |
| GET | `/books/:idOrSlug` | ObjectId hoặc slug | Chi tiết sách active |
| GET | `/books/:id/related` | `limit` (1–20, mặc định 6) | Mảng sách liên quan |
| GET | `/books/:id/reviews` | `page,limit,sort` | Review + `meta` |
| GET | `/categories` | query phân trang theo validator catalog | Mảng thể loại + `meta` |
| GET | `/authors` | query tìm kiếm/phân trang theo validator catalog | Mảng tác giả + `meta` |
| GET | `/authors/:id` | ObjectId | Chi tiết tác giả |
| GET | `/publishers` | query tìm kiếm/phân trang theo validator catalog | Mảng NXB + `meta` |

Danh sách sách trả các trường model công khai như `_id,title,slug,isbn,authors,authorText,publisher,publishYear,price,totalCopies,availableCopies,categories,language,pages,description,cover,location,ratingAvg,ratingCount,borrowCount,status`. Dữ liệu populate có thể là object thay vì ID. Không giả định thứ tự field populate; UI nên xử lý null.

## 4. Giỏ, mượn, gia hạn, phạt và đặt trước

| Method | Path | Quyền | Input/query | Response `data` |
|---|---|---|---|---|
| GET | `/cart` | reader | — | Giỏ và các item đã populate thông tin sách/cờ khả dụng |
| POST | `/cart/items` | reader | `{bookId}` | Giỏ cập nhật |
| DELETE | `/cart/items/:bookId` | reader | — | Giỏ cập nhật/kết quả xóa |
| POST | `/loans` | reader | `{expectedPickupDate,requestNote?}` (alias `note?`); item được lấy từ giỏ | Phiếu mượn mới, HTTP 201 |
| GET | `/me/loans` | Đăng nhập | `status,page,limit,sort` | Mảng phiếu + `meta` |
| GET | `/me/loans/:id` | Đăng nhập | — | Chi tiết phiếu thuộc user |
| POST | `/me/loans/:id/cancel` | Đăng nhập | — | Phiếu sau hủy |
| POST | `/me/loans/:id/items/:bookId/renewals` | reader | `{reason?}` | Yêu cầu gia hạn mới, HTTP 201 |
| GET | `/me/renewals` | reader | `status,page,limit,sort` | Mảng yêu cầu + `meta` |
| POST | `/me/renewals/:id/cancel` | reader | — | Yêu cầu sau hủy |
| GET | `/me/fines` | Đăng nhập | `page,limit,status` theo fine query | Mảng khoản phạt + `meta` |
| POST | `/books/:bookId/reservations` | reader | — | Reservation mới (HTTP 201), gồm vị trí/hold info |
| GET | `/me/reservations` | reader | `status,page,limit` | Mảng reservation + `meta` |
| DELETE | `/me/reservations/:id` | reader | — | Reservation đã hủy |

Trạng thái loan: `pending,approved,borrowing,overdue,returned,rejected,cancelled,expired`. Item: `pending,borrowing,returned,lost`. Renewal: `pending,approved,rejected,cancelled`. Reservation: `waiting,available,fulfilled,expired,cancelled`. Hiển thị code `code` từ lỗi nghiệp vụ khi có; ví dụ renewal có thể trả `RENEW_OVERDUE`, `RENEW_LIMIT_REACHED`, `RENEW_RESERVED`, `RENEW_PENDING`. Loan/reservation/stock có thể bị xung đột do người khác thao tác; cần hiển thị lỗi server và tải lại dữ liệu.

## 5. Đánh giá, kệ sách và thông báo cá nhân

| Method | Path | Quyền | Input/query | Response `data` |
|---|---|---|---|---|
| GET | `/books/:id/reviews/can-review` | reader | — | `{canReview:boolean}` |
| POST | `/books/:id/reviews` | reader | `{rating,comment?}` | Review tạo/cập nhật; HTTP 201 khi tạo |
| GET | `/me/reviews` | reader | `page,limit` | Mảng review + `meta` |
| PATCH | `/reviews/:id` | Chủ review | `{rating?,comment?}` (ít nhất 1 field) | Review đã sửa |
| DELETE | `/reviews/:id` | Chủ review | — | Kết quả xóa |
| PATCH | `/admin/reviews/:id/visibility` | staff/admin | `{hidden:boolean}` | Review sau cập nhật |
| GET | `/me/shelves` | reader | — | Mảng kệ và sách trong kệ |
| POST | `/me/shelves` | reader | `{name}` | Kệ mới, HTTP 201 |
| PATCH | `/me/shelves/:id` | reader | `{name}` | Kệ sau đổi tên |
| DELETE | `/me/shelves/:id` | reader | — | Kết quả xóa |
| POST | `/me/shelves/:id/books/:bookId` | reader | — | Kệ sau thêm sách |
| DELETE | `/me/shelves/:id/books/:bookId` | reader | — | Kệ sau bỏ sách |
| GET | `/me/notifications` | Đăng nhập | `unread=true|false,page,limit` | `{notifications,meta}` hoặc danh sách theo controller |
| GET | `/me/notifications/unread-count` | Đăng nhập | — | Object chứa số chưa đọc |
| PATCH | `/me/notifications/read-all` | Đăng nhập | — | Kết quả đánh dấu đã đọc |
| PATCH | `/me/notifications/:id/read` | Đăng nhập | — | Thông báo đã đọc |

Mỗi reader có ba kệ mặc định (`want`, `reading`, `read`); không xóa/đổi tên được. Sách lặp trong cùng kệ trả `409`. Chỉ độc giả đã mượn sách mới được đánh giá; review bị ẩn không tính vào rating công khai.

## 6. Diễn đàn

| Method | Path | Quyền | Input/query | Response `data` |
|---|---|---|---|---|
| GET | `/forum/categories` | Công khai | — | Mảng chuyên mục |
| GET | `/forum/threads` | Công khai | `category,book,q,sort,page,limit`; sort `active|latest|popular|views` | Mảng chủ đề + `meta` |
| GET | `/forum/threads/:idOrSlug` | Công khai | ID/slug | Chủ đề chi tiết |
| GET | `/forum/threads/:id/posts` | Công khai | `page,limit,sort` | Mảng bài trả lời + `meta` |
| POST | `/forum/threads` | Đăng nhập | `{category,title,content,book?,tags?}` | Thread mới, HTTP 201 |
| PATCH | `/forum/threads/:id` | Chủ bài | `{title?,content?,...}` | Thread cập nhật |
| DELETE | `/forum/threads/:id` | Chủ bài hoặc staff/admin | — | Kết quả ẩn/xóa mềm |
| POST | `/forum/threads/:id/posts` | Đăng nhập | `{content,parent?}` | Post mới, HTTP 201 |
| PATCH | `/forum/posts/:id` | Chủ post | `{content}` | Post cập nhật |
| DELETE | `/forum/posts/:id` | Chủ post hoặc staff/admin | — | Kết quả ẩn/xóa mềm |
| POST | `/forum/threads/:id/like` | Đăng nhập | — | Trạng thái like và số lượt thích |
| POST | `/forum/posts/:id/like` | Đăng nhập | — | Trạng thái like và số lượt thích |
| POST | `/forum/reports` | Đăng nhập | `{targetType,targetId,reason}` | Report mới, HTTP 201 |

Giới hạn: thread title 150, nội dung 10.000, post 5.000 ký tự. Tạo thread/post có giới hạn 5 request/phút/IP. Nội dung được sanitize trước khi lưu.

## 7. API quản trị (staff/admin)

Toàn bộ `/admin/*` yêu cầu access token và role staff/admin trừ route ghi rõ admin-only.

### Dashboard, mượn, gia hạn, phạt

| Method | Path | Input/query | Response `data` |
|---|---|---|---|
| GET | `/admin/dashboard/summary` | — | Object số liệu tổng quan |
| GET | `/admin/dashboard/charts` | `range=7d|30d|12m` (mặc định 30d) | Object datasets biểu đồ |
| GET | `/admin/counters` | — | `{pendingLoans,pendingRenewals}` |
| GET | `/admin/loans` | `status,q,from,to,reader,page,limit,sort` | Mảng phiếu + `meta` |
| GET | `/admin/loans/:id` | — | Chi tiết phiếu |
| POST | `/admin/loans/:id/approve` | — | Phiếu đã duyệt |
| POST | `/admin/loans/:id/reject` | `{reason}` | Phiếu đã từ chối |
| POST | `/admin/loans/:id/handover` | — | Phiếu đã giao |
| POST | `/admin/loans/:id/return` | `{items:[{bookId|book,condition,fineAmount?}]}` | Kết quả trả/phạt |
| GET | `/admin/renewals` | `status,page,limit,sort` | Mảng yêu cầu + `meta` |
| POST | `/admin/renewals/:id/approve` | — | Renewal sau duyệt |
| POST | `/admin/renewals/:id/reject` | `{reason}` | Renewal sau từ chối |
| GET | `/admin/fines` | Filter/phân trang theo `adminFinesQuerySchema` | Mảng fine + `meta` |
| POST | `/admin/fines` | `createFineSchema` (reader/loan/book/type/amount/reason…) | Fine mới, HTTP 201 |
| PATCH | `/admin/fines/:id/pay` | — | Fine đã thu |
| PATCH | `/admin/fines/:id/waive` | **admin**; body reason theo schema | Fine đã miễn |
| POST | `/admin/fines/recalculate` | **admin**; `{reader?}` | Kết quả đối soát |
| GET | `/admin/reports/loans.xlsx` | `from?,to?` ISO date | Binary XLSX |
| GET | `/admin/reports/fines.xlsx` | `from?,to?` ISO date | Binary XLSX |

Condition trả sách: `good|damaged|lost`; `fineAmount` bắt buộc nếu `damaged`, không gửi nếu điều kiện khác. Từ chối mượn/gia hạn yêu cầu `reason`.

### Sách, danh mục, upload

| Method | Path | Quyền | Input/query | Response `data` |
|---|---|---|---|---|
| GET | `/admin/books` | staff/admin | `q,category,author,publisher,status=active|hidden|all,page,limit,sort` | Mảng sách + `meta` |
| POST | `/admin/books` | staff/admin | Book fields (title required; xem Book fields công khai) | Sách mới, HTTP 201 |
| GET | `/admin/books/:id` | staff/admin | — | Chi tiết sách |
| PUT/PATCH | `/admin/books/:id` | staff/admin | Một hoặc nhiều book fields | Sách cập nhật |
| DELETE | `/admin/books/:id` | staff/admin | — | Kết quả xóa/ẩn theo lịch sử |
| PATCH | `/admin/books/:id/status` | staff/admin | `{status:"active"|"hidden"}` | Sách sau đổi trạng thái |
| GET/POST | `/admin/authors` | staff/admin | list query / author fields | List + `meta` / tác giả tạo (201) |
| GET/PATCH/PUT/DELETE | `/admin/authors/:id` | staff/admin | detail / author fields | Tác giả hoặc kết quả thao tác |
| GET/POST | `/admin/categories` | staff/admin | list query / category fields | List + `meta` / category tạo (201) |
| GET/PATCH/PUT/DELETE | `/admin/categories/:id` | staff/admin | detail / category fields | Category hoặc kết quả thao tác |
| GET/POST | `/admin/publishers` | staff/admin | list query / publisher fields | List + `meta` / publisher tạo (201) |
| GET/PATCH/PUT/DELETE | `/admin/publishers/:id` | staff/admin | detail / publisher fields | Publisher hoặc kết quả thao tác |
| POST | `/admin/uploads` | staff/admin | multipart `file` (JPG/PNG/WEBP, tối đa 2 MB) | `{url,publicId}` |

Book fields: `title,slug,isbn,authors[],authorText,publisher,publishYear,price,totalCopies,categories[],language,pages,description,cover:{url,publicId},location,status`. Một số trường có default server-side; chỉ gửi những trường cần đặt/cập nhật. Author/category/publisher payload xem tên trường theo catalog validators: chủ yếu `name`, có thể `bio/photo`, `description/slug`, `address` tùy resource.

### Người dùng, settings, audit, thông báo

| Method | Path | Quyền | Input/query | Response `data` |
|---|---|---|---|---|
| GET | `/admin/users` | staff/admin | `q,role,status,page,limit,sort` | Mảng user + `meta` |
| POST | `/admin/users` | **admin** | `{email,password,firstName,lastName,...}` theo schema staff | User staff mới (201) |
| GET | `/admin/users/:id` | staff/admin | — | User chi tiết (không gồm passwordHash) |
| PATCH | `/admin/users/:id` | staff/admin | profile fields theo schema | User cập nhật |
| PATCH | `/admin/users/:id/lock` | staff/admin | `{reason}` | User đã khóa |
| PATCH | `/admin/users/:id/unlock` | staff/admin | — | User đã mở khóa |
| PATCH | `/admin/users/:id/role` | **admin** | `{role:"reader"|"staff"|"admin"}` theo quyền cho phép | User đã đổi role |
| POST | `/admin/users/:id/password-reset` | staff/admin | — | Kết quả yêu cầu gửi link reset qua email |
| GET/PUT | `/admin/settings` | **admin** | PUT các trường settings (gửi ít nhất 1) | Settings |
| GET | `/admin/audit-logs` | **admin** | `actor,action,from,to,page,limit,sort` | Mảng audit + `meta` |
| GET | `/admin/notifications` | staff/admin | `audience,type,q,page,limit,sort` | Mảng notification + `meta` |
| POST | `/admin/notifications` | staff/admin | `audience,type,title,content,recipient?,link?,expiresAt?` | Notification (201) |
| GET | `/admin/notifications/:id` | staff/admin | — | Notification detail |
| PATCH | `/admin/notifications/:id` | staff/admin | Một hoặc nhiều notification fields | Notification cập nhật |
| DELETE | `/admin/notifications/:id` | staff/admin | — | Kết quả xóa |

`audience`: `user|all|readers|staff`; `type`: `loan|renewal|due|overdue|fine|reservation|forum|system`. Với `audience=user`, `recipient` bắt buộc. Settings: `maxBooksPerLoan,loanDays,maxRenewals,renewDays,pickupHoldDays,reservationHoldDays,lateFeePerDay,lostBookFeeRate,lostBookProcessingFee`.

### Kiểm duyệt diễn đàn

| Method | Path | Quyền | Input/query | Response `data` |
|---|---|---|---|---|
| GET | `/admin/forum/reports` | staff/admin | `status,targetType,page,limit` | Mảng reports + `meta` |
| PATCH | `/admin/forum/reports/:id` | staff/admin | `{status:"resolved"|"dismissed"}` | Report cập nhật |
| POST | `/admin/forum/categories` | staff/admin | Category fields | Category mới (201) |
| GET/PATCH/DELETE | `/admin/forum/categories[/:id]` | staff/admin | list/detail/update/delete | Category hoặc kết quả thao tác |
| PATCH | `/admin/forum/threads/:id/pin` | staff/admin | `{pinned:boolean}` | Thread cập nhật |
| PATCH | `/admin/forum/threads/:id/lock` | staff/admin | `{locked:boolean}` | Thread cập nhật |
| PATCH | `/admin/forum/threads/:id/hide` | staff/admin | `{hidden:true}` | Thread cập nhật |
| PATCH | `/admin/forum/posts/:id/hide` | staff/admin | `{hidden:true}` | Post cập nhật |
| DELETE | `/admin/forum/posts/:id` | staff/admin | — | Kết quả ẩn/xóa mềm |

## 8. System endpoints và Socket.IO

| Method | Path | Quyền | Kết quả |
|---|---|---|---|
| GET | `/health` | Công khai | `{success:true,data:{status:"ok",uptime,timestamp}}` |
| GET | `/` | Công khai | Tên/version/documentation API |
| GET | `/api/v1` | Công khai | `{success:true,message:"Library Management API v1"}` |
| POST | `/jobs/:name` | Header `x-jobs-secret` | Job result; sai secret 401, tên không hợp lệ 404 |
| POST | `/api/v1/system/jobs/:name` | Header `x-jobs-secret` | Tương tự `/jobs/:name` |

Job names: `expirePickup,markOverdue,dueReminder,cleanup,expireReservation`. Không gọi job từ browser frontend; scheduler server-side mới là client phù hợp.

Socket.IO kết nối tại origin API, truyền access token handshake `auth: { token }`. Server tự đưa socket vào room user và role. Server → client events:

- `notification:new`: object notification.
- `staff:counters`: `{pendingLoans,pendingRenewals}`.
- `loan:updated`: `{loanId,status}`.
- `renewal:updated`: `{requestId,status}`.

Token hết hạn sẽ disconnect socket; client cần refresh access token rồi reconnect. Client không phát event nghiệp vụ lên server.

## 9. Ví dụ Axios

```js
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((request) => {
  const token = localStorage.getItem('accessToken'); // thay bằng auth store của ứng dụng
  if (token) request.headers.Authorization = `Bearer ${token}`;
  return request;
});

// Khi login/register thành công: lưu data.accessToken; refreshToken nằm trong HttpOnly cookie.
// Khi API trả 401: POST /auth/refresh (cookie tự gửi), cập nhật accessToken và retry có kiểm soát.
```

## 10. Lưu ý phạm vi/độ chính xác

Đường dẫn và schema được đối chiếu từ Express routes/controllers/validators hiện tại. Một vài response `data` là object model được service populate; field phụ thuộc populate/state tương ứng. Với CRUD tác giả/thể loại/NXB, phạt, reset password và một số model phức tạp, hãy dùng route validator/controller làm nguồn bổ sung nếu cần từng field chi tiết hơn. Không đưa token/secret/password vào log hoặc URL.

Tài liệu tham khảo backend hiện có: `docs/04-api-va-cau-truc-du-an.md`; tài liệu này ưu tiên contract dùng cho frontend và sẽ cập nhật cùng route code.
