# Trạng thái triển khai localhost

Cập nhật 24/10/2026, khoảng 01:37 UTC+7. Mục tiêu VPS đã hủy theo yêu cầu người dùng.

## Đã thực hiện và kiểm chứng

| Hạng mục | Bằng chứng | Phạm vi kết luận |
| --- | --- | --- |
| 4 unit test | npm test đạt | Validation, password, transition và timezone |
| Integration PostgreSQL thật | scripts/test-native.js đạt với PostgreSQL 17 UTF-8 trên Windows | Đặt đồng thời 201/409, idempotency, token, hủy, admin auth/xác nhận/logout và CSRF |
| Giao diện đặt lịch | Thao tác trên trình duyệt nhận mã/token; ảnh native-ui-preview.png | App native preview, không phải full stack |
| Compose config | docker compose config --quiet không lỗi | Cú pháp và khai báo; chưa chứng minh runtime |
| 12 image registry | docs/evidence/image-manifests.json, digest đã pin trong Compose/Dockerfile | Tag tồn tại và có Linux/amd64; chưa chạy container |
| Thư viện npm | Lockfile, npm audit trả 0 vulnerabilities ở thời điểm cài | Không thay thế audit container/runtime |
| Git local | Đã khởi tạo, origin theo repo người dùng | Chưa push lên GitHub |

Ảnh preview:

![Ứng dụng native preview trên màn hình nhỏ](evidence/native-ui-preview.png)

## Chưa được nghiệm thu

Docker Desktop chưa có engine chạy được vì WSL chưa cài/hoàn tất. Lệnh docker info ngoài sandbox trả “Docker Desktop is unable to start”; wsl --version báo chưa cài WSL. Máy có Docker CLI tại thư mục cài theo user, không phải thiếu toàn bộ Docker Desktop.

Người dùng đã chọn tự chạy scripts/setup-wsl-admin.ps1 bằng Administrator. Chưa nhận được xác nhận hoàn tất hoặc thấy log cài trong workspace ở lần kiểm tra cuối. Script không tự reboot; có thể phải khởi động lại Windows theo yêu cầu hệ thống.

Do đó chưa đánh dấu đạt cho: build/up stack; Nginx proxy runtime; pgAdmin; Prometheus targets; dashboard có dữ liệu; Loki/Promtail và 3 query; cAdvisor định danh container; persistence Compose; backup/restore bằng script Docker; nghiệm thu full localhost; báo cáo Word cuối.

Thử dump/restore trong môi trường test native chưa chạy được vì gói binary test không chứa pg_dump/pg_restore. Điều này không xác nhận lỗi của script backup Compose; image postgres có các tiện ích tương ứng và vẫn cần chạy thử thật.

## Có thể xem ngay

Bản xem thử app (PostgreSQL native riêng) đang chạy tại http://localhost:3300. Tài khoản admin xem ADMIN_USERNAME/ADMIN_PASSWORD trong .env trên máy. Không đưa .env vào chat, Git hoặc ảnh báo cáo.

Preview chỉ lắng nghe 127.0.0.1, DB native trên 127.0.0.1:55433. Mục đích là kiểm tra app trong lúc hoàn tất Docker. Sau restart Windows, preview không tự chạy lại. Nó không thay thế các thành phần bắt buộc của đề.

## Bước tiếp theo

Mở PowerShell Administrator và chạy:

```powershell
powershell -ExecutionPolicy Bypass -File "D:\DTC245200223_Dat_Lich_Hen\scripts\setup-wsl-admin.ps1"
```

Sau khi WSL hoàn tất, reboot nếu hệ thống yêu cầu rồi mở Docker Desktop. Khi engine sẵn sàng:

```powershell
cd D:\DTC245200223_Dat_Lich_Hen
powershell -ExecutionPolicy Bypass -File scripts/start.ps1
npm.cmd run test:integration
node scripts/verify-stack.js
```

Website mục tiêu là http://localhost:8080, pgAdmin 5050, Grafana 3001 và Prometheus 9090. Tất cả chỉ loopback. Sau đó thử backup/restore, thu ảnh thật và viết báo cáo Word theo bìa mẫu đã chỉ định.
