from docx import Document
from docx.shared import Inches, Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.section import WD_SECTION
from pathlib import Path

OUT = Path('docs/reports/bao-cao-du-an-quan-ly-muon-sach.docx')
doc = Document()
sec = doc.sections[0]
sec.page_width = Cm(21)
sec.page_height = Cm(29.7)
sec.top_margin = Cm(2.3)
sec.bottom_margin = Cm(2.1)
sec.left_margin = Cm(3.0)
sec.right_margin = Cm(2.0)
sec.header_distance = Cm(1.1)
sec.footer_distance = Cm(1.1)

# Consistent Vietnamese academic typography.
def set_font(style, size=12, bold=False):
    style.font.name = 'Times New Roman'
    style.font.size = Pt(size)
    style.font.bold = bold
    style.font.color.rgb = RGBColor(0, 0, 0)
    style._element.rPr.rFonts.set(qn('w:ascii'), 'Times New Roman')
    style._element.rPr.rFonts.set(qn('w:hAnsi'), 'Times New Roman')
    style._element.rPr.rFonts.set(qn('w:eastAsia'), 'Times New Roman')

normal = doc.styles['Normal']
set_font(normal, 12)
normal.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
normal.paragraph_format.line_spacing = 1.35
normal.paragraph_format.space_after = Pt(5)
normal.paragraph_format.first_line_indent = Cm(0.8)
for name, size, before, after in [('Heading 1', 15, 16, 10), ('Heading 2', 13, 12, 6), ('Heading 3', 12, 9, 4)]:
    st = doc.styles[name]
    set_font(st, size, True)
    st.paragraph_format.keep_with_next = True
    st.paragraph_format.space_before = Pt(before)
    st.paragraph_format.space_after = Pt(after)
    st.paragraph_format.first_line_indent = Cm(0)
    st.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT

# Header and page number footer.
header = sec.header.paragraphs[0]
header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
header.paragraph_format.space_after = Pt(0)
r = header.add_run('BÁO CÁO DỰ ÁN QUẢN LÝ MƯỢN SÁCH')
r.italic = True
r.font.size = Pt(9)
r.font.name = 'Times New Roman'
footer = sec.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
footer.paragraph_format.first_line_indent = Cm(0)
footer.add_run('Trang ')
fld = OxmlElement('w:fldSimple')
fld.set(qn('w:instr'), 'PAGE')
footer._p.append(fld)

# Helpers.
def center(text, size=12, bold=False, italic=False, before=0, after=6):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.space_before = Pt(before)
    p.paragraph_format.space_after = Pt(after)
    run = p.add_run(text)
    run.bold = bold
    run.italic = italic
    run.font.name = 'Times New Roman'
    run.font.size = Pt(size)
    return p

def para(text, bold_prefix=None):
    p = doc.add_paragraph()
    if bold_prefix and text.startswith(bold_prefix):
        a = p.add_run(bold_prefix)
        a.bold = True
        p.add_run(text[len(bold_prefix):])
    else:
        p.add_run(text)
    return p

def bullet(text, level=0):
    p = doc.add_paragraph(style='List Bullet' if level == 0 else 'List Bullet 2')
    p.paragraph_format.left_indent = Cm(0.8 + level * 0.45)
    p.paragraph_format.first_line_indent = Cm(-0.35)
    p.paragraph_format.space_after = Pt(3)
    p.add_run(text)
    return p

def numbered(text):
    p = doc.add_paragraph(style='List Number')
    p.paragraph_format.left_indent = Cm(0.8)
    p.paragraph_format.first_line_indent = Cm(-0.35)
    p.paragraph_format.space_after = Pt(3)
    p.add_run(text)
    return p

def heading(text, level=1, centered=False):
    p = doc.add_paragraph(style=f'Heading {level}')
    p.add_run(text)
    if centered:
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    return p

def shade(cell, fill='E9EFF7'):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:fill'), fill)
    tcPr.append(shd)

def set_cell_text(cell, text, bold=False, size=10):
    cell.text = ''
    p = cell.paragraphs[0]
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.space_after = Pt(1)
    p.paragraph_format.line_spacing = 1.05
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = p.add_run(str(text))
    run.font.name = 'Times New Roman'
    run.font.size = Pt(size)
    run.bold = bold
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER

