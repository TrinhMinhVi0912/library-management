# 07 – Quy trình làm việc trong Google Antigravity

Cách phối hợp giữa bạn và agent trong Antigravity, thiết kế để **tiết kiệm token** và **tiếp tục được ở cuộc trò chuyện mới** bằng `/resume`.

## 1. Cơ chế lưu ngữ cảnh

| Lớp | File | Vai trò | Ai ghi |
|---|---|---|---|
| Luôn bật | `AGENTS.md`, `GEMINI.md`, `.agent/rules/*.md` | Quy tắc, bản đồ tài liệu, giao thức ngữ cảnh (nạp tự động mỗi phiên, giữ ngắn) | Bạn (hiếm khi đổi) |
| Bàn giao | `context/SESSION.md` | Trạng thái hiện tại: task đang làm, đã làm, bước tiếp theo, blocker (≤ 40 dòng, **ghi đè**) | Agent qua `/done` |
| Tiến độ | `tasks/INDEX.md` | Bảng 76 task + trạng thái ⬜/🟦/✅ | Agent qua `/next`, `/task`, `/done` |
| Nhiệm vụ | `tasks/backend/BE-xx.md`, `tasks/frontend/FE-xx.md` | Mục tiêu, phần cần đọc, các bước, file, tiêu chí xong | Bạn/agent |
| Tóm tắt | `context/digest.md` | Nghiệp vụ + DB + API + UI cô đọng (~4k token) để khỏi đọc 70KB docs | Agent qua `/update-docs` |
| Gốc | `docs/01–08` | Chi tiết đầy đủ, chỉ mở đúng mục | Bạn/agent |
| Lịch sử | `context/decisions.md`, `open-questions.md` | Quyết định và câu hỏi mở | Agent/bạn |

## 2. Vòng đời một cuộc trò chuyện

```
Cuộc trò chuyện mới ──► /resume  (hoặc /next nếu chưa có task đang làm)
        │                 đọc SESSION.md + file task + đúng mục tài liệu được chỉ định
        ▼
   Làm đúng một task (có thể hai task nhỏ)
        │
        ▼
   /done  → kiểm tra lint/test/build → tick task → INDEX ✅ → ghi đè SESSION.md → gợi ý commit
        │
        ▼
Đóng cuộc trò chuyện; mở cuộc trò chuyện mới ──► /resume
```
Lý do tiết kiệm token: mỗi lần chỉ nạp ~ AGENTS.md (~1k) + SESSION.md (~0,5k) + file task (~0,7k) + một vài mục digest/docs thay vì cả bộ tài liệu và lịch sử trò chuyện dài.

## 3. Lệnh (workflows) – gõ `/` trong khung chat của Antigravity

| Lệnh | Tác dụng |
|---|---|
| `/resume` | Cuộc trò chuyện mới: nạp ngữ cảnh tối thiểu và tiếp tục task đang làm |
| `/next` | Chọn task kế tiếp (BE trước, FE sau), đặt 🟦 và bắt đầu |
| `/task BE-12` | Chuyển sang task chỉ định |
| `/done` | Chốt task, cập nhật INDEX và SESSION.md, đề xuất commit |
| `/status` | Xem tiến độ tổng (số task xong, 3 task kế) |
| `/review` | Rà soát thay đổi hiện tại (chỉ nhận xét) |
| `/update-docs` | Đồng bộ docs + digest + task khi đổi yêu cầu |
| `/deploy-check` | Kiểm tra sẵn sàng deploy theo docs/05 |

Ghi chú: Antigravity đọc workflow trong `.agent/workflows/`. Nếu bản bạn đang dùng đặt tên thư mục là `.agents/` (có s), đổi tên `.agent/` → `.agents/` (rules, workflows giữ nguyên nội dung). Mỗi file rule/workflow ≤ 12.000 ký tự.

## 4. Cách làm việc hằng ngày

1. Mở Antigravity ở **thư mục gốc dự án** (chứa `library-backend/`, `library-frontend-user/`, `library-frontend-admin/`, `docs/`, `tasks/`…).
2. Cuộc trò chuyện mới → gõ `/resume`. (Lần đầu: `/next`.)
3. Đọc kế hoạch agent nêu; sửa nếu cần; để agent làm.
4. Tự chạy thử (hoặc yêu cầu agent chạy lint/test) và kiểm tra tay theo "Xong khi" trong file task.
5. `/done`. Commit theo gợi ý (tự thực hiện hoặc yêu cầu rõ agent commit).
6. Đóng cuộc trò chuyện; lặp lại.

