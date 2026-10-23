# Hệ thống đặt lịch hẹn trên localhost

Đề 40 · Triển khai và Quản trị Hệ thống Phần mềm. Nguyễn Văn Mạnh · dtc245200223 · CNTTK23B.

Ứng dụng đặt lịch bằng Node.js/Express và PostgreSQL. Toàn bộ môi trường mục tiêu dùng Docker Compose: Nginx, app, PostgreSQL, pgAdmin, Prometheus, Grafana, cAdvisor, Nginx/PostgreSQL exporter, Loki và Promtail. Chỉ chạy trên localhost; không cần VPS hoặc domain.

## Chạy lần đầu

Cần Docker Desktop chạy **Linux containers**, WSL 2 hoạt động trên Windows và Node.js 24 để tạo cấu hình/kiểm thử. Docker Engine phải ở trạng thái running, không chỉ có Docker CLI. Mạng cần tải npm package và container image ở lần đầu.

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run setup
powershell -ExecutionPolicy Bypass -File scripts/start.ps1
```

Hoặc khi `docker` đã có trên PATH:

```powershell
docker compose config --quiet
docker compose up -d --build --wait --wait-timeout 240
docker compose ps
```

`npm run setup` tạo `.env` với mật khẩu ngẫu nhiên riêng và không ghi đè khi file đã có. Mật khẩu xem trong file này trên máy của bạn, không đưa vào Git hoặc ảnh báo cáo. Việc đổi biến mật khẩu sau khi DB/Grafana/pgAdmin đã khởi tạo không tự cập nhật mọi tài khoản; phải đổi trong dịch vụ theo quy trình tương ứng. Không xóa volume để đổi mật khẩu.

| Giao diện | Địa chỉ mặc định | Tài khoản |
| --- | --- | --- |
| Website | http://localhost:8080 | Khách không cần đăng nhập |
| Admin website | http://localhost:8080/admin | ADMIN_USERNAME và ADMIN_PASSWORD trong .env |
| pgAdmin | http://localhost:5050 | PGADMIN_DEFAULT_EMAIL và PGADMIN_DEFAULT_PASSWORD |
| Grafana | http://localhost:3001/d/appointment-local | GRAFANA_ADMIN_USER và GRAFANA_ADMIN_PASSWORD |
| Prometheus | http://localhost:9090/targets | Chỉ bind loopback |

Trong pgAdmin, server Appointment PostgreSQL đã được khai báo; nhập password PostgreSQL của `.env` khi kết nối. Host là `postgres`, database `appointment`, port nội bộ `5432`. Database không publish ra host. Loki/Promtail/exporter không có cổng host; dùng Grafana Explore để đọc log.

Mặc định port web 8080; nếu đổi WEB_PORT hoặc các cổng khác trong `.env`, cập nhật URL kiểm thử theo biến môi trường. Một số lệnh smoke mặc định 8080 và có thể dùng SMOKE_BASE_URL để đổi.

Container image và Node base image đã pin digest **Linux/amd64**, được kiểm tra trên registry. Chưa dùng digest này như bằng chứng image đã chạy; xem trạng thái thực tế phía dưới.

## Dùng thử nghiệp vụ

1. Mở trang chủ, chọn một trong ba dịch vụ và ngày trong 14 ngày tới, chọn giờ trống.
2. Nhập họ tên/số điện thoại demo và gửi. Ghi lại mã lịch cùng token riêng; token chỉ hiển thị lần đầu.
3. Đăng nhập admin, lọc lịch và xác nhận hoặc hủy. Chỉ xác nhận/hủy trước giờ bắt đầu; chỉ hoàn thành lịch đã xác nhận sau giờ kết thúc.
4. Tra cứu bằng token ở trang chủ; người biết token có thể xem/hủy lịch đó. Không chia sẻ token.

MVP có một nguồn lực, slot 30 phút và dịch vụ/slot seed. Chưa có CRUD danh mục đầy đủ, email/SMS, thanh toán, barcode, CSV, đổi lịch hoặc đồng bộ lịch ngoài. Không suy ra tính năng đã làm từ các nút trong báo cáo mẫu.

Migration tạo schema/role và seed idempotent; rerun migration để bổ sung các slot tương lai khi hết 14 ngày. Dữ liệu lịch cũ được giữ. Ràng buộc PostgreSQL chống slot chồng nhau và đặt trùng; transaction xử lý nhất quán cả khách hàng/lịch/audit. Session admin nằm trong PostgreSQL, có CSRF, cookie HttpOnly/SameSite và rate limit.

## Kiểm thử và nghiệm thu

Nếu npm trên mạng hiện tại báo `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, dùng kho CA của Windows bằng `$env:NODE_OPTIONS='--use-system-ca'` rồi chạy lại npm. Giữ xác minh TLS bật; không dùng `strict-ssl=false`. Cấu hình này chỉ áp dụng tiến trình PowerShell hiện tại.