def table(headers, rows, widths=None):
    t = doc.add_table(rows=1, cols=len(headers))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.style = 'Table Grid'
    t.autofit = False
    for i, h in enumerate(headers):
        set_cell_text(t.rows[0].cells[i], h, True, 10)
        shade(t.rows[0].cells[i])
    for row in rows:
        cells = t.add_row().cells
        for i, val in enumerate(row):
            set_cell_text(cells[i], val, False, 10)
    if widths:
        for row in t.rows:
            for i, width in enumerate(widths):
                row.cells[i].width = Cm(width)
    doc.add_paragraph().paragraph_format.space_after = Pt(1)
    return t

# Cover page.
center('[TÊN BỘ / SỞ / ĐƠN VỊ CHỦ QUẢN]', 13, True, after=2)
center('[TÊN TRƯỜNG / KHOA]', 13, True, after=20)
center('[LOGO TRƯỜNG]', 12, True, after=24)
center('BÁO CÁO PHÁT TRIỂN ỨNG DỤNG WEB', 17, True, after=25)
center('ĐỀ TÀI', 13, True, after=8)
center('XÂY DỰNG WEBSITE QUẢN LÝ MƯỢN SÁCH TRỰC TUYẾN', 18, True, after=26)
center('Sinh viên thực hiện: [HỌ VÀ TÊN]', 12, True, after=3)
center('Mã số sinh viên: [MÃ SỐ]', 12, True, after=3)
center('Lớp / Khóa: [LỚP / KHÓA]', 12, True, after=15)
center('Giảng viên hướng dẫn: [HỌ TÊN GIẢNG VIÊN]', 12, True, after=50)
center('[ĐỊA DANH], 2026', 12, True, after=0)
doc.add_page_break()

# Acknowledgements.
center('LỜI CẢM ƠN', 15, True, after=18)
para('Trong quá trình thực hiện đề tài “Xây dựng website quản lý mượn sách trực tuyến”, em đã vận dụng kiến thức về phân tích nghiệp vụ, thiết kế cơ sở dữ liệu, lập trình web và kiểm thử phần mềm để xây dựng một hệ thống phục vụ hoạt động tra cứu, mượn trả và quản trị thư viện.')
para('Em xin chân thành cảm ơn quý thầy cô và giảng viên hướng dẫn đã truyền đạt kiến thức, góp ý và hỗ trợ em trong quá trình học tập, thực hiện đề tài. Em cũng cảm ơn gia đình, bạn bè và những người đã đóng góp ý kiến giúp em hoàn thiện sản phẩm.')
para('Do thời gian và kinh nghiệm còn hạn chế, báo cáo và hệ thống có thể vẫn còn những điểm chưa hoàn thiện. Em mong nhận được ý kiến đóng góp để tiếp tục cải tiến đề tài.')
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
p.paragraph_format.first_line_indent = Cm(0)
p.add_run('[ĐỊA DANH], ngày [NGÀY] tháng [THÁNG] năm 2026\nSinh viên thực hiện\n\n[HỌ VÀ TÊN]').bold = True
doc.add_page_break()

# Static contents for the first two drafted chapters.
center('MỤC LỤC', 15, True, after=16)
contents = [
 ('CHƯƠNG 1 GIỚI THIỆU', 0),
 ('1.1. Đặt vấn đề', 1), ('1.2. Mục tiêu đề tài', 1), ('1.2.1. Mục tiêu tổng quát', 2), ('1.2.2. Mục tiêu cụ thể', 2),
 ('1.3. Đối tượng và phạm vi', 1), ('1.3.1. Đối tượng sử dụng', 2), ('1.3.2. Phạm vi thực hiện', 2), ('1.3.3. Ngoài phạm vi', 2),
 ('1.4. Phương pháp thực hiện', 1), ('1.5. Kết cấu báo cáo', 1),
 ('CHƯƠNG 2 ĐẶC TẢ YÊU CẦU', 0), ('2.1. Mô tả bài toán', 1), ('2.2. Yêu cầu chức năng', 1), ('2.3. Yêu cầu phi chức năng', 1),
 ('2.4. Ràng buộc và giả định', 1), ('2.5. Tiêu chí nghiệm thu', 1), ('2.6. Công nghệ sử dụng', 1), ('2.7. Kiến trúc tổng thể', 1),
]
for text, level in contents:
    p = doc.add_paragraph()
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.left_indent = Cm(0.5 * level)
    p.paragraph_format.space_after = Pt(4)
    p.add_run(text).bold = level == 0
