# Quy tắc frontend (áp dụng cho cả hai app frontend)

> Gợi ý kích hoạt trong Antigravity: Glob `library-frontend-*/**`.

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

## Ràng buộc nhất quán giao diện
- `docs/03-thiet-ke-giao-dien.md` là nguồn chuẩn duy nhất về bố cục, design tokens và mẫu tương tác. Đọc đúng mục liên quan trước khi làm view.
- Dùng layout và component chung đã có trong chính app đích. Trang mới phải theo cùng kiểu tiêu đề/breadcrumb, toolbar, vùng nội dung, phân trang và trạng thái tải/rỗng/lỗi; không tự tạo một ngôn ngữ giao diện riêng.
- Không tự ý đổi font, màu, cỡ chữ, khoảng cách, bo góc, bóng, kiểu nút/badge, icon hoặc thư viện UI. Không thêm gradient, glassmorphism, animation trang trí, hero/metric cards hoặc hiệu ứng chỉ để “làm đẹp” nếu đặc tả không yêu cầu.
- Không sao chép component giữa hai app bằng import đường dẫn chéo; mỗi app sở hữu component của mình và phải bám cùng tokens/đặc tả.
- Nếu đặc tả thiếu một quyết định giao diện, chọn cách đơn giản nhất phù hợp component hiện có; nếu cần đổi quy ước chung thì cập nhật docs/03 và `context/decisions.md` trong cùng task.
- Khi hoàn thành view, đối chiếu với ít nhất một trang cùng nhóm trong app đó ở desktop và mobile; ghi nhận kiểm tra trong phần hoàn tất task.
