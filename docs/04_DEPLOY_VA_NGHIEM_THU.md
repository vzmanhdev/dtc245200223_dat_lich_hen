# Triển khai và nghiệm thu localhost

Cập nhật 24/10/2026. Phạm vi VPS đã hủy theo yêu cầu. Đây là runbook cho cấu hình hiện có, không phải biên bản đã chạy thành công.

## Khởi động

Chạy từ gốc project khi Docker Desktop Linux engine đã sẵn sàng:

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run setup
powershell -ExecutionPolicy Bypass -File scripts/start.ps1
```

Script tự tìm Docker cài theo user hoặc Program Files, kiểm tra engine/config rồi build/up/wait. Không in mật khẩu. .env chứa thông tin đăng nhập riêng, đã được ignore.

## Địa chỉ kiểm tra

| Thành phần | URL |
| --- | --- |
| Website | http://localhost:8080 |
| Admin | http://localhost:8080/admin |
| pgAdmin | http://localhost:5050 |
| Grafana | http://localhost:3001/d/appointment-local |
| Prometheus | http://localhost:9090/targets |

Loki/exporter/DB chỉ ở mạng container. Giao diện quản trị bind loopback. Tài khoản lấy từ .env, không đưa vào báo cáo.

## Tiêu chí nghiệm thu

1. docker compose config hợp lệ; app, DB và Nginx qua probe. Các one-shot log-init/migrate hoàn tất exit 0.
2. Đặt lịch và xác nhận/hủy qua UI; dữ liệu khớp pgAdmin. Hai request đồng thời chỉ tạo một lịch giữ slot. Admin API từ chối guest/CSRF sai.
3. Prometheus có đủ job prometheus/appointment/nginx/postgres/cadvisor UP; pg_up và nginx_up bằng 1. Dashboard có mẫu thật.
4. CPU/RAM của app phải có label service app; nếu chỉ có cgroup host thì chưa kết luận per-container hoàn tất.
5. Loki trả log app/Nginx/PostgreSQL và ba query trong LOGQL.md có dữ liệu. Chờ agent ship log nếu vừa tạo request.
6. App UID khác 0, filesystem read-only, DB internal không publish, role DB không superuser/owner, secret ngoài Git và Nginx có header.
7. Restart/recreate giữ volume không mất lịch. Dump restore vào DB riêng, kiểm tra schema/count và lịch mẫu khớp.
8. README dựng lại được, commit có nội dung thật, ảnh minh chứng và báo cáo cá nhân ≥10 trang.

Chạy npm run test:integration và node scripts/verify-stack.js; lưu output và thời gian thực. Script verify-stack không thay thế kiểm thử UI hay thử restore.

## Backup và phục hồi

scripts/backup.ps1 tạo dump custom binary-safe vào backups. scripts/restore-test.ps1 -BackupFile <file.dump> khôi phục sang database restore_verify mới, không ghi đè dữ liệu gốc. Cần đối chiếu mã lịch/số bản ghi; file tồn tại đơn thuần chưa chứng minh backup hợp lệ. Không dùng down -v.

## Minh chứng cho báo cáo

EV01 Git/README; EV02 Compose và kiến trúc; EV03 UI đặt/xác nhận; EV04 pgAdmin; EV05 Nginx headers; EV06 targets; EV07 dashboard; EV08 ba LogQL; EV09 UID/mạng/quyền; EV10 concurrency/persistence; EV11 backup/restore; EV12 biên bản nghiệm thu localhost.

Ảnh preview native chỉ chứng minh giao diện/app, không được ghi là ảnh full stack. Báo cáo Word lấy bố cục bìa đầu Bao_cao_Appointment_System.docx, thay bằng Nguyễn Văn Mạnh/dtc245200223/CNTTK23B; ảnh, số liệu, repo và máy phải là kết quả cá nhân. Không sao chép kết luận Đạt từ mẫu.

## Giới hạn cần công khai

HTTP local dùng security headers, chưa TLS; Promtail EOL được giữ theo đề; cAdvisor có ngoại lệ privileged host mounts; app dùng slot seed một nguồn lực. Chưa có vận hành Internet hoặc VPS. Trạng thái mới nhất xem TRANG_THAI_LOCALHOST.md.