p = doc.add_paragraph()
p.paragraph_format.first_line_indent = Cm(0)
p.paragraph_format.space_before = Pt(8)
r = p.add_run('Mục lục sẽ được cập nhật khi hoàn thiện các chương tiếp theo.')
r.italic = True
r.font.size = Pt(10)
doc.add_page_break()

# Chapter 1.
heading('CHƯƠNG 1 GIỚI THIỆU', 1, True)
heading('1.1. Đặt vấn đề', 2)
para('Thư viện cần quản lý đồng thời danh mục sách, số lượng bản có thể cho mượn, tài khoản độc giả, phiếu mượn, lịch trả và các khoản phạt. Khi các quy trình này được xử lý rời rạc hoặc phụ thuộc nhiều vào ghi chép thủ công, việc tra cứu tình trạng sách và theo dõi các bước của một lượt mượn trở nên mất thời gian. Độc giả cũng khó tự xem lịch sử giao dịch, hạn trả hoặc tình trạng yêu cầu của mình nếu không liên hệ trực tiếp với nhân viên.')
para('Đề tài xây dựng một website quản lý mượn sách trực tuyến nhằm kết nối hai nhóm thao tác chính: độc giả tra cứu và gửi yêu cầu mượn; nhân viên thư viện xử lý yêu cầu, giao nhận sách và cập nhật tình trạng trả. Hệ thống đồng thời hỗ trợ quản lý dữ liệu sách, người dùng và các nghiệp vụ liên quan, giúp thông tin được lưu tập trung và trạng thái được cập nhật nhất quán.')
para('Sản phẩm được tổ chức thành ba ứng dụng độc lập: frontend dành cho độc giả, frontend dành cho nhân viên và quản trị viên, cùng backend cung cấp API và dịch vụ thời gian thực. Cách tách này cho phép hai nhóm người dùng có giao diện và quy trình riêng nhưng vẫn làm việc trên cùng một hệ thống dữ liệu.')

heading('1.2. Mục tiêu đề tài', 2)
heading('1.2.1. Mục tiêu tổng quát', 3)
para('Phân tích, thiết kế và xây dựng một hệ thống web hỗ trợ các hoạt động cốt lõi của thư viện: tìm kiếm sách, đăng ký mượn, duyệt và giao sách, theo dõi hạn trả, tiếp nhận sách trả, quản lý phạt và cung cấp công cụ quản trị cho nhân viên thư viện.')
heading('1.2.2. Mục tiêu cụ thể', 3)
for item in [
 'Xây dựng cổng độc giả cho phép tìm kiếm, lọc và xem chi tiết sách; quản lý giỏ mượn, gửi yêu cầu, theo dõi lịch sử và yêu cầu gia hạn.',
 'Xây dựng cổng quản trị riêng cho nhân viên và quản trị viên để xử lý phiếu mượn, gia hạn, giao nhận sách, phạt, danh mục và tài khoản theo quyền được cấp.',
 'Quản lý tồn kho và các chuyển trạng thái nghiệp vụ có kiểm tra điều kiện nhằm tránh cấp phát vượt số lượng sách khả dụng.',
 'Bổ sung các chức năng hỗ trợ gồm đặt trước theo hàng chờ, đánh giá sách, kệ sách cá nhân, thông báo và diễn đàn trao đổi.',
 'Áp dụng xác thực, phân quyền, kiểm tra dữ liệu đầu vào, ghi nhận hoạt động quản trị và cấu hình ứng dụng bằng biến môi trường.',
 'Tổ chức hệ thống theo các tầng rõ ràng để thuận tiện bảo trì, kiểm thử và triển khai độc lập các ứng dụng frontend.'
]: bullet(item)

