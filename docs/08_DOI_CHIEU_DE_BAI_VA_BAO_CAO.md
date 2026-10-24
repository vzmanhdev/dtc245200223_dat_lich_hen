> **Cập nhật sau khắc phục:** image app mới đã deploy, 13 High → 0; quét mọi severity còn 1 Medium BusyBox chưa có bản vá. Xem [biên bản khắc phục](12_KHAC_PHUC_IMAGE_UNG_DUNG.md). Nội dung quét ban đầu phía dưới là lịch sử.

# Đối chiếu đề 40 và báo cáo triển khai – bản hoàn thiện

Cập nhật 24/10/2026. Phạm vi: Docker Compose trên localhost Windows/WSL 2. Báo cáo mẫu là tài liệu tham khảo; kết luận dưới đây dựa trên source và kiểm tra thực tế.

## Kết quả theo yêu cầu chính

| Yêu cầu | Kết quả và minh chứng |
| --- | --- |
| Dịch vụ, khung giờ, khách hàng, xác nhận | Frontend EJS/JS + backend Express + PostgreSQL; tài khoản khách/admin; quản trị dịch vụ, nhân viên, phân công, slot, khách và vòng đời lịch. [Hướng dẫn v3](07_HUONG_DAN_QUAN_TRI_V3.md) |
| PostgreSQL và pgAdmin | Schema 1/2/3, constraint chống trùng, role app ít quyền; pgAdmin truy vấn DB thật. [Ảnh](evidence/pgadmin-services-verified.png) |
| Toàn bộ dịch vụ bằng Compose | 13 service: 11 chạy liên tục, migrate/log-init exit 0. Bộ kiểm tra stack 16/16 |
| Nginx reverse proxy + HTTPS hoặc headers | Có cả headers và TLS tự ký host 443, cổng container 8443, TLS 1.2/1.3; xác minh thực tế TLS 1.3, CA/SAN, cookie Secure; endpoint metrics/health nội bộ bị chặn |
| Prometheus/Grafana container/web/DB | 5 target UP; 15 panel, 14 truy vấn Prometheus có mẫu hữu hạn, CPU/RAM/Network I/O và một panel log. [Network I/O](evidence/grafana-network-verified.png) |
| Loki/Promtail, ít nhất 2–3 LogQL | 3 nguồn cốt lõi app/Nginx/PostgreSQL và [3 LogQL có kết quả](LOGQL.md). [Explore](evidence/loki-logql-verified.png) |
| Ít nhất 3–4 hardening | Non-root, read-only, cap_drop, no-new-privileges; mạng DB internal; role DB tách; secrets ngoài Git; CSRF/session/rate limit; loopback và TLS. cAdvisor privileged là ngoại lệ |
| GitHub, source/config/README, ≥3 commit | Source đã push main, nhiều commit có ý nghĩa; README có clone/cd/setup, script chạy, nghiệm thu, backup và giới hạn |
| Báo cáo cá nhân ≥10 trang | [Báo cáo Word](../reports/Bao_cao_Trien_khai_Theo_mau_dtc245200223.docx), Bốn chương theo Bao_Cao_Trien_Khai_He_Thong.docx; mục lục/danh mục hình và bảng, ảnh thật, ba mốc Git và kịch bản demo; tổng số trang không quá 30 |
| Tái lập và demo | Clone remote 29cb15c vào thư mục mới, secret và volume riêng; dựng đủ stack và đạt smoke/TLS/16 kiểm tra. Có [kịch bản demo/bàn giao](09_KICH_BAN_DEMO_VA_BAN_GIAO.md); chưa quay video |

Unit 4/4, integration PostgreSQL thật 3/3 nhóm, stack 16/16 và audit sâu 9/9 tại mốc đã push. Các bộ kiểm tra có phạm vi cụ thể, không suy ra điểm số hoặc bảo đảm không còn mọi lỗi. JSON kết quả tại docs/evidence trên máy được gitignore; ảnh minh chứng và tài liệu được commit.

## Những khác biệt với báo cáo mẫu đã xử lý

- **HTTPS và Network I/O:** đã bổ sung, không còn là phần thiếu.
- **Kiến trúc:** một backend chia module cùng nhiều dịch vụ hạ tầng; không nhận đã tách microservices nghiệp vụ.
- **Log mọi container:** cấu hình hiện thu ba nguồn cốt lõi, không thu mọi stdout/stderr. Báo cáo cá nhân ghi đúng phạm vi; đây không phải điều kiện riêng bắt buộc được ghi cho đề 40.
- **Firewall:** đọc Get-NetFirewallProfile thấy Domain/Private/Public Enabled; policy mặc định NotConfigured không chứng minh quy tắc hiệu lực. Không nhận đã cấu hình UFW/iptables trên Windows, chưa kiểm thử từ máy LAN. Port chỉ bind 127.0.0.1.
- **Headers và hardening:** dùng CSP, X-XSS-Protection=0; không nhận non-root bảo vệ tuyệt đối. Promtail root với quyền đọc log riêng, cAdvisor privileged được công khai.
- **Bìa và tài khoản GitHub:** Nguyễn Văn Mạnh / dtc245200223 / CNTTK23B; giảng viên giữ Nguyễn Anh Chuyên theo mẫu, cần người nộp đối chiếu lớp. Repo có MSSV; username GitHub vzmanhdev theo người dùng, không đổi tài khoản.

## Các lỗi vận hành đã khắc phục

1. Nginx dùng IP app cũ sau recreate: chuyển sang Docker DNS resolver.
2. Sidecar log rotation lỗi PID namespace sau restart Nginx: helper nằm cùng container Nginx, khởi động lại cùng master; thử xoay thật và restart đạt.
3. Promtail thu lại file đã xoay và dùng ingestion time cho JSON: chỉ đọc file hiện hành, parse time app/Nginx; request mới đúng một bản trước/sau rotation. Log trùng lịch sử cũ được giữ đến retention, không dùng số đếm đó làm SLA.
4. Bộ kiểm tra bỏ sót sidecar: verify-stack kiểm tra đủ service chạy dài hạn và job exit 0.
5. Nhầm đăng nhập khách/admin: thống nhất /login, email và role backend; đường dẫn cũ redirect về luồng chung.

## Nguồn đối chiếu

S01: đề thực hành đề 40; S02: Bao_Cao_Trien_Khai_He_Thong.docx (48 đoạn, 0 bảng/ảnh nhúng, còn placeholder; SHA256 02c9189f6e9a969c92e76b214a255d133b5261f8e1f9b9198b68a3f6b6149a13). Bìa tham khảo S12 Bao_cao_Appointment_System.docx; không lấy kết quả người khác làm của mình. Cả ba bản gốc được giữ nguyên.

Những hướng mở rộng chưa triển khai: tài khoản riêng cho nhân viên, email xác minh/nhắc lịch, quên mật khẩu, thanh toán, đồng bộ lịch ngoài, phân trang đầy đủ, kiểm thử tải/HA. Đây là giới hạn được ghi trong báo cáo, không phải các chức năng được nhận là đã có.

Bổ sung sau lần quét được người dùng cho phép: Docker Scout image app báo 0 Critical, 13 High trên 6 gói; chưa khắc phục và chưa quét mọi image hạ tầng. Chi tiết: [Biên bản quét](11_KET_QUA_QUET_IMAGE.md).
