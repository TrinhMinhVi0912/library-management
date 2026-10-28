# Quy tắc frontend (áp dụng khi làm việc trong `library-frontend/`)

> Gợi ý kích hoạt trong Antigravity: Glob `library-frontend/**`.

- `<script setup>`; props có kiểu; emit khai báo rõ. Component `PascalCase.vue`; service `x.service.js`; store `x.store.js` (`useXStore`).
- View/component không gọi axios; dùng `services/*` hoặc store. Socket chỉ khởi tạo ở `socket.service.js`, dữ liệu vào store.
- Mỗi trang có 3 trạng thái: skeleton, `EmptyState` (có hướng dẫn), lỗi (toast + nút thử lại).
- Giao diện: Bootstrap 5 + SCSS, tokens ở `context/digest.md` §D8 / docs/03 §2; không thêm màu mới; `StatusBadge` cho mọi trạng thái; mobile-first; bảng admin cuộn ngang; icon-only có `aria-label`.
- Hộp xác nhận cho: từ chối, xóa, khóa, miễn phạt. Debounce 300ms cho tìm kiếm. Bộ lọc lưu trên URL query.
- Route guard dùng `meta { requiresAuth, roles }`; ẩn nút chỉ để tiện dùng, backend mới là nơi chặn quyền.
- Access token trong Pinia (memory), không lưu localStorage; refresh bằng cookie (`withCredentials`).
- Ngày giờ hiển thị bằng `dayjs` múi giờ `Asia/Ho_Chi_Minh`; tiền định dạng `1.000đ`.
- Mỗi task frontend kết thúc bằng: `npm run lint` sạch + `npm run build` không lỗi + mô tả cách kiểm tra tay các trạng thái chính (tải/rỗng/lỗi/thành công, mobile).
- Không thêm thư viện ngoài danh sách (docs/01 §2) khi chưa ghi lý do vào `context/decisions.md`.