heading('1.3. Đối tượng và phạm vi', 2)
heading('1.3.1. Đối tượng sử dụng', 3)
table(['Vai trò', 'Mô tả'], [
 ('Khách', 'Tra cứu và xem thông tin sách, đọc nội dung công khai của diễn đàn, đăng ký hoặc đăng nhập.'),
 ('Độc giả (reader)', 'Quản lý hồ sơ, gửi yêu cầu mượn và gia hạn, đặt trước sách, xem lịch sử và phạt, tạo đánh giá, quản lý kệ sách, thông báo và bài đăng diễn đàn.'),
 ('Nhân viên (staff)', 'Xử lý các yêu cầu mượn và gia hạn, xác nhận giao trả, ghi nhận/thu phạt, quản lý sách và danh mục, gửi thông báo, kiểm duyệt diễn đàn và quản lý độc giả.'),
 ('Quản trị viên (admin)', 'Thực hiện các nghiệp vụ của nhân viên và quản lý nhân sự, vai trò, cài đặt hệ thống, nhật ký kiểm toán cùng các thao tác chỉ dành cho admin.')
], [3.2, 12.8])

heading('1.3.2. Phạm vi thực hiện', 3)
para('Phạm vi đề tài tập trung vào quy trình thư viện trực tuyến trên nền tảng web, gồm tra cứu sách, quản lý danh mục, xác thực người dùng, mượn trả tại quầy, gia hạn có phê duyệt, đặt trước khi hết sách, xử lý phạt, thông báo và quản trị. Các giao dịch ảnh hưởng đồng thời đến phiếu mượn và tồn kho sử dụng MongoDB transaction; ảnh bìa và ảnh hồ sơ được lưu trên Cloudinary.')
para('Backend được xây dựng để chạy trong môi trường phát triển với MongoDB local replica set và có thể kết nối MongoDB Atlas khi triển khai công khai. Hai frontend được chuẩn bị theo hướng triển khai thành hai website riêng; backend được triển khai độc lập và cho phép cấu hình origin qua biến môi trường.')

heading('1.3.3. Ngoài phạm vi', 3)
for item in [
 'Thanh toán tiền phạt trực tuyến; khoản phạt được nhân viên xác nhận thu tại quầy.',
 'Tích hợp thiết bị RFID, máy quét mã hoặc kiosk tự phục vụ tại thư viện.',
 'Ứng dụng di động native cho Android hoặc iOS.',
 'Đồng bộ dữ liệu với phần mềm thư viện bên thứ ba hoặc hệ thống định danh của trường.',
 'Hệ thống gợi ý sách bằng mô hình học máy.'
]: bullet(item)

heading('1.4. Phương pháp thực hiện', 2)
para('Đề tài được triển khai theo các bước phân tích nghiệp vụ, mô hình hóa dữ liệu và API, xây dựng backend, phát triển lần lượt hai frontend, sau đó kiểm tra theo từng chức năng và luồng nghiệp vụ. Các quy tắc như giới hạn số sách, thời hạn mượn, gia hạn và mức phạt được đưa vào cấu hình để có thể điều chỉnh mà không thay đổi luồng xử lý chính.')
for item in [
 'Phân tích quy trình mượn, trả, gia hạn, đặt trước và phân quyền giữa khách, độc giả, nhân viên, quản trị viên.',
 'Thiết kế mô hình dữ liệu MongoDB, hợp đồng API REST và cấu trúc frontend/backend theo tầng.',
 'Triển khai chức năng theo từng nhóm nghiệp vụ, tích hợp thông báo qua Socket.IO và lưu ảnh qua Cloudinary.',
 'Kiểm tra bằng kiểm thử tự động, kiểm thử API và kiểm thử giao diện theo vai trò; ghi nhận các hạng mục cần xác minh trên môi trường triển khai.'
]: numbered(item)

heading('1.5. Kết cấu báo cáo', 2)
para('Báo cáo được xây dựng theo năm chương. Chương 1 trình bày lý do, mục tiêu, đối tượng và phạm vi đề tài. Chương 2 đặc tả bài toán, yêu cầu chức năng, yêu cầu phi chức năng, ràng buộc và công nghệ sử dụng. Chương 3 sẽ trình bày sơ đồ nghiệp vụ, kiến trúc và mô hình dữ liệu. Chương 4 mô tả giao diện và cách hiện thực các luồng chính. Chương 5 tổng hợp kết quả kiểm thử, đánh giá, hạn chế và hướng phát triển.')

