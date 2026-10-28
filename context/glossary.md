# Thuật ngữ & đối chiếu tên cũ → mới

## Nghiệp vụ
| Thuật ngữ | Nghĩa |
|---|---|
| Độc giả (`reader`) | Người mượn sách, có tài khoản |
| Nhân viên (`staff`) | Xử lý nghiệp vụ tại quầy |
| Phiếu mượn (`loan`) | Một yêu cầu mượn gồm nhiều quyển (`items[]`) |
| Yêu cầu gia hạn (`renewalRequest`) | Đề nghị cộng thêm hạn trả cho **một quyển**, chờ nhân viên duyệt |
| Hạn nhận (`pickupDeadline`) | Hạn độc giả phải đến lấy sách sau khi được duyệt (mặc định 3 ngày) |
| Hạn trả (`dueDate`) | Hạn trả của từng quyển |
| Tồn kho (`availableCopies`) | Số quyển còn có thể mượn; `totalCopies` là tổng sở hữu |
| Đặt trước (`reservation`) | Xếp hàng chờ sách đang hết |
| Khóa mượn | Chặn gửi yêu cầu mới khi có phạt chưa trả hoặc sách quá hạn |
| Phạt tạm tính | Hiển thị cho sách đang quá hạn, chưa ghi vào `fines` đến lúc trả |

## Trạng thái
- Phiếu: `pending, approved, borrowing, overdue, returned, rejected, cancelled, expired`
- Item: `pending, borrowing, returned, lost`
- Phạt: `unpaid, paid, waived`
- Đặt trước: `waiting, available, fulfilled, expired, cancelled`
- Gia hạn: `pending, approved, rejected, cancelled`

## Schema cũ → mới
| Cũ | Mới |
|---|---|
| Docgia / NhanVien | `users` (role reader/staff/admin) |
| Sach | `books` |
| NhaXuatBan | `publishers` |
| TheoDoiMuonSach | `loans` (+ `items[]`) |
| MaDocGia, MSNV | `users.code` |
| SoQuyen | `books.totalCopies` + `availableCopies` |

## Mã nghiệp vụ
`DG000001` độc giả · `PM000001` phiếu mượn · `S000001` sách · `NXB001` nhà xuất bản (sinh từ `counters`).
