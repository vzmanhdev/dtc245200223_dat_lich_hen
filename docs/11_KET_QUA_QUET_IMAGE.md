# Kết quả Docker Scout cho image ứng dụng

Ngày 24/10/2026. Người dùng đã đổi lựa chọn sang cho phép Docker Scout gửi metadata/SBOM tới Docker. Lệnh quét đã hoàn thành; lần chặn tự động trước đó không còn là trạng thái của phép quét này.

```powershell
docker scout cves local://manh-appointment:local --only-severity critical,high --format markdown --output docs/evidence/image-scan.log
```

Image ID: `sha256:85087dee5c9a5f3f4956862d309c425951a3f853739ddf4c3d4189f6c60a9508`, Linux/amd64. Scout lập chỉ mục 390 package và báo **0 Critical, 13 High trên 6 gói**. Chưa sửa hoặc build/deploy image thay thế trong bước quét này.

| Gói trong image | Phiên bản được Scout nhận diện | Nhận xét từ kết quả quét |
| --- | --- | --- |
| util-linux | 2.38.1-5+deb12u3 | Có phát hiện High; nguồn Debian chưa cung cấp bản fixed trong kết quả này |
| brace-expansion | 5.0.9 | Có advisory nêu bản fixed 5.0.10 / 5.0.11 tùy CVE |
| undici | 6.28.0 | Có advisory nêu bản fixed 6.28.1 / 6.29.1 tùy CVE |
| perl | 5.36.0-7+deb12u4 | Có phát hiện High; trạng thái Not Fixed trong kết quả |
| zlib | 1:1.2.13.dfsg-1 | Có phát hiện High; trạng thái Not Fixed trong kết quả |
| http-cache-semantics | 4.2.0 | Có phát hiện High; trạng thái Not Fixed trong kết quả |

Đây là số liệu theo bộ lọc **Critical/High**, không phải khẳng định Medium/Low bằng 0. Chỉ quét image app dùng chung với migrate; chưa quét toàn bộ image hạ tầng. Báo cáo thô nằm trong file log cục bộ được gitignore. Không suy ra khả năng khai thác chỉ từ độ nghiêm trọng của scanner; cần phân loại đường dẫn package, điều kiện khai thác và phạm vi runtime.

`npm audit --omit=dev` trước đó báo 0 advisory cho dependency production của project. Nó không kiểm tra toàn bộ package hệ điều hành hoặc các package được cài sẵn trong Node base image, vì vậy không mâu thuẫn với kết quả Scout.

## Việc xử lý tiếp theo

1. Xác định các package npm bị báo nằm trong dependency ứng dụng hay tooling đi kèm base image; không tự kết luận tất cả được app gọi hoặc tất cả vô hại.
2. Thử base image có bản vá tương thích trên bản build riêng, pin digest mới; với Debian Not Fixed, ghi ngoại lệ và theo dõi bản vá thay vì nhận là đã khắc phục.
3. Quét lại image ứng viên, chạy unit/integration, stack và TLS; chỉ thay bản localhost sau khi đạt kiểm tra. Giữ image release đã tag và backup để rollback.

Kết quả hiện tại là **đã quét, còn phát hiện cần xử lý**, không phải chứng nhận image an toàn hoặc đạt kiểm thử bảo mật toàn diện. Báo cáo Word được chốt trước lần quét; dùng biên bản này làm bổ sung bảo mật khi trình bày.
