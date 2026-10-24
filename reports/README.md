# Báo cáo cá nhân

[Bao_cao_Appointment_dtc245200223.docx](Bao_cao_Appointment_dtc245200223.docx) – 18 trang, Nguyễn Văn Mạnh / dtc245200223 / CNTTK23B, ngày 24/10/2026.

Bìa theo trang đầu `Bao_cao_Appointment_System.docx`; nguồn được giữ nguyên trên máy, không phân phối lại tài liệu học hoặc báo cáo của người khác. Thân bài mới gồm phân tích đề, bài toán, kiến trúc/dữ liệu, 6 bước triển khai, ảnh thật, kiểm thử, clone sạch, phục hồi, giới hạn và demo. Không chứa mật khẩu/private key/dump DB. Giảng viên trên bìa giữ theo mẫu; người nộp đối chiếu thông tin lớp.

QA: build bằng Python python-docx/Pillow, cập nhật field và export PDF bằng Microsoft Word đã cài trên máy; rasterize bằng Poppler, xem từng trang PNG. LibreOffice không có trên máy nên renderer mặc định không chạy được; dùng Word làm backend render thay thế. PDF/PNG QA trong `tmp/report-qa/` không phải tài liệu nộp riêng.

Tái tạo tùy chọn: `python scripts/build-report.py` cần Python có python-docx, Pillow, font Windows và file mẫu gốc ở `docx/`. Không cần bước này để chạy ứng dụng từ clone GitHub; DOCX cuối đã có trong repo.