# Chapter 2.
doc.add_page_break()
heading('CHƯƠNG 2 ĐẶC TẢ YÊU CẦU', 1, True)
heading('2.1. Mô tả bài toán', 2)
para('Hệ thống cần cung cấp một nguồn dữ liệu thống nhất cho sách, độc giả và giao dịch mượn trả, đồng thời phân tách thao tác theo vai trò. Độc giả chọn các đầu sách, gửi yêu cầu mượn và theo dõi quá trình xử lý. Nhân viên duyệt yêu cầu, giữ số lượng sách tương ứng, xác nhận giao sách khi độc giả đến nhận, sau đó ghi nhận việc trả và tình trạng của từng quyển. Quản trị viên cấu hình chính sách và có quyền thực hiện các thao tác quản trị cao hơn.')
para('Bài toán còn yêu cầu xử lý các tình huống ngoại lệ: tài khoản bị khóa hoặc đang nợ phạt, sách hết tồn, yêu cầu đến nhận quá hạn, gia hạn không đủ điều kiện, sách trả trễ/hỏng/mất và có người đặt trước đang chờ. Mỗi thao tác phải kiểm tra trạng thái hiện tại trước khi cập nhật dữ liệu để tránh thay đổi không hợp lệ.')

heading('2.2. Yêu cầu chức năng', 2)
para('Các yêu cầu chức năng được nhóm theo vai trò. Những quy tắc chi tiết như số lượng tối đa, thời hạn mượn và mức phạt lấy từ cấu hình hệ thống thay vì cố định trong giao diện.')
heading('2.2.1. Chức năng dành cho khách và độc giả', 3)
table(['Mã', 'Yêu cầu'], [
 ('FR-01', 'Khách có thể duyệt, tìm kiếm, lọc và xem thông tin chi tiết sách cùng các chuyên mục công khai của diễn đàn.'),
 ('FR-02', 'Người dùng có thể đăng ký và đăng nhập bằng thông tin tài khoản; độc giả có thể xác thực bằng Google theo cấu hình OAuth.'),
 ('FR-03', 'Độc giả có thể cập nhật hồ sơ và mật khẩu; quy trình khôi phục mật khẩu sử dụng mã một lần được nhân viên cấp sau khi xác minh trực tiếp.'),
 ('FR-04', 'Độc giả có thể đưa sách còn khả dụng vào giỏ và gửi yêu cầu mượn với ngày dự kiến đến nhận.'),
 ('FR-05', 'Độc giả có thể xem trạng thái phiếu, lịch sử mượn và thông tin hạn trả; có thể hủy yêu cầu khi nghiệp vụ cho phép.'),
 ('FR-06', 'Độc giả có thể gửi yêu cầu gia hạn cho từng quyển đang mượn khi đáp ứng chính sách và theo dõi quyết định của nhân viên.'),
 ('FR-07', 'Độc giả có thể đăng ký hàng chờ đặt trước khi sách hết; hệ thống thông báo khi sách được giữ cho lượt của mình.'),
 ('FR-08', 'Độc giả có thể xem khoản phạt; thanh toán được ghi nhận tại quầy bởi nhân viên.'),
 ('FR-09', 'Độc giả có thể tạo, sửa và xóa đánh giá nếu đã từng nhận sách; nhân viên có thể ẩn nội dung vi phạm.'),
 ('FR-10', 'Độc giả có thể quản lý các kệ sách cá nhân và danh sách sách trong từng kệ.'),
 ('FR-11', 'Độc giả có thể nhận thông báo, đánh dấu đã đọc, tạo chủ đề, trả lời, thích và báo cáo nội dung diễn đàn.'),
 ('FR-12', 'Độc giả có thể xem và quản lý chủ đề do chính mình tạo; quyền sở hữu được kiểm tra ở backend.')
], [2.0, 14.0])

heading('2.2.2. Chức năng dành cho nhân viên và quản trị viên', 3)
table(['Mã', 'Yêu cầu'], [
 ('FR-13', 'Nhân viên có thể duyệt hoặc từ chối yêu cầu mượn; khi từ chối phải ghi lý do.'),
 ('FR-14', 'Nhân viên có thể xác nhận giao sách và tiếp nhận từng quyển trả, gồm ghi nhận tình trạng tốt, hỏng hoặc mất.'),
 ('FR-15', 'Nhân viên có thể duyệt hoặc từ chối gia hạn; quyết định từ chối phải có lý do.'),
 ('FR-16', 'Nhân viên có thể quản lý sách, tác giả, thể loại, nhà xuất bản và ảnh liên quan.'),
 ('FR-17', 'Nhân viên có thể lập khoản phạt thủ công, xác nhận đã thu tại quầy và quản lý độc giả trong phạm vi quyền.'),
 ('FR-18', 'Nhân viên có thể quản lý thông báo và kiểm duyệt chủ đề, phản hồi, báo cáo diễn đàn.'),
 ('FR-19', 'Nhân viên và admin có dashboard theo dõi số liệu, biểu đồ và hàng đợi nghiệp vụ; có thể xuất báo cáo theo quyền.'),
 ('FR-20', 'Admin có thể quản lý nhân viên, vai trò, cài đặt chính sách, nhật ký kiểm toán và các chức năng chỉ dành cho admin.')
], [2.0, 14.0])

