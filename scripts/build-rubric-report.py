"""Academic report organized by the seven assignment assessment criteria.
Reuses the verified source cover/styles and source-backed technical sections.
"""
from pathlib import Path
import json, re
ROOT=Path(__file__).resolve().parent.parent
source=(ROOT/'scripts/build-detailed-report.py').read_text(encoding='utf8')
exec(compile(source.split("front_page('LỜI MỞ ĐẦU',True)")[0],str(ROOT/'scripts/build-detailed-report.py'),'exec'),globals())
OUT=ROOT/'reports/Bao_cao_Doi_chieu_7_tieu_chi_dtc245200223.docx'
QA=ROOT/'tmp/report-rubric';QA.mkdir(parents=True,exist_ok=True)
(QA/'artifact.md').write_text('Source cover: docx/Bao_cao_Appointment_System.docx; SHA256 '+sha256(REF.read_bytes()).hexdigest()+'. Original sources unchanged. Cover/layout retained. User explicitly requests body organized by seven grading criteria, three Git milestones, separate contents/figures/tables and full technical evidence. Times New Roman13; A4; left3/right2cm; automatic TOC/SEQ/PAGE. Word export + render_docx rasterization and every-page visual QA required.',encoding='utf8')
# True new milestone IDs, not the historical per-fix log.
milestone_ids=subprocess.check_output([GIT,'rev-list','--reverse','HEAD'],cwd=ROOT,encoding='utf8').splitlines()
if len(milestone_ids)!=3:raise RuntimeError('This report expects the three-milestone main history')
milestones={'commit1':milestone_ids[0],'commit2':milestone_ids[1]}
https_port=443
match=re.search(r'^HTTPS_PORT=(\d+)\s*$',(ROOT/'.env').read_text(encoding='utf8'),re.M)
if match:https_port=int(match.group(1))
public_url='https://localhost'+('' if https_port==443 else ':'+str(https_port))
def reuse(start,end,replace=()):
    block=source[source.index(start):source.index(end)]
    for a,b in replace:block=block.replace(a,b)
    block=block.replace('https://localhost:8443',public_url).replace('cổng host 8443',f'cổng host {https_port}').replace('cổng HTTPS trên host là 8443',f'cổng HTTPS trên host là {https_port}').replace('TLS tự ký 8443',f'TLS tự ký {https_port}')
    block=block.replace('Cổng HTTPS trên host là 8443 vì lab dùng port cao; HTTPS không bắt buộc phải dùng 443.','Cổng HTTPS trên host là 443, ánh xạ vào 8443 trong container; trình duyệt tự ẩn cổng mặc định 443.').replace('https-browser-verified.png','https-current-443.png').replace('mục 2.6','Chương 3')
    if start.startswith("h('1.6."):
        block='\n'.join("p('setup-env sinh secret riêng khi chưa có .env; setup-tls tạo chứng chỉ local và kiểm tra SAN/hạn dùng. Secret, key, dump và tài liệu học phần không đưa lên Git. README hướng dẫn clone, setup và khởi động; mỗi checkout dùng thông tin xác thực riêng.')" if line.startswith("p('setup-env.js sinh secret") else line for line in block.splitlines())
    exec(compile(block,'source-backed report section','exec'),globals())
