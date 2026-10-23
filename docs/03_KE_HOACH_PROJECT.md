# Kế hoạch hoàn thiện toàn bộ localhost

Cập nhật ngày 24/10/2026 theo yêu cầu mới: bỏ hoàn toàn triển khai VPS. Không mua máy, domain hoặc cấu hình public Internet. Đích nghiệm thu là toàn bộ stack Docker Compose trên máy cá nhân.

Sinh viên Nguyễn Văn Mạnh · dtc245200223 · CNTTK23B. Repository đã cung cấp: https://github.com/vzmanhdev/dtc245200223_dat_lich_hen.git. Hạn nộp vẫn trong 24 giờ theo mốc trao đổi trước, xấp xỉ 00:37 ngày 25/10/2026 UTC+7; thời gian đã dùng vẫn tính vào hạn.

## Kết quả đã có

- Mã ứng dụng, giao diện khách và admin, schema PostgreSQL và migration/seed.
- Session admin lưu DB, CSRF, rate limit, token tra cứu riêng, SQL tham số hóa, audit trạng thái.
- Ràng buộc chống slot chồng nhau và hai lịch active trên cùng slot, idempotency.
- Dockerfile, Compose, Nginx, exporter, metrics, Loki/Promtail và dashboard provisioning 13 panel.
- Script tạo .env ngẫu nhiên, start, smoke, kiểm thử stack, backup/restore-test.
- 4 unit test và integration test PostgreSQL 17 native đã đạt; đặt lịch qua giao diện preview đã đạt.
- Compose qua kiểm tra cú pháp. Chưa có kết quả chạy stack Docker vì WSL/Engine chưa sẵn sàng.

## Mốc thực hiện còn lại

| Mốc | Việc cần làm | Điều kiện hoàn tất | Trạng thái |
| --- | --- | --- | --- |
| L0 | Cài WSL Administrator; restart nếu Windows yêu cầu; mở Docker Desktop | docker info trả ServerVersion | Chờ người dùng xử lý Windows |
| L1 | npm ci; setup; build/pull và up Compose | Các service liên tục running, app/DB/Nginx ready; one-shot exit 0 | Chưa chạy |
| L2 | Test integration qua Nginx, kiểm tra pgAdmin và giữ dữ liệu khi restart | Luồng đặt/xác nhận/hủy, auth và concurrency đúng trên Compose | Chưa chạy |
| L3 | Xác minh targets, exporter, dashboard, 3 LogQL và log DB | verify-stack đạt; panel container định danh đúng | Chưa chạy |
| L4 | Hardening, backup/restore và kiểm tra restart | ≥4 biện pháp có bằng chứng, restore vào DB riêng và dữ liệu khớp | Chưa chạy |
| L5 | README, commit có ý nghĩa, ảnh, báo cáo Word theo bìa mẫu S12 | ≥10 trang, thông tin cá nhân đúng, ảnh/kết quả của project này | Chưa hoàn tất |

Bắt đầu L1 ngay khi L0 xong. Lỗi image/network/cAdvisor phải xử lý và kiểm tra lại; không tự đánh dấu đạt chỉ từ Compose config hoặc container Up. Một số bước viết tài liệu có thể tiếp tục khi L0 đang chờ, nhưng L2–L4 cần Docker Engine thật.

## Phân bổ thời gian còn lại

Tính từ khi Docker sẵn sàng: dự trù 2–3 giờ build và sửa môi trường; 2–3 giờ kiểm tra app/DB/Nginx; 2–3 giờ metrics/log; 1–2 giờ phục hồi/hardening; 3–4 giờ báo cáo/ảnh/demo; giữ ít nhất 2 giờ dự phòng. Đây là dự toán, không phải kết quả đạt hoặc bảo đảm thời hạn. Nếu WSL cần reboot thì tiếp tục từ code đã lưu, không khởi động lại toàn bộ công việc.

Phần chưa thuộc MVP: CRUD dịch vụ/slot đầy đủ (hiện seed), email/SMS, CSV, barcode, Google Calendar, đổi lịch, CI/CD và Alloy dài hạn. Không mở thêm các phần này trước khi đủ 7 nhóm rubric.

## Lệnh tiếp tục sau bước Windows

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start.ps1
npm.cmd run test:integration
node scripts/verify-stack.js
powershell -ExecutionPolicy Bypass -File scripts/backup.ps1
```

Đọc thêm README ở gốc project và trạng thái trong TRANG_THAI_LOCALHOST.md. Không chạy down -v để xử lý lỗi, vì lệnh đó xóa dữ liệu volume.
