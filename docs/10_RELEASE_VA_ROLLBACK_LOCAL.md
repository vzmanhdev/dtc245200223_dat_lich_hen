# Release và rollback localhost

Compose chọn image app/migrate qua `APP_IMAGE`, mặc định `manh-appointment:local`. Image hạ tầng pin digest. Muốn chạy đúng release đã lưu, dùng `--no-build` và có image đó trên Docker Engine.

## Chốt bản đang chạy

Backup trước thay đổi DB; ghi commit và image ID. Ví dụ với image chức năng đã build tại commit `29cb15c`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup.ps1
docker image tag manh-appointment:local manh-appointment:release-29cb15c
docker image inspect manh-appointment:release-29cb15c --format '{{.Id}}'
```

Giữ tag release và backup trên máy; tag không thay backup ngoài máy. Không nhận image thuộc commit mới chỉ vì đổi tên tag, phải đối chiếu source tại lần build. Không đưa dump dữ liệu lên Git/registry.

## Rollback khi schema tương thích

```powershell
$env:APP_IMAGE='manh-appointment:release-29cb15c'
docker compose up -d --no-deps --no-build --wait --wait-timeout 120 app
node scripts/verify-stack.js
node scripts/verify-tls.js
Remove-Item Env:APP_IMAGE
```

Thay app, giữ DB; không chạy migration ngược. Biến chỉ có hiệu lực trong phiên PowerShell. Muốn giữ release qua các lần `compose up`, ghi APP_IMAGE vào .env cục bộ. Không dùng `--build` khi quay lại image release vì nó có thể ghi đè tag bằng source hiện tại.

Migration phá tương thích cần quy trình riêng: dừng nhận ghi, restore backup vào DB thử, kiểm tra schema/dữ liệu, đánh giá dữ liệu mới sau backup trước khi quyết định phục hồi DB chính. Đã thử restore riêng; chưa thử destructive downgrade trên DB chính. Không xóa volume để rollback.

## Diễn tập thực tế

`node scripts/test-rollback.js` chỉ dùng checkout do `rehearse-clean-clone.js` tạo dưới `tmp/`, project appointment_fresh_* và cổng 18080. Tạo một lịch fixture đã hủy trong DB thử, lưu số dòng và MD5 nội dung. Image ứng viên có CMD thoát lỗi bị readiness từ chối. Chuyển về image tốt đã tag: HTTP 200, 1 lịch trước/sau, checksum `e4b0af522d98f519e1b784a75cffc264` khớp. Dừng riêng container/network thử, giữ volume; không chạm dữ liệu bản chính.

Record: docs/evidence/rollback-verification.json (cục bộ). Phạm vi là rollback code với schema tương thích, không phải nâng/hạ mọi phiên bản DB.