front_page('LỜI MỞ ĐẦU',True)
p('Em thực hiện đề 40 Hệ thống đặt lịch hẹn trong học phần Triển khai và Quản trị Hệ thống Phần mềm. Sản phẩm phục vụ đơn vị tư vấn nhiều chuyên viên: khách có tài khoản, chọn dịch vụ, nhân viên và khung giờ; quản trị viên xác nhận và quản lý cuộc hẹn. Phần mềm dùng Express/EJS, PostgreSQL và pgAdmin; toàn bộ môi trường chạy bằng Docker Compose trên Windows/WSL 2.')
p('Báo cáo tổ chức trực tiếp theo bảy tiêu chí chấm điểm của đề: GitHub; ứng dụng và cơ sở dữ liệu; Nginx; Prometheus/Grafana; Loki/Promtail/LogQL; hardening; tổng thể và demo. Mỗi chương nêu yêu cầu, cách thực hiện, chức năng từng thành phần, kết quả và minh chứng. Sơ đồ tổng thể thể hiện cả web, dữ liệu, metrics và logs; các sơ đồ riêng dùng để giải thích từng luồng.')
p('Lịch sử main được gộp thành ba mốc có ý nghĩa theo yêu cầu người thực hiện: triển khai web/Nginx; tích hợp giám sát; hoàn thiện logging/hardening và hồ sơ. Đây là lịch sử đã tổ chức lại, không giả định toàn bộ phần mềm được xây dựng chỉ trong ba thao tác. Lịch sử cũ được sao lưu cục bộ trước khi gộp. Phạm vi triển khai là localhost; báo cáo ghi rõ kết quả đã kiểm chứng và các giới hạn còn lại.')
front_page('MỤC LỤC');field(d.add_paragraph(),'TOC \\o "1-2" \\h \\z \\u')
front_page('DANH MỤC HÌNH ẢNH');field(d.add_paragraph(),'TOC \\h \\z \\c "Hinh"')
front_page('DANH MỤC BẢNG');field(d.add_paragraph(),'TOC \\h \\z \\c "Bang"')
chapter('CHƯƠNG 1. QUẢN LÝ MÃ NGUỒN TRÊN GITHUB')
h('1.1. Yêu cầu và phạm vi đối chiếu')
p('Tiêu chí GitHub chiếm 1,5 điểm: repository có source, file cấu hình, README hướng dẫn chạy và ít nhất ba commit có ý nghĩa. Đề còn yêu cầu tài khoản đặt tên theo MSSV. Repository đang sử dụng là vzmanhdev/dtc245200223_dat_lich_hen; tên repo có MSSV, nhưng tên tài khoản vzmanhdev chưa khớp nguyên văn điều kiện tài khoản theo MSSV. Điểm này cần đối chiếu với giảng viên; báo cáo không tự nhận đã đáp ứng điều kiện tên tài khoản.')
table('Ma trận bảy tiêu chí và vị trí nội dung báo cáo',['Tiêu chí','Điểm','Nội dung và minh chứng'],[
('1. GitHub','1,5','Chương 1: repo, README và ba mốc commit'),('2. Web và Database','1,5','Chương 2: đặt hẹn thật, PostgreSQL, pgAdmin và Compose'),('3. Nginx reverse proxy','1,5','Chương 3: chuyển tiếp request, HTTPS và headers'),('4. Prometheus và Grafana','1,5','Chương 4: năm target, dashboard container/web/DB'),('5. Loki và LogQL','1,5','Chương 5: Promtail, ba nguồn và ba query có kết quả'),('6. Hardening','1,5','Chương 6: nhiều biện pháp, tác dụng và cách kiểm tra'),('7. Tổng thể và trình bày','1,0','Chương 7: nghiệm thu, demo đủ thành phần và giới hạn')],[5.0,1.5,9.5])
h('1.2. Ba commit tương ứng ba mốc triển khai')
table('Ba mốc commit trên nhánh main',['Mốc','Định danh','Nội dung và điều cần hiểu'],[
('Commit 1',milestones['commit1'][:7],'Website + PostgreSQL + pgAdmin + Docker Compose + Nginx reverse proxy. Trình duyệt vào Nginx, app xử lý nghiệp vụ và DB lưu dữ liệu.'),
('Commit 2',milestones['commit2'][:7],'Prometheus + Grafana + exporter/cAdvisor. Thu số liệu container, web server và DB để quan sát hoạt động.'),
('Commit 3','main / HEAD','Loki + Promtail + LogQL, hoàn thiện chức năng, hardening, HTTPS, kiểm thử và báo cáo. Lấy SHA thực tế bằng git log -1.')],[2.7,3.0,10.3])
p('Commit 1 trả lời website chạy qua proxy và lưu dữ liệu ở đâu; Commit 2 trả lời hệ thống đang hoạt động thế nào; Commit 3 trả lời tra cứu sự kiện và bảo vệ hệ thống bằng cách nào. Mỗi commit là một snapshot mã nguồn. Khi gộp, các bản sửa lỗi liên quan được đưa vào mốc cuối; phiên bản cuối là bản dùng để chạy demo. SHA của commit cuối không in cố định trong chính file báo cáo được chứa trong commit đó; lệnh git log -3 là nguồn đối chiếu trực tiếp.')
fig(E/'github-three-milestones.png','Lịch sử GitHub gồm ba mốc Nginx monitoring và logging','Ảnh chụp thật trang Commits của nhánh main sau khi gộp, hiển thị đúng ba tên mốc. Vùng ảnh tập trung vào tên mốc và ngữ cảnh repository; SHA được tra trực tiếp bằng Git. Commit cuối được cập nhật nội dung báo cáo trước khi bàn giao, số mốc và tên mốc giữ nguyên.',source='GitHub repository vzmanhdev/dtc245200223_dat_lich_hen ngày 24/10/2026')
h('1.3. Cấu trúc repository và tái lập bằng README')
reuse("h('1.6. Cấu trúc repository và cách dựng lần đầu')","chapter('CHƯƠNG 2.",[("h('1.6. Cấu trúc repository và cách dựng lần đầu')",'')])
chapter('CHƯƠNG 2. TRIỂN KHAI WEBSITE VÀ CƠ SỞ DỮ LIỆU')
fig(D/'00-full-system-architecture.png','Kiến trúc đầy đủ web database monitoring và logging','Ba vùng gồm web/dữ liệu, metrics và logs. Tất cả 13 service đều được thể hiện; 11 service chạy dài hạn và hai job migrate/log-init kết thúc exit 0. App /metrics là endpoint của service app, không phải service thứ mười bốn. Mũi tên xanh dương là yêu cầu, phản hồi đi ngược lại; xanh lá là dữ liệu log. Grafana đọc hai nguồn Prometheus và Loki. Website hiện dùng host 443 ánh xạ vào Nginx 8443.',max_height=22)
h('2.1. Yêu cầu nghiệp vụ và mô hình thực hiện')
p('Tiêu chí này chiếm 1,5 điểm và yêu cầu ứng dụng chạy ổn định, kết nối PostgreSQL cùng pgAdmin hoạt động. Bốn đối tượng bắt buộc là dịch vụ, khung giờ, khách hàng và xác nhận. Hệ thống cụ thể hóa bằng đơn vị tư vấn nhiều nhân viên: admin quản lý danh mục và lịch, khách gửi yêu cầu có tài khoản. Nhân viên là nguồn lực được phân công, chưa có cổng đăng nhập nhân viên riêng; đây là phạm vi thực hiện hiện tại.')
h('2.2. Phân quyền và quy trình đặt hẹn')
reuse("h('2.1. Phân tích chức năng và phân quyền người dùng')","h('2.6. Cấu hình Nginx",[("h('2.1. Phân tích chức năng và phân quyền người dùng')",''),("h('2.2. Quy trình đặt hẹn và quản lý trạng thái')","h('2.3. Quy trình đặt hẹn và quản lý trạng thái')"),("h('2.3. Quản lý dịch vụ nhân viên khung giờ và hồ sơ khách')","h('2.4. Quản lý dịch vụ nhân viên khung giờ và hồ sơ khách')"),("h('2.4. Thiết kế PostgreSQL và chống đặt trùng')","h('2.5. Thiết kế PostgreSQL và chống đặt trùng')"),("h('2.5. Đóng gói Docker Compose và công cụ pgAdmin')","h('2.6. Docker Compose và công cụ pgAdmin')")])
p('Kết quả nghiệm thu phần web/DB: các nhóm integration PostgreSQL thật đã kiểm tra đặt trùng, idempotency, quyền sở hữu lịch và quản trị danh mục; pgAdmin đã truy vấn bảng services. Ảnh và số lượng bản ghi là snapshot tại thời điểm chụp, không phải dữ liệu cố định của hệ thống. Bộ kiểm tra hạ tầng gần nhất đạt 16/16 và audit sâu 9/9; chi tiết phạm vi được trình bày ở Chương 7.')
chapter('CHƯƠNG 3. CẤU HÌNH NGINX REVERSE PROXY')
h('3.1. Yêu cầu chức năng và luồng xử lý')
p('Tiêu chí Nginx chiếm 1,5 điểm, tương ứng mốc Commit 1. Điều kiện là truy cập website qua reverse proxy và có HTTPS tự ký hoặc headers cơ bản. Phiên bản hiện tại có cả HTTPS lẫn headers: browser gửi request vào Nginx, Nginx kết thúc TLS rồi chuyển HTTP tới app:3000, app giao tiếp PostgreSQL. Nginx không tự xử lý đặt lịch và không kết nối DB thay ứng dụng.')
fig(D/'01-web-data-flow.png','Luồng HTTPS qua Nginx tới backend và PostgreSQL','Trình duyệt mở '+public_url+' ở cổng mặc định 443. Docker ánh xạ 443 trên Windows vào cổng TLS 8443 của Nginx; app:3000 và postgres:5432 là các cổng nội bộ. pgAdmin dùng cổng host 5050 riêng. HTTP 8080 được giữ cho các script lab; chưa ép mọi request HTTP chuyển sang HTTPS.')
reuse("h('2.6. Cấu hình Nginx","chapter('CHƯƠNG 3.",[("h('2.6. Cấu hình Nginx reverse proxy và HTTPS tự ký')","h('3.2. Cấu hình HTTPS và chứng chỉ local')"),("h('2.7. Security headers giới hạn request và khả năng phục hồi proxy')","h('3.3. Headers giới hạn request và phục hồi proxy')")])
p('HTTPS_PORT trong .env là cổng Windows do Compose publish; listen 8443 ssl trong Nginx là cổng trong container. Hai giá trị có thể khác nhau. Để bỏ port trong URL, HTTPS_PORT=443 và recreate Nginx. Chứng chỉ vẫn là tự ký cho localhost/127.0.0.1; port mặc định không tự làm chứng chỉ thành CA công cộng đáng tin cậy. Các UI công cụ vẫn dùng HTTP loopback ở cổng riêng.')
chapter('CHƯƠNG 4. GIÁM SÁT PROMETHEUS VÀ GRAFANA')
p('Tiêu chí monitoring chiếm 1,5 điểm và tương ứng Commit 2. Cần chứng minh có dữ liệu container, web server và database. Việc một container Grafana đang chạy chưa đủ; phải kiểm tra Prometheus scrape thành công và panel truy vấn được mẫu số liệu thật.')
reuse("h('3.1. Phân biệt mục đích của metrics và log')","h('3.5. Loki Promtail",[("h('3.1.","h('4.1."),("h('3.2.","h('4.2."),("h('3.3.","h('4.3."),("h('3.4.","h('4.4.")])
h('4.5. Năm target và vai trò cấu hình từng dịch vụ')
reuse("h3('3.7.1. Prometheus và năm scrape job')","h3('3.7.4. Loki",[("h3('3.7.1.","h3('4.5.1."),("h3('3.7.2.","h3('4.5.2."),("h3('3.7.3.","h3('4.5.3.")])
p('Kết quả kiểm tra: cả năm job có mẫu, metric kết nối DB/Nginx có dữ liệu, CPU/RAM và Network I/O nhận diện theo Compose service. Audit kiểm tra biểu thức của từng panel Prometheus có mẫu số hữu hạn trong cửa sổ kiểm tra. Chưa cấu hình Alertmanager hoặc cảnh báo gửi ra ngoài; đề hiện yêu cầu giám sát và dashboard, không ghi bắt buộc cảnh báo tự động.')
chapter('CHƯƠNG 5. LOG TẬP TRUNG LOKI PROMTAIL VÀ LOGQL')
p('Tiêu chí log tập trung chiếm 1,5 điểm, tương ứng Commit 3. Promtail đọc file log của app, Nginx và PostgreSQL rồi đẩy đến Loki; Grafana Explore gửi LogQL để truy vấn. Ba query bắt buộc trong báo cáo gồm xem log app, lọc HTTP lỗi của Nginx và đếm lỗi theo cửa sổ thời gian. Từng query có mục đích và điều kiện kiểm chứng riêng.')
reuse("h('3.5. Loki Promtail","h('3.7. Cấu hình",[("h('3.5.","h('5.1."),("h('3.6.","h('5.2."),("h3('3.6.1.","h3('5.2.1."),("h3('3.6.2.","h3('5.2.2."),("h3('3.6.3.","h3('5.2.3.")])
h('5.3. Cấu hình Loki và Promtail đang sử dụng')
reuse("h3('3.7.4. Loki","h('3.8. Danh mục",[("h3('3.7.4.","h3('5.3.1."),("h3('3.7.5.","h3('5.3.2.")])
p('Kết quả bộ verify-stack gần nhất: Loki và cả ba LogQL đều pass, audit nhận diện đủ ba service nguồn log. Query số đếm là metric query của Loki, khác counter của Prometheus. Không cần mở cổng Loki/Promtail ra Windows để demo: truy vấn qua Grafana Explore. Pipeline chỉ thu ba nguồn cốt lõi; không nhận đã thu mọi stdout của toàn bộ container.')
chapter('CHƯƠNG 6. HARDENING HỆ THỐNG')
p('Tiêu chí hardening chiếm 1,5 điểm; yêu cầu ít nhất 3–4 biện pháp có thể chứng minh. Hardening được bổ sung trong mốc cuối và áp dụng từ quyền tiến trình, filesystem, network, quyền DB đến thao tác web. Mỗi biện pháp bên dưới có tác dụng cụ thể và cách kiểm tra, không chỉ được liệt kê tên.')
reuse("h('4.1. Nguyên tắc áp dụng hardening')","h('4.3. Quét image",[("h('4.1.","h('6.1."),("h('4.2.","h('6.2.")])
h('6.3. Bộ lệnh minh chứng và kết quả')
code('docker compose exec -T app id -u\ndocker compose exec -T nginx nginx -t\nnode scripts/audit-requirements.js\nnode scripts/verify-tls.js')
p('UID ứng dụng đã kiểm tra là 1000; audit xác nhận filesystem read-only, cap_drop, no-new-privileges và các network internal. Role app không sở hữu schema và không là superuser; 5432 không publish host. TLS kiểm tra CA/SAN bằng chứng chỉ local rõ ràng, cookie Secure qua HTTPS và endpoint metrics public bị chặn. Nginx headers được kiểm tra từ phản hồi HTTP thật.')
p('Quét image và backup/restore là phần mở rộng hỗ trợ vận hành, không thay ba đến bốn biện pháp bắt buộc. Image ứng dụng đã khắc phục 13 High, còn một Medium BusyBox chưa có bản vá theo lần Scout đã lưu; chưa nhận toàn bộ image hạ tầng đã sạch lỗ hổng. DB đã được phục hồi vào DB thử riêng và so checksum; các bản dump không đưa lên Git. cAdvisor privileged và Promtail có quyền đọc log rộng là ngoại lệ đã công khai, không cấp cho app.')
chapter('CHƯƠNG 7. NGHIỆM THU TỔNG THỂ VÀ KỊCH BẢN DEMO')
p('Tiêu chí tổng thể chiếm 1,0 điểm: toàn bộ stack chạy bằng Compose, demo đủ website, DB tool, Grafana, LogQL và hardening; người trình bày giải thích được vai trò thành phần. Chương này tập hợp kết quả kiểm tra và trình tự demo để đối chiếu đúng từng tiêu chí. Báo cáo vượt mức tối thiểu mười trang và có bìa cá nhân, mục lục, hình minh chứng cùng chú thích.')
reuse("h('5.1. Phương pháp kiểm thử","h('5.3. Các lỗi",[("h('5.1.","h('7.1."),("h('5.2.","h('7.2.")])
h('7.3. Demo đầy đủ từng tiêu chí trong khoảng mười lăm phút')
reuse("table('Kịch bản thao tác và điều cần chỉ ra'","h('D. Chú giải",[])
h('7.4. Các câu hỏi cần tự giải thích khi bảo vệ')
table('Câu hỏi và câu trả lời gắn với cấu hình thực tế',['Câu hỏi','Nội dung cần giải thích'],[
('Ai đặt lịch với ai?','Khách có tài khoản đặt với chuyên viên của đơn vị tư vấn; admin tạo dịch vụ/phân công/slot và xác nhận.'),('Tại sao cần Nginx?','Một cổng vào cho website, kết thúc TLS, chuyển request tới app và áp headers/giới hạn.'),('Prometheus và Grafana khác nhau thế nào?','Prometheus thu/lưu chuỗi thời gian; Grafana truy vấn và hiển thị chúng.'),('Loki và Promtail khác nhau thế nào?','Promtail đọc/đẩy file log; Loki lưu/truy vấn log; Explore là giao diện xem.'),('Tại sao năm target UP chưa đủ?','UP chỉ nói scrape thành công; cần kiểm tra metric nguồn, panel và ca nghiệp vụ riêng.'),('Làm sao chống đặt trùng?','Transaction/khóa slot, idempotency và unique index bảo vệ cả khi hai request đồng thời.'),('Bảo mật nào có bằng chứng?','UID 1000, read-only/cap_drop, DB role ít quyền, internal network và phản hồi headers/TLS.'),('Ba commit thể hiện điều gì?','Ba mốc tổng hợp Nginx, monitoring, logging/hardening; main cuối chứa bản dùng demo.')],[5.2,10.8])
h('7.5. Giới hạn và nội dung còn cần đối chiếu')
p('Tài khoản GitHub hiện chưa đặt đúng MSSV theo nguyên văn đề; cần đối chiếu yêu cầu hình thức với giảng viên. Chưa có video demo trong hồ sơ và chỉ quay nếu yêu cầu nộp của lớp có quy định. Chưa có VPS, domain công khai, HA, kiểm thử tải dài hạn hoặc cảnh báo tự động. Các phần này không được mô tả là đã triển khai. Tài khoản nhân viên riêng, email/SMS và quên mật khẩu là hướng mở rộng nghiệp vụ, không nằm trong bốn đối tượng tối thiểu của đề 40.')
chapter('KẾT LUẬN')
p('Đề tài triển khai được website đặt lịch hẹn có dịch vụ, khung giờ, khách hàng và xác nhận; kết nối PostgreSQL và sử dụng pgAdmin. Docker Compose dựng đầy đủ ứng dụng, Nginx, Prometheus/Grafana, Loki/Promtail cùng các thành phần hỗ trợ. Hệ thống được đánh giá theo từng nhóm yêu cầu bằng kết quả kiểm thử, cấu hình và ảnh thực tế. Các biện pháp hardening giảm quyền và bề mặt truy cập; các ngoại lệ và giới hạn được ghi rõ.')
p('Ba mốc Git được tổ chức tương ứng Nginx, monitoring và logging/hardening để theo dõi dễ hơn. Báo cáo trình bày theo bảy tiêu chí chấm điểm, không tự chấm điểm thay giảng viên. Khi bảo vệ, cần thao tác trên bản main cuối, đối chiếu cùng mã cuộc hẹn từ website tới DB, rồi giải thích dữ liệu trên dashboard và các truy vấn log. Điểm cần tiếp tục đối chiếu là quy định tên tài khoản GitHub và hình thức demo của lớp.')
chapter('TÀI LIỆU THAM KHẢO')
for ref in ['[1] Đề tài Thực hành môn Triển khai và Quản trị Hệ thống Phần mềm, phần yêu cầu chung, bảng tiêu chí và Đề 40. Tài liệu học phần do sinh viên cung cấp.', '[2] Bao_Cao_Trien_Khai_He_Thong.docx. Tham khảo quy trình triển khai web, monitoring/logging và hardening.', '[3] Bao_cao_Appointment_System.docx. Tham khảo bố cục bìa và hình thức trình bày báo cáo.', '[4] Docker Docs. Networking in Compose. https://docs.docker.com/compose/how-tos/networking/', '[5] PostgreSQL 17 Documentation. Transaction Isolation. https://www.postgresql.org/docs/17/transaction-iso.html', '[6] Nginx Documentation. Configuring HTTPS servers. https://nginx.org/en/docs/http/configuring_https_servers.html', '[7] MDN. X-XSS-Protection. https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-XSS-Protection', '[8] Prometheus Documentation. Overview. https://prometheus.io/docs/introduction/overview/', '[9] Grafana Loki Documentation. Promtail agent. https://grafana.com/docs/loki/latest/send-data/promtail/', '[10] Node.js Docker Best Practices. https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md', '[11] Repository source và cấu hình dự án. https://github.com/vzmanhdev/dtc245200223_dat_lich_hen. Tài liệu web đối chiếu ngày 24/10/2026.']:p(ref)
# Remove unused source-body assets; keep cover/footer and live fields.
used={el.get(attr) for el in d.element.iter() for attr in [qn('r:embed'),qn('r:link'),qn('r:id')] if el.get(attr)}
for rid,rel in list(d.part.rels.items()):
    if rid not in used and rel.reltype.rsplit('/',1)[-1] in ['image','hyperlink']:d.part.drop_rel(rid)
u=d.settings.element.find(qn('w:updateFields'))
if u is None:u=OxmlElement('w:updateFields');d.settings.element.append(u)
u.set(qn('w:val'),'true')
d.core_properties.title='Báo cáo đề 40 đối chiếu bảy tiêu chí triển khai hệ thống'
d.core_properties.subject='Nguyễn Văn Mạnh dtc245200223 CNTTK23B'
d.save(OUT)
(QA/'manifest.json').write_text(json.dumps({'output':str(OUT),'figures':figures,'tables':tables,'milestones':milestones,'https_url':public_url,'source_sha256':sha256(REF.read_bytes()).hexdigest()},ensure_ascii=False,indent=2),encoding='utf8')
print('Created',OUT,'figures',len(figures),'tables',len(tables),'HTTPS',public_url)
