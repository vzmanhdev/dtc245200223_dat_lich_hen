# Demo và bàn giao localhost

Mốc hoàn thiện: 24/10/2026. Sinh viên Nguyễn Văn Mạnh – dtc245200223 – CNTTK23B. Bản chính chạy tại **http://localhost:8080**; 3300 là preview cũ, không dùng để nghiệm thu hạ tầng.

## Hồ sơ mở trước khi trình bày

- [Báo cáo Word 18 trang](../reports/Bao_cao_Appointment_dtc245200223.docx), giữ bố cục bìa mẫu và thông tin sinh viên.
- [README](../README.md), [hướng dẫn quản trị](07_HUONG_DAN_QUAN_TRI_V3.md), [đối chiếu yêu cầu](08_DOI_CHIEU_DE_BAI_VA_BAO_CAO.md).
- Repository: https://github.com/vzmanhdev/dtc245200223_dat_lich_hen.
- `.env` chỉ mở riêng khi lấy tài khoản; không chiếu mật khẩu, private key, password_hash hoặc dump DB.

## Kịch bản 10–15 phút

| Mốc | Thao tác | Điều cần chứng minh |
| --- | --- | --- |
| 0–1 phút | `docker compose ps -a` | 11 service running; migrate/log-init exited 0; chỉ localhost |
| 1–4 | Admin đăng nhập `/login`; vào Dịch vụ, Nhân viên, Khung giờ | Tạo dịch vụ, phân công chuyên viên, mở slot tương lai; không trùng thời gian của cùng người |
| 4–6 | Dùng cửa sổ riêng cho khách; đăng ký/đăng nhập, chọn dịch vụ/người/ngày/giờ | Lịch mới ở pending; chủ sở hữu là tài khoản khách |
| 6–8 | Admin lọc theo mã và xác nhận; khách tải lại `/account` | Cùng mã chuyển confirmed; khách khác không xem/hủy được. Không dùng ngày quá khứ để thử xác nhận |
| 8–9 | pgAdmin :5050, kết nối host `postgres` | Xem services/staff/time_slots/appointments/events trên DB thật |
| 9–11 | Prometheus :9090/targets; Grafana :3001/d/appointment-local | 5 target UP; CPU/RAM, Network receive/transmit, web/DB có dữ liệu |
| 11–13 | Grafana Explore → Loki; chạy [3 LogQL](LOGQL.md) | Request thật, HTTP lỗi và số đếm; tạo trang thiếu để có 404 mới |
| 13–15 | Kiểm tra UID/TLS/cấu hình; xem Git | Hardening, backup/restore và lịch sử commit có ý nghĩa |

Lịch demo hiện có: **MH-75CB5CEF4D4C**, Khách Demo, Tư vấn triển khai hệ thống, Phạm Gia Huy, 27/10/2026 09:00–10:00, confirmed. Đây là ví dụ; tạo slot tương lai mới nếu demo sau ngày đó. Ngừng danh mục thay vì xóa lịch sử. Tài khoản admin theo `.env`, khách tự đăng ký; không chia sẻ mật khẩu admin để đóng vai khách.

```powershell
node scripts/verify-stack.js
node scripts/verify-tls.js
node scripts/audit-requirements.js
npm.cmd test
npm.cmd run test:integration
git log --oneline -12
git status --short
```

Integration tạo dữ liệu giả và cần khoảng một phút. Không chạy liên tiếp nhiều lần để tránh rate limit đăng nhập. Đợi tối thiểu hai scrape và thời gian Promtail chuyển log trước khi kết luận dashboard/log thiếu dữ liệu.

## Tái lập đã thực hiện

Clone remote commit `29cb15c`, tạo secret mới và project/volume riêng, dùng cổng 18080/18443/15050/13001/19090. Dựng đủ 13 service; HTTP smoke, TLS và 16 kiểm tra stack đạt. Sau đó dừng riêng container/network bản thử, giữ volume; bản chính không bị dừng/xóa. Dùng `node scripts/rehearse-clean-clone.js` để diễn tập lại; cần đủ RAM/dung lượng để chạy hai stack. Script không dùng `down -v`.

HTTPS tự ký: https://localhost:8443. Không tự cài CA hoặc bỏ xác minh TLS. Trình duyệt có thể cảnh báo; người dùng tự xử lý việc tin chứng chỉ nếu muốn demo bằng trình duyệt. `verify-tls.js` xác minh trực tiếp Nginx trong Docker bằng đúng CA, SAN localhost, cookie Secure và endpoint nội bộ, tránh antivirus thay chứng chỉ trên host.

## Giới hạn cần trình bày đúng

Ứng dụng có frontend/backend nhưng là backend chia module, chưa tách microservices nghiệp vụ. Chưa có tài khoản đăng nhập riêng cho nhân viên, email/SMS, quên mật khẩu, xác minh email, thanh toán hoặc đồng bộ lịch ngoài. Log tập trung thu app/Nginx/PostgreSQL, không phải mọi stdout container. Firewall Windows có ba profile bật; không nhận đã cấu hình UFW hoặc kiểm thử LAN. cAdvisor privileged là ngoại lệ công khai. Không có video quay sẵn trong hồ sơ; kịch bản này dùng để trình bày hoặc tự quay nếu lớp yêu cầu.

Tên giảng viên ở bìa giữ theo mẫu Nguyễn Anh Chuyên, cần đối chiếu thông tin lớp. Tên repo có MSSV; tài khoản GitHub vẫn là vzmanhdev do người dùng cung cấp.