```powershell
npm.cmd test
npm.cmd run test:integration
npm.cmd run smoke
node scripts/verify-stack.js
```

Integration test dùng dữ liệu giả và lưu lịch cancelled trong DB để giữ lịch sử. Kiểm tra cuộc đua hai request, idempotency, validation, token riêng, admin auth, xác nhận, logout/CSRF và route metrics bị chặn ở Nginx. Chạy trên stack demo, không dùng DB có dữ liệu người dùng thật.

`verify-stack.js` kiểm tra engine, config, Nginx, UID, DB, exporter, targets, dashboard và 3 LogQL; kết quả ghi vào `docs/evidence/stack-verification.json`. Chờ Prometheus có ít nhất hai chu kỳ scrape và Promtail chuyển log rồi kiểm tra; No data không có nghĩa là đạt.

Trong lúc chuẩn bị Docker có thể chạy `node scripts/test-native.js` để kiểm tra ứng dụng với PostgreSQL 17 riêng tại cổng 55433. Đây là test phụ trên Windows, **không phải nghiệm thu Compose/Nginx/Grafana/Loki**. `node scripts/test-native.js --serve` mở preview ứng dụng ở 3300, dùng Ctrl+C để dừng.

## Metrics và log

Grafana tự provision hai datasource cùng dashboard 13 panel. Có metrics app/request/status/p95, Nginx connections/request, PostgreSQL up/connections/transactions và CPU/RAM container qua cAdvisor. Nếu cAdvisor trên Docker Desktop thiếu label container, ghi rõ hạn chế và sửa trước khi kết luận đã giám sát được từng container.

Xem [3 query LogQL và cách tạo dữ liệu](docs/LOGQL.md). App dùng Pino JSON, Nginx access JSON; PostgreSQL có log kết nối/lỗi. Promtail đọc volume chỉ đọc, không nhận Docker socket. Promtail đã EOL nhưng được giữ đúng yêu cầu bài lab localhost.

## Bảo mật local

- Tất cả cổng host bind 127.0.0.1, không mở LAN/Internet.
- App chạy UID node, read-only root filesystem, drop capabilities, no-new-privileges.
- DB network internal, role app không superuser/owner schema; role monitoring tách riêng.
- Mật khẩu khác nhau, `.env` ngoài Git, secret không COPY vào image.
- Nginx security headers; `/metrics`, `/health/*`, `/stub_status` không public.
- Truy vấn tham số hóa, render escape HTML, session server-side và CSRF.

cAdvisor là ngoại lệ privileged với read-only host mounts phục vụ lab; Promtail có quyền đọc các volume log read-only, không mount dữ liệu database hoặc Docker socket. Không coi đây là bảo đảm chống mọi container escape. HTTP localhost dùng security headers đáp ứng nhánh yêu cầu đề; chưa triển khai HTTPS/TLS.

## Backup và kiểm tra phục hồi

```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup.ps1
powershell -ExecutionPolicy Bypass -File scripts/restore-test.ps1 -BackupFile backups/appointment-YYYYMMDD-HHMMSS.dump
```

Dump dạng custom được copy binary-safe, không pipeline byte nhị phân qua PowerShell. Restore tạo DB kiểm chứng mới, không ghi đè DB gốc. Kiểm tra schema/count và lịch đã biết; giữ DB kiểm chứng cho pgAdmin xem. Backup local trên cùng ổ chưa bảo vệ khỏi hỏng ổ, cần lưu thêm bản sao khi bàn giao.

## Vận hành

```powershell
docker compose logs --tail=100 app nginx postgres
docker compose restart app
docker compose stop
docker compose up -d --wait
```

`stop/start` hoặc `down/up` giữ named volume; **không dùng `docker compose down -v`** nếu cần dữ liệu. Khi sửa config Nginx, kiểm tra `docker compose exec nginx nginx -t` rồi reload; khi đổi image/app, build và up lại đúng service. Không chỉnh dữ liệu test cũ thành kết quả bài nộp.

## Trạng thái thực tế và hồ sơ

Xem [trạng thái triển khai](docs/TRANG_THAI_LOCALHOST.md), [kế hoạch local](docs/03_KE_HOACH_PROJECT.md), [hồ sơ phân tích](docs/README.md) và `docs/project_data.json`. Chỉ đánh dấu hạ tầng đạt khi đã có output kiểm thử thật. Không sử dụng ảnh/kết quả báo cáo mẫu làm bằng chứng của project.
