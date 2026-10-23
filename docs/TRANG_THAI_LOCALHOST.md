# Trạng thái triển khai localhost

Cập nhật 24/10/2026, 02:12 UTC+7. Toàn bộ stack Docker Compose đã chạy sau khi cài WSL và restart Windows. Phạm vi chỉ localhost.

| Dịch vụ | Địa chỉ |
| --- | --- |
| Website | http://localhost:8080 |
| Quản trị lịch hẹn | http://localhost:8080/admin |
| pgAdmin | http://localhost:5050 |
| Grafana | http://localhost:3001 |
| Prometheus | http://localhost:9090 |

Tài khoản/mật khẩu nằm trong `.env` trên máy: ADMIN_USERNAME/ADMIN_PASSWORD, PGADMIN_DEFAULT_EMAIL/PGADMIN_DEFAULT_PASSWORD và biến GRAFANA. Cổng 3300 là preview cũ; dùng 8080 cho bản đầy đủ.

## Kết quả kiểm chứng

- Docker Engine 29.9.2, WSL 3.0.3.0; image Linux/amd64 đã pin digest. Build/up thành công, migration và log-init kết thúc mã 0.
- 4 unit test đạt; integration qua Nginx và PostgreSQL Docker đạt: đặt lịch, chống đặt đồng thời, idempotency, tra cứu/hủy, đăng nhập admin, xác nhận, CSRF và logout.
- `node scripts/verify-stack.js`: 15/15 đạt, gồm pgAdmin, Nginx, quyền DB, 5 target Prometheus UP, exporter DB/Nginx, container metric có nhãn service, Grafana provision 13 panel và 3 truy vấn LogQL.
- Sau restart postgres/app/promtail/nginx: smoke web và 15 kiểm tra stack tiếp tục đạt. Hai bản ghi lịch hẹn có hash nội dung trước/sau giống nhau.
- Backup `backups/appointment-20261024-021004.dump`, SHA256 `5147D2AE9268107A41D74EB0F44AE55A34799DC63D344D66E10C5619AC0ED99D`. Phục hồi vào DB riêng `restore_verify_20261024021018`: 2 lịch hẹn, schema version 1. Database gốc được giữ nguyên.
- Minh chứng: `docs/evidence/stack-verification.json`, `docs/evidence/persistence-restore.json`; dump và JSON vận hành được gitignore.
- pgAdmin dùng cổng container 8080 tương thích môi trường hạn quyền, host vẫn 5050; healthcheck HTTP đạt.

![Giao diện Docker localhost](evidence/localhost-home.png)

## Vận hành và việc còn lại

Mở Docker Desktop rồi chạy `powershell -ExecutionPolicy Bypass -File scripts/start.ps1` khi cần khởi động project. Giữ nguyên `.env` và named volumes. Không chạy `docker compose down -v` vì sẽ xóa dữ liệu.

Báo cáo Word ≥10 trang theo bìa mẫu chưa được tạo; GitHub đã push thành công nhánh main; remote đã đối chiếu khớp commit local. Chưa diễn tập fresh clone, rollback image, kiểm thử tải dài hạn hoặc quét toàn bộ image. Dịch vụ và khung giờ dùng seed; chưa có CRUD đầy đủ. Runtime localhost đã qua kiểm tra; hồ sơ nộp vẫn cần hoàn thiện.
