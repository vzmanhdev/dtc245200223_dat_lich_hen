# Khắc phục cảnh báo image ứng dụng

Ngày 24/10/2026. Phạm vi: image dùng chung cho app/migrate, không phải toàn bộ image hạ tầng.

## Kết quả

| Kiểm tra Docker Scout | Trước | Sau |
| --- | --- | --- |
| Critical | 0 | 0 |
| High | 13 | **0** |
| Medium | Chưa đo (lần đầu lọc Critical/High) | 1 |
| Low / Unspecified | Chưa đo | 0 / 0 |
| Package nhận diện | 390 | 141 |

Lần quét sau **không lọc severity**, không dùng ignore/suppression hoặc xóa cơ sở dữ liệu package để làm sạch kết quả. Image ứng viên cuối có manifest `sha256:3340102077cf23cc7d0cc18bca1d0afc32fca3d99a050acb814f260cb596e1e3`, config ID `sha256:1b4ed1bc3b8096bfe70b64a9ff9370851ce6074bbf5721972e5d6744bec75868`. Kết quả quét phụ thuộc thời điểm và dữ liệu advisory; không bảo đảm không có lỗ hổng chưa biết.

## Thay đổi thực hiện

- Thay Debian runtime bằng Alpine 3.23; Node.js vẫn 24.22.1. Node và Alpine đều pin digest Linux/amd64 đã kiểm tra registry.
- Giữ npm trong build stage để `npm ci --omit=dev --ignore-scripts`; runtime chỉ nhận Node binary và dependency production. Không đưa npm/Yarn hoặc npm cache vào runtime.
- `undici`, `http-cache-semantics` và `brace-expansion` bị cảnh báo nằm trong npm của base image cũ. Bản `brace-expansion` thực sự thuộc ứng dụng là 2.1.7 và được giữ nguyên; không bỏ dependency ứng dụng để lách scanner.
- Runtime không còn các gói Debian util-linux/perl/zlib gây cảnh báo cũ. Giữ nguyên cơ sở dữ liệu package Alpine để scanner nhận diện OS package. Chạy `apk upgrade --no-cache` khi build và cài libstdc++ cần cho Node.
- Giữ UID 1000, read-only, capabilities, mạng nội bộ, session/CSRF và các chức năng ứng dụng. Schema không đổi.
- Script kiểm tra image đọc FROM thực tế, bỏ qua biến APP_IMAGE và dùng buildx để kiểm tra digest; không còn danh sách base Debian ghi cứng.

Cách tách build/runtime dựa trên [hướng dẫn chính thức Node Docker](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md#smaller-images-without-npmyarn). Cập nhật bảo mật của các nhánh Alpine tham khảo [thông báo Alpine ngày 21/10/2026](https://www.alpinelinux.org/posts/Alpine-3.21.9-3.22.7-3.23.7-and-3.24.3-released.html).

## Kiểm thử và triển khai

Ứng viên cuối được dựng trong project/volume/cổng thử riêng: đủ 13 service, smoke HTTP, TLS, 4 unit test, 3 nhóm integration PostgreSQL và 16 kiểm tra stack đều đạt. Kiểm thử nghiệp vụ gồm cạnh tranh slot, quyền sở hữu, đăng nhập, quản trị dịch vụ/nhân viên/phân công/slot/khách và xác nhận.

Sau đó tạo backup `appointment-20261024-074318.dump`, giữ image cũ ở tag `manh-appointment:before-security-20261024`, promote đúng image ứng viên sang `manh-appointment:local`, recreate app/migrate bằng `--no-build`. Không xóa volume, không reset mật khẩu và không chạy schema downgrade. Đối chiếu số dòng nghiệp vụ trước/sau và nghiệm thu runtime bản chính được lưu tại docs/evidence trên máy.

```powershell
docker scout cves local://manh-appointment:local --format markdown --output docs/evidence/image-scan-remediated.log
node scripts/verify-stack.js
node scripts/verify-tls.js
```

## Cảnh báo còn lại

Scout báo **1 Medium: CVE-2025-60876**, BusyBox `1.37.0-r30`, trạng thái **Not Fixed** trên nhánh Alpine 3.23 tại lần quét. Chưa nhận là đã khắc phục cảnh báo này; không giấu bằng severity filter hoặc suppression. Runtime không cần dùng wget để xử lý nghiệp vụ, nhưng việc có package vẫn được ghi nhận và không tự suy ra là không khai thác được.

Ứng viên Alpine 3.24 từng có một cảnh báo musl chưa phân loại và thông tin fixed version không khớp kho đang cung cấp; bản đó không được promote. Bản cuối dùng nhánh 3.23, quét lại thấy không còn cảnh báo musl đó.

Vẫn cần theo dõi bản vá BusyBox, quét các image hạ tầng riêng và thử lại mỗi khi đổi image/lockfile. Báo cáo Word là ảnh chụp trạng thái trước đợt khắc phục; biên bản này bổ sung thay đổi runtime và kết quả bảo mật mới.