heading('2.3. Yêu cầu phi chức năng', 2)
table(['Mã', 'Nhóm', 'Yêu cầu'], [
 ('NFR-01', 'Bảo mật', 'Xác thực bằng access token và refresh cookie httpOnly; kiểm tra vai trò và quyền sở hữu ở backend; không trả mật khẩu hoặc token trong phản hồi.'),
 ('NFR-02', 'Bảo mật', 'Kiểm tra dữ liệu đầu vào bằng Joi, làm sạch nội dung phù hợp, giới hạn tần suất truy cập và cấu hình CORS theo danh sách origin.'),
 ('NFR-03', 'Toàn vẹn dữ liệu', 'Cập nhật tồn kho bằng điều kiện nguyên tử; các nghiệp vụ nhiều bước dùng MongoDB transaction để rollback khi một bước thất bại.'),
 ('NFR-04', 'Thời gian thực', 'Thông báo được lưu trong cơ sở dữ liệu; Socket.IO dùng để đẩy sự kiện tức thời sau khi thay đổi đã commit.'),
 ('NFR-05', 'Khả năng bảo trì', 'Backend phân tầng route, middleware, controller, service và model; frontend gọi API thông qua service, hai ứng dụng tách biệt.'),
 ('NFR-06', 'Khả năng triển khai', 'URL, khóa và cấu hình môi trường được cấp qua biến môi trường; frontend có thể build/deploy độc lập với backend.'),
 ('NFR-07', 'Trải nghiệm sử dụng', 'Giao diện tiếng Việt, có trạng thái tải/rỗng/lỗi, hỗ trợ bố cục phù hợp màn hình nhỏ và định dạng ngày giờ theo múi giờ Việt Nam.'),
 ('NFR-08', 'Hiệu năng truy vấn', 'Danh sách có phân trang; các truy vấn chính có index phù hợp và dùng populate/select để giới hạn dữ liệu trả về.')
], [2.0, 2.7, 11.3])

heading('2.4. Ràng buộc và giả định', 2)
for item in [
 'Ứng dụng gồm hai frontend web riêng dành cho độc giả và nhân viên/quản trị viên, dùng chung backend API.',
 'Cơ sở dữ liệu sử dụng MongoDB và Mongoose; môi trường chạy giao dịch phải hỗ trợ replica set, gồm MongoDB Atlas hoặc MongoDB local replica set.',
 'Ảnh được lưu trữ qua Cloudinary; cơ sở dữ liệu chỉ giữ URL và public ID cần thiết.',
 'Chính sách mặc định gồm tối đa 5 sách, thời hạn mượn 14 ngày, gia hạn tối đa 2 lần (mỗi lần 7 ngày), hạn nhận sau duyệt 3 ngày và phạt trễ 2.000 đồng/ngày/quyển; admin có thể cấu hình một số ngưỡng.',
 'Tiền phạt được thanh toán tại quầy. Đề tài không tích hợp cổng thanh toán trực tuyến.',
 'Frontend production cần HTTPS để sử dụng cookie bảo mật và các dịch vụ xác thực bên ngoài.'
]: bullet(item)

