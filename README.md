# Bộ tài liệu & ngữ cảnh – Website Quản lý Mượn Sách (cho Google Antigravity)

Gói gồm: tài liệu thiết kế, **76 task nhỏ** (38 backend + 38 frontend), quy tắc/workflow cho Antigravity, và cơ chế **lưu ngữ cảnh + `/resume`** để mở cuộc trò chuyện mới mà không tốn token nạp lại mọi thứ.

## Cấu trúc
```
AGENTS.md                 # quy tắc chung + bản đồ + giao thức (luôn bật)
GEMINI.md                 # ghi chú riêng Antigravity
.agent/
  rules/                  # 00-context-protocol, 10-backend, 20-frontend, 30-git-va-bao-mat
  workflows/              # /resume /next /task /done /status /review /update-docs /deploy-check
context/
  SESSION.md              # bàn giao giữa các cuộc trò chuyện (agent ghi đè qua /done)
  digest.md               # tóm tắt nghiệp vụ + DB + API + UI (đọc thay cho cả docs/)
  decisions.md  open-questions.md  glossary.md  traceability.md
tasks/
  INDEX.md                # bảng task + trạng thái ⬜ 🟦 ✅
  backend/BE-01..BE-38.md
  frontend/FE-01..FE-38.md
docs/                     # 01 nghiệp vụ · 02 DB · 03 giao diện · 04 API & cấu trúc · 05 deploy
                          # 06 quy ước · 07 workflow Antigravity · 08 kiểm thử
library-backend/AGENTS.md     # quy tắc riêng backend (repo code đặt tại đây)
library-frontend-user/AGENTS.md  # frontend khách/độc giả
library-frontend-admin/AGENTS.md # frontend nhân viên/quản trị
```

## Cài đặt
1. Giải nén vào một thư mục dự án, ví dụ `my-project/`. Backend và hai thư mục frontend được tách riêng; frontend user khởi tạo ở FE-01, frontend admin khởi tạo ở FE-19.
2. Mở **thư mục gốc** `my-project/` trong Antigravity.
3. Settings → Agent: bật *Load nested AGENTS.md files* (để agent nạp thêm AGENTS.md của backend và cả hai frontend).
4. Nếu gõ `/` không thấy các lệnh: kiểm tra phiên bản Antigravity đang dùng thư mục `.agent/` hay `.agents/` và đổi tên cho khớp (nội dung giữ nguyên). Các rule trong `.agent/rules/` có thể đặt chế độ kích hoạt trong giao diện: `00` và `30` luôn bật, `10` theo glob `library-backend/**`, `20` theo glob `library-frontend-*/**`.
5. Chuẩn bị tài khoản: MongoDB Atlas (cluster dev), Cloudinary (tùy chọn SMTP) – cần từ BE-02, BE-10.

## Cách dùng hằng ngày
```
Cuộc trò chuyện mới:   /next        (lần đầu)   hoặc   /resume   (các lần sau)
  → agent đọc SESSION.md + file task + đúng mục tài liệu → báo kế hoạch → làm
Làm xong:              /done        (kiểm tra, tick task, INDEX ✅, ghi đè SESSION.md, gợi ý commit)
Mở cuộc trò chuyện mới: /resume
```
Khác: `/task BE-12` (nhảy tới task), `/status`, `/review`, `/update-docs <thay đổi>`, `/deploy-check`.

Chi tiết quy trình, mẹo tiết kiệm token, định nghĩa hoàn thành: `docs/07-workflow-phat-trien.md`.

## Lộ trình
- **Backend** BE-01 → BE-38: khởi tạo → auth/upload → sách → mượn/trả/phạt → gia hạn/đánh giá/kệ → quản trị/job → diễn đàn/đặt trước → kiểm thử → deploy.
- **Frontend user** FE-01 → FE-18, FE-32, FE-33, FE-35; **frontend admin** FE-19 → FE-31, FE-34; FE-36 → FE-38 hoàn thiện/build/deploy cả hai app. Hai app có server/site riêng nhưng chia sẻ một backend API.
- Mốc kiểm tra: xem cuối `tasks/INDEX.md`.

## Việc bạn cần xác nhận (trước hoặc trong lúc làm)
`context/open-questions.md`: Mongoose hay driver thuần (đang giả định Mongoose), dịch vụ email, nơi deploy, kiểu thông báo chung.
