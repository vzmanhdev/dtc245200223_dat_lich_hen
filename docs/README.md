# Hồ sơ phân tích và kế hoạch đề tài đặt lịch hẹn

[Báo cáo Word 18 trang](../reports/Bao_cao_Appointment_dtc245200223.docx) · [Demo/bàn giao](09_KICH_BAN_DEMO_VA_BAN_GIAO.md) · [Release/rollback](10_RELEASE_VA_ROLLBACK_LOCAL.md)

Ngày lập: 24/10/2026. Trạng thái: full stack Docker localhost đã kiểm chứng; đăng nhập chung và quản trị v3 đã triển khai.

Thông tin đã chốt: Nguyễn Văn Mạnh · dtc245200223 · CNTTK23B. Hạn trong 24 giờ, mốc kế hoạch khoảng 00:37 ngày 25/10/2026 (UTC+7). Phạm vi mới: chỉ localhost, bỏ VPS. Repository: https://github.com/vzmanhdev/dtc245200223_dat_lich_hen.git. Bìa báo cáo cuối theo trang đầu `docx/Bao_cao_Appointment_System.docx`.

Đọc theo thứ tự:

1. [Tổng quan đề tài](01_TONG_QUAN_DU_AN.md): đề bài, hiện trạng, phạm vi, điểm số, kiến trúc, nội dung 9 chapter và đánh giá báo cáo mẫu.
2. [Phân tích yêu cầu](02_PHAN_TICH_YEU_CAU.md): nghiệp vụ, dữ liệu, phân quyền, API dự kiến, yêu cầu kỹ thuật và ca nghiệm thu.
3. [Kế hoạch thực hiện](03_KE_HOACH_PROJECT.md): công việc, phụ thuộc, thời lượng dự kiến, các mốc commit, rủi ro và điều kiện hoàn thành.
4. [Kế hoạch triển khai và nghiệm thu](04_DEPLOY_VA_NGHIEM_THU.md): runbook localhost (VPS đã bỏ), sao lưu, phục hồi, rollback và minh chứng báo cáo.
5. [Dữ liệu project](project_data.json): dữ liệu có cấu trúc để tiếp tục theo dõi bằng công cụ hoặc agent.
6. [Danh mục nguồn](source_inventory.json): file nguồn, số trang PDF, checksum và kết quả trích xuất.
7. [Trạng thái localhost](TRANG_THAI_LOCALHOST.md): kết quả thực và trở ngại hiện tại. Phương án VPS trước đây đã hủy.

Các bản trích xuất trong `sources/` giữ nguyên lỗi câu chữ/cú pháp của nguồn. Chúng phục vụ tra cứu, không phải cấu hình có thể chạy. Các file Word và PDF gốc trong `../docx/` được giữ nguyên.

## Quy ước trạng thái

- `done`: đã thực hiện và có kết quả kiểm tra.
- `todo`: cần thực hiện.
- `needs_input`: cần thông tin thật trước khi thực hiện phần phụ thuộc.
- `blocked`: đã gặp trở ngại thực tế.

Đã có mã ứng dụng, Dockerfile và compose.yaml tại gốc. Các kết quả native/kiểm tra cú pháp chưa thay thế nghiệm thu full stack Docker. Khi triển khai, cập nhật trạng thái, kết quả kiểm thử, phiên bản image và đường dẫn minh chứng tại từng mốc.

8. [Hướng dẫn quản trị v3](07_HUONG_DAN_QUAN_TRI_V3.md): nghiệp vụ và kết quả mới nhất, thay cho các giới hạn seed/CRUD trong tài liệu giai đoạn trước.

9. [Đối chiếu đề 40 và báo cáo mẫu](08_DOI_CHIEU_DE_BAI_VA_BAO_CAO.md): kiểm tra runtime hiện tại, bảng yêu cầu, sai khác với mẫu, lỗi log đã sửa và hồ sơ còn thiếu.