heading('2.5. Tiêu chí nghiệm thu', 2)
table(['Mã', 'Tiêu chí'], [
 ('AC-01', 'Khách, độc giả, staff và admin chỉ sử dụng được chức năng phù hợp với vai trò; backend từ chối truy cập sai quyền.'),
 ('AC-02', 'Luồng mượn thể hiện đúng các bước gửi yêu cầu, duyệt, nhận sách và trả; tồn kho không âm và không vượt tổng số bản.'),
 ('AC-03', 'Gia hạn chỉ được chấp thuận khi thỏa điều kiện; ngày trả và số lần gia hạn được cập nhật đúng chính sách.'),
 ('AC-04', 'Trả trễ, hư hỏng hoặc mất sách tạo khoản phạt theo quy tắc; tiền thu được xác nhận bởi nhân viên tại quầy.'),
 ('AC-05', 'Đặt trước tuân theo thứ tự hàng chờ; bản được giữ không bị cấp cho yêu cầu khác và được chuyển tiếp khi hết hạn/hủy.'),
 ('AC-06', 'Thông báo có thể xem lại qua API và sự kiện Socket.IO được phát sau khi dữ liệu đã lưu thành công.'),
 ('AC-07', 'Dữ liệu đầu vào không hợp lệ bị từ chối; nội dung không được phép thực thi; phản hồi không chứa trường nhạy cảm.'),
 ('AC-08', 'Hai frontend có thể build riêng và tải lại đường dẫn con trên môi trường static hosting; các URL backend được cấu hình bằng biến môi trường.')
], [2.0, 14.0])

heading('2.6. Công nghệ sử dụng', 2)
table(['Tầng', 'Công nghệ', 'Vai trò trong hệ thống'], [
 ('Frontend', 'Vue 3, Vite, Bootstrap 5, SCSS', 'Xây dựng hai giao diện web độc lập cho độc giả và quản trị.'),
 ('Quản lý trạng thái và định tuyến', 'Pinia, Vue Router', 'Lưu trạng thái phiên trên client và điều hướng theo vai trò.'),
 ('Giao tiếp API', 'Axios, REST API', 'Trao đổi dữ liệu với backend; gửi cookie refresh khi cần.'),
 ('Backend', 'Node.js, Express.js', 'Cung cấp API, xác thực, phân quyền và điều phối nghiệp vụ.'),
 ('Cơ sở dữ liệu', 'MongoDB, Mongoose', 'Lưu người dùng, sách, giao dịch, thông báo và dữ liệu diễn đàn.'),
 ('Thời gian thực', 'Socket.IO', 'Đẩy thông báo và số đếm cần xử lý tới client đang kết nối.'),
 ('Lưu trữ ảnh', 'Cloudinary, Multer', 'Nhận ảnh qua backend và lưu trữ ảnh trên dịch vụ đám mây.'),
 ('Kiểm tra và an toàn', 'Joi, Helmet, express-rate-limit, express-mongo-sanitize', 'Kiểm tra dữ liệu và áp dụng các lớp bảo vệ cho API.'),
 ('Kiểm thử', 'Jest, Supertest', 'Kiểm tra service và các endpoint HTTP.'),
 ('Triển khai', 'Vercel, Render, MongoDB Atlas', 'Mô hình triển khai dự kiến: hai frontend static, backend API và cơ sở dữ liệu dùng chung.')
], [3.1, 5.1, 7.8])

heading('2.7. Kiến trúc tổng thể', 2)
para('Hệ thống sử dụng kiến trúc client-server. Frontend độc giả và frontend quản trị được triển khai như hai ứng dụng riêng, cùng gọi backend Express. Backend tiếp nhận yêu cầu qua route, xác thực và kiểm tra dữ liệu bằng middleware, chuyển phần xử lý sang service, rồi đọc/ghi dữ liệu qua model Mongoose. Socket.IO được khởi tạo cùng backend để gửi thông báo thời gian thực. Ảnh được chuyển tới Cloudinary; backend không cần lưu file ảnh trên ổ đĩa ứng dụng.')
center('Trình duyệt độc giả ─┐\nTrình duyệt quản trị ─┴─ HTTPS / REST API ─ Backend Express ─ MongoDB\n                                      ├─ Socket.IO\n                                      └─ Cloudinary', 11, False, after=8)
para('Trong quá trình phát triển, MongoDB local dạng replica set cho phép kiểm tra transaction tương tự môi trường Atlas. Khi triển khai, hai frontend được cấu hình URL API và Socket.IO riêng qua biến Vite; backend quản lý danh sách origin được phép và thông số cookie theo môi trường.')

# Basic document properties.
doc.core_properties.title = 'Báo cáo dự án quản lý mượn sách trực tuyến'
doc.core_properties.subject = 'Báo cáo phát triển ứng dụng web'
doc.core_properties.author = '[HỌ VÀ TÊN]'
doc.core_properties.keywords = 'quản lý thư viện, mượn sách, Vue, Express, MongoDB'

doc.save(OUT)
print(OUT.resolve())
