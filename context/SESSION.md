# SESSION – bàn giao giữa các cuộc trò chuyện

> File này **ghi đè** mỗi lần `/done` (không tích lũy lịch sử). ≤ 40 dòng. `/resume` đọc file này đầu tiên.

## Task vừa làm
- ID: BE-06 – Models nhóm 3: thông báo, diễn đàn, settings, audit, refresh token
- Trạng thái: ✅ xong

## Đã làm
- Xây dựng 9 models: `Notification`, `NotificationRead`, `ForumCategory`, `ForumThread`, `ForumPost`, `ForumReport`, `Setting`, `AuditLog`, `RefreshToken` (TTL index trên `expiresAt`).
- Cập nhật barrel export [app/models/index.js](file:///e:/githudRepo/library-management/library-backend/app/models/index.js) (đủ 22 models toàn dự án).
- Xây dựng [app/services/settings.service.js](file:///e:/githudRepo/library-management/library-backend/app/services/settings.service.js) (`getSettings()` tự khởi tạo giá trị mặc định, cache in-memory 1 phút, `invalidate`, `updateSettings`).
- Xây dựng [app/services/audit.service.js](file:///e:/githudRepo/library-management/library-backend/app/services/audit.service.js) (`log({actor, action, targetType, targetId, detail, ip})`).
- Viết bộ unit tests: [tests/models.group3.test.js](file:///e:/githudRepo/library-management/library-backend/tests/models.group3.test.js) (30/30 tests passed).

## File chính đã tạo/sửa
- `app/models/{notification,notificationRead,forumCategory,forumThread,forumPost,forumReport,setting,auditLog,refreshToken}.model.js`
- `app/models/index.js`
- `app/services/{settings.service.js,audit.service.js}`
- `tests/models.group3.test.js`
- `tasks/backend/BE-06.md`, `tasks/INDEX.md`

## Lệnh kiểm tra đã chạy
- `npm run lint`: pass 100% không cảnh báo/lỗi.
- `npx jest tests/models.group3.test.js`: 30/30 tests passed.

## Đang dở / bước tiếp theo
1. Tiến hành task BE-07 theo `tasks/backend/BE-07.md`: Middleware nền (auth, requireRole, validate, rateLimit).

## Quyết định mới / điểm cần nhớ
- `RefreshToken`: TTL index trên trường `expiresAt` với `{ expireAfterSeconds: 0 }`.
- `settings.service`: in-memory caching 1 phút để giảm tải truy vấn DB, tự tạo bản ghi mặc định khi hệ thống mới tinh.
- `audit.service`: tự bắt lỗi nội bộ để không bao giờ làm gián đoạn luồng nghiệp vụ chính.

## Task kế tiếp đề xuất
- BE-07 (Middleware nền: auth, requireRole, validate, rateLimit)
