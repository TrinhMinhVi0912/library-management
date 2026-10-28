# AGENTS.md – Website Quản lý Mượn Sách (đọc đầu tiên, luôn bật)

Đồ án: Vue 3 + Express + MongoDB (Mongoose), Socket.IO, Cloudinary. Hai repo: `library-backend/`, `library-frontend/`, mở rộng từ cấu trúc mẫu contactbook (đơn giản). Trả lời, comment, thông báo UI bằng **tiếng Việt**; tên code bằng **tiếng Anh**.

## Bắt đầu phiên (tiết kiệm token)
1. Người dùng gõ `/resume` → làm đúng `.agent/workflows/resume.md`. **Không** tự đọc toàn bộ `docs/`.
2. Nguồn ngữ cảnh theo thứ tự: `context/SESSION.md` → file task đang làm trong `tasks/` → `context/digest.md` (chỉ mục cần) → `docs/*` (chỉ đúng mục task chỉ định).
3. Mỗi cuộc trò chuyện làm **một task** (đôi khi hai task nhỏ). Xong → `/done` rồi mở cuộc trò chuyện mới + `/resume`.

## Bản đồ
| Cần gì | Mở |
|---|---|
| Trạng thái, việc đang làm, bước tiếp | `context/SESSION.md` |
| Bảng task & trạng thái | `tasks/INDEX.md` (chi tiết: `tasks/backend/BE-xx.md`, `tasks/frontend/FE-xx.md`) |
| Tóm tắt nghiệp vụ/DB/API/UI | `context/digest.md` |
| Chi tiết gốc | `docs/01` nghiệp vụ · `02` DB · `03` giao diện · `04` API & cấu trúc · `05` deploy · `06` quy ước · `07` workflow · `08` kiểm thử |
| Quyết định, câu hỏi mở, thuật ngữ | `context/decisions.md`, `open-questions.md`, `glossary.md` |

## Quy tắc vàng
1. Làm đúng phạm vi task; không tự mở rộng, không refactor ngoài task.
2. Không đoán nghiệp vụ. Chưa rõ → ghi `context/open-questions.md`, hỏi người dùng.
3. BE: `route → middleware → controller (mỏng) → service → model`. FE: view không gọi axios trực tiếp.
4. Tồn kho cập nhật nguyên tử có điều kiện; transaction truyền `{ session }`; thông báo/emit Socket **sau commit**, chỉ qua `notify.service`.
5. Mọi input validate (joi); kiểm tra role và quyền sở hữu ở backend. Không trả `passwordHash`/token. Không commit `.env`. Không chạy `seed` trên production.
6. Cấu hình chỉ qua `app/config/index.js` / `import.meta.env`; không hard-code URL/khóa (để deploy dễ).
7. Đổi nghiệp vụ → cập nhật tài liệu (xem `context/traceability.md`) và ghi `context/decisions.md`.
8. Kết thúc task phải chạy `/done` (cập nhật SESSION.md + INDEX.md). Không tự `git commit` nếu chưa được yêu cầu; chỉ đề xuất nội dung commit.

## Lệnh (workflows)
`/resume` `/next` `/task <ID>` `/done` `/status` `/review` `/update-docs` `/deploy-check`