Mẹo tiết kiệm thêm:
- Một task một cuộc trò chuyện; đừng kéo dài sang task khác khi ngữ cảnh đã nặng.
- Dùng chế độ Planning cho task có transaction/Socket/phân quyền; Fast cho giao diện đơn giản.
- Đừng yêu cầu agent "đọc hết docs"; hãy trỏ đúng mục (vd "digest §D6").
- Lỗi lặp lại: thêm một dòng vào `.agent/rules/10-backend.md` hoặc `20-frontend.md` để lần sau không mắc lại.

## 5. Thứ tự giai đoạn

| Giai đoạn | Task |
|---|---|
| Backend – khởi tạo & nền | BE-01…BE-06 |
| Backend – auth & upload | BE-07…BE-11 |
| Backend – sách & danh mục | BE-12…BE-15 |
| Backend – mượn/trả/phạt | BE-16…BE-23 |
| Backend – gia hạn, đánh giá, kệ | BE-24…BE-27 |
| Backend – quản trị, báo cáo, job | BE-28…BE-32 |
| Backend – diễn đàn, đặt trước | BE-33…BE-35 |
| Backend – kiểm thử, tài liệu, deploy | BE-36…BE-38 |
| Frontend – quản trị (khởi tạo app admin + các trang) | FE-19…FE-31, FE-34, FE-39 |
| Frontend – user (khởi tạo app + trang công khai/auth) | FE-01…FE-10 |
| Frontend – độc giả | FE-11…FE-18 |
| Frontend – diễn đàn, đặt trước của user | FE-32, FE-33, FE-35 |
| Frontend – hoàn thiện, deploy cả hai app | FE-36…FE-38 |

Thứ tự làm frontend là hoàn thành app admin trước: FE-19 khởi tạo admin app, tiếp theo FE-20…FE-31, FE-34 và FE-39. Sau đó mới khởi tạo user app ở FE-01 và làm FE-02…FE-18, FE-32, FE-33, FE-35. FE-36…FE-38 rà/build/deploy cả hai ứng dụng. Các task FE-19…FE-31, FE-34 và FE-39 thuộc `library-frontend-admin/`; FE-01…FE-18, FE-32, FE-33, FE-35 thuộc `library-frontend-user/`. Mỗi task ghi rõ app đích. Hai ứng dụng dùng chung API backend nhưng có router, auth state, package và deploy riêng.

Task của một app không được phụ thuộc vào việc hoàn thành UI của app còn lại nếu chỉ cần cùng API/backend; đặc biệt FE-19 và FE-34 chạy độc lập với các màn hình user. `/next` chọn các task admin trước task user theo thứ tự trong `tasks/INDEX.md`; không đổi ID hoặc tạo phụ thuộc chéo chỉ để điều khiển thứ tự. Quy tắc thống nhất UI bắt buộc theo `docs/03-thiet-ke-giao-dien.md` §2.1, `.agent/rules/20-frontend.md` và docs/06 §3.4.

## 6. Định nghĩa hoàn thành (Definition of Done)
- [ ] Chạy đúng luồng chính và các trường hợp lỗi chính (đủ/sai quyền, dữ liệu sai, hết tồn kho…)
- [ ] Có validate input và kiểm tra quyền ở backend
- [ ] Giao diện có trạng thái tải/rỗng/lỗi, hiển thị tốt trên mobile
- [ ] `npm run lint` sạch; FE `npm run build` thành công; không còn `console.log` thừa
- [ ] Có test cho nghiệp vụ quan trọng (BE-36 tổng hợp; từng task nghiệp vụ nên kiểm tra tay có lệnh cụ thể)
- [ ] Không hard-code URL/khóa; biến môi trường mới đã có trong `.env.example`
- [ ] Tài liệu liên quan đã cập nhật (digest + docs) nếu hành vi đổi
- [ ] `/done` đã ghi INDEX + SESSION

## 7. Khi đổi yêu cầu giữa chừng
1. Gõ `/update-docs <mô tả thay đổi>`: agent sửa docs, **digest**, các task bị ảnh hưởng, ghi `decisions.md`.
2. Nếu cần task mới: agent thêm dòng vào `tasks/INDEX.md` và tạo file task theo mẫu.
3. Tiếp tục bằng `/resume`.

## 8. Mẫu giao việc ngoài danh sách task
```
Việc: <mô tả>
Tham chiếu: digest §D6, docs/04 §4 (requestRenewal)
Phạm vi: backend | frontend | cả hai
Xong khi: <hành vi kiểm tra được>
```
Việc phát sinh nhỏ có thể làm ngay trong cuộc trò chuyện hiện tại rồi ghi một dòng "Ghi chú" ở INDEX.
