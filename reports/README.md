# Báo cáo nộp bài hiện hành

[Báo cáo theo mẫu triển khai hệ thống](Bao_cao_Trien_khai_Theo_mau_dtc245200223.docx) · Nguyễn Văn Mạnh · dtc245200223 · CNTTK23B · 25/10/2026.

Bản hiện hành bám bố cục `docx/Bao_Cao_Trien_Khai_He_Thong.docx`, **27 trang**, tính cả bìa, mục lục, danh mục và tài liệu tham khảo; có **14 hình, 11 bảng**:

1. Tổng quan kiến trúc hệ thống và chuẩn bị môi trường: sơ đồ đầy đủ 13 service; quản lý mã nguồn và ba mốc Git.
2. Triển khai ứng dụng web, cơ sở dữ liệu và reverse proxy: dịch vụ/khung giờ/khách hàng/xác nhận; PostgreSQL/pgAdmin; Compose; Nginx/HTTPS/headers.
3. Giám sát hệ thống với Prometheus, Grafana và Loki: metrics container/web/DB, Promtail, ba LogQL và ảnh kết quả.
4. Các biện pháp hardening và đánh giá bảo mật: quyền, network, DB, giới hạn/ngoại lệ, kiểm thử và demo.

Sau bốn chương là kết luận, hướng phát triển và tài liệu tham khảo. Có mục lục tự động, danh mục hình và danh mục bảng riêng, chú thích/nguồn dưới hình. Các mô tả sai hoặc không khớp trong mẫu được điều chỉnh theo cấu hình thật; không tự nhận microservices nghiệp vụ, UFW trên Windows hay thu mọi stdout container.

Bìa có logo trường và khung viền theo `docx/Bao_cao_Appointment_System.docx`; điền họ tên, MSSV và lớp. Phong cách chương/mục theo `docx/Bao_Cao_Trien_Khai_He_Thong.docx`. File mẫu gốc giữ nguyên. Các báo cáo cũ còn trên máy và trong bundle sao lưu, không dùng làm bản nộp hiện hành.

Website: https://localhost (host 443 → Nginx 8443). Nhánh main vẫn giữ đúng ba commit; phần hồ sơ được cập nhật trong commit cuối. Tài khoản GitHub hiện là vzmanhdev, tên repo có MSSV; điều kiện tài khoản theo MSSV cần đối chiếu giảng viên.

Tái tạo tùy chọn trên máy có tài liệu mẫu và ảnh minh chứng:

```powershell
python scripts/build-compact-report.py
powershell -ExecutionPolicy Bypass -File scripts/render-detailed-report.ps1
```

Cần Python có python-docx/Pillow, font Windows và Microsoft Word. Không cần chạy builder để khởi động ứng dụng. Word cập nhật các field và xuất PDF QA; render_docx.py/Poppler tạo PNG để kiểm tra từng trang. PDF/PNG QA chỉ lưu cục bộ trong tmp/report-compact, không phải tài liệu nộp riêng.
