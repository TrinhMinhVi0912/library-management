# Một thay đổi chạm đến đâu?

Khi đổi yêu cầu, rà các file sau để tài liệu và code luôn đồng bộ. **Luôn cập nhật thêm `context/digest.md` (mục tương ứng) và các file task bị ảnh hưởng trong `tasks/`**; dùng `/update-docs` để agent làm việc này.

| Loại thay đổi | 01 Nghiệp vụ | 02 DB | 03 Giao diện | 04 API | 05 Deploy | Code |
|---|:-:|:-:|:-:|:-:|:-:|---|
| Quy tắc nghiệp vụ (số ngày, mức phạt…) | §5, §7 | `settings` | trang `/about`, tooltip | `settings`, service | – | service, seed |
| Thêm/đổi trạng thái | §6 | enum field | màu badge, tab | service, endpoint | – | model, service, `StatusBadge` |
| Thêm field/collection | §7 liên quan | §4, §3 sơ đồ | form/bảng | endpoint, validator | – | model, validator, service, view |
| Thêm trang | §3 phân quyền | – | §4 bảng trang, §5 component | endpoint | – | route FE, view, service FE |
| Thêm endpoint | – | – | – | §3 | – | route, controller, service, validator |
| Thêm biến môi trường | – | – | – | §7 | §3 | `config/index.js`, `.env.example` |
| Thêm sự kiện Socket | §7.8 | §4.13 | §7 | §5.1 | – | `sockets`, `notify.service`, `socket.service.js`, store |
| Thêm cron job | §4 mục 5 | – | – | §5 | §7 | `jobs/`, endpoint `/jobs/:name` |
| Đổi quyền vai trò | §3 | – | route guard | middleware | – | `requireRole`, router meta |
| Quyết định mới | liên quan | liên quan | liên quan | liên quan | liên quan | `context/decisions.md` |
