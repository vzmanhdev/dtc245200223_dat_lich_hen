"""Editable SVG and high-resolution PNG diagrams derived from actual project configuration."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from html import escape
import math, re
ROOT=Path(__file__).resolve().parent.parent
port_match=re.search(r'^HTTPS_PORT=(\d+)\s*$',(ROOT/'.env').read_text(encoding='utf8'),re.M) if (ROOT/'.env').exists() else None
HTTPS_PORT=int(port_match.group(1)) if port_match else 8443
HTTPS_URL='https://localhost'+('' if HTTPS_PORT==443 else ':'+str(HTTPS_PORT))

OUT=Path(__file__).resolve().parent.parent/'docs/evidence/diagrams'
OUT.mkdir(parents=True,exist_ok=True)
class Drawing:
    def __init__(self,w,h):
        self.w,self.h=w,h;self.im=Image.new('RGB',(w,h),'white');self.d=ImageDraw.Draw(self.im)
        self.svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><rect width="100%" height="100%" fill="white"/>']
    def text(self,x,y,s,size=34,bold=False,color='#172d29',anchor='left'):
        font=ImageFont.truetype('C:/Windows/Fonts/'+('arialbd.ttf' if bold else 'arial.ttf'),size)
        self.d.text((x,y),s,font=font,fill=color,anchor='mt' if anchor=='middle' else 'lt')
        self.svg.append(f'<text x="{x}" y="{y+size*.82}" font-family="Arial,sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" fill="{color}" text-anchor="{anchor if anchor=="middle" else "start"}">{escape(s)}</text>')
    def box(self,rect,title,lines=(),fill='#eef4f1'):
        x,y,r,b=rect;self.d.rounded_rectangle(rect,radius=16,fill=fill,outline='#375e53',width=3)
        self.svg.append(f'<rect x="{x}" y="{y}" width="{r-x}" height="{b-y}" rx="16" fill="{fill}" stroke="#375e53" stroke-width="3"/>')
        size=38
        while ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf',size).getlength(title)>r-x-44:size-=1
        self.text(x+22,y+22,title,size,True)
        body_size=32
        while lines and max(ImageFont.truetype('C:/Windows/Fonts/arial.ttf',body_size).getlength(s) for s in lines)>r-x-44:body_size-=1
        for i,s in enumerate(lines):self.text(x+22,y+80+i*43,s,body_size)
    def arrow(self,points,color='#315d82',width=4):
        self.d.line(points,fill=color,width=width,joint='curve')
        self.svg.append('<polyline points="'+' '.join(f'{x},{y}' for x,y in points)+f'" fill="none" stroke="{color}" stroke-width="{width}"/>')
        a,b=points[-2:];angle=math.atan2(b[1]-a[1],b[0]-a[0]);tri=[b,(b[0]-19*math.cos(angle-.4),b[1]-19*math.sin(angle-.4)),(b[0]-19*math.cos(angle+.4),b[1]-19*math.sin(angle+.4))]
        self.d.polygon(tri,fill=color);self.svg.append('<polygon points="'+' '.join(f'{x},{y}' for x,y in tri)+f'" fill="{color}"/>')
    def save(self,name):
        self.im.save(OUT/(name+'.png'));(OUT/(name+'.svg')).write_text(''.join(self.svg)+'</svg>',encoding='utf8')

# One full-system view. Repeated app endpoint is explicitly a reference, not a service.
o=Drawing(1800,2280)
o.text(40,15,'KIẾN TRÚC TỔNG THỂ 13 SERVICE DOCKER COMPOSE',43,True)
o.text(40,78,'A  WEB VÀ DỮ LIỆU   |   frontend + db internal',32,True)
for rect,title,lines in [
((40,140,330,345),'Trình duyệt',[f'HTTPS :{HTTPS_PORT}','HTTP :8080 phụ']),
((470,140,800,345),'nginx',['TLS / headers','Proxy → app:3000']),
((940,140,1270,345),'app',['Express + EJS','Nghiệp vụ / session']),
((1410,140,1760,345),'postgres',['PostgreSQL 17 :5432','Nghiệp vụ + session']),
((40,435,480,620),'log-init',['Job khởi tạo quyền log','Chạy xong: Exited 0']),
((940,435,1270,620),'migrate',['Job schema 1/2/3','Chạy xong: Exited 0']),
((1410,435,1760,620),'pgadmin',['Host :5050 → :8080','UI quản trị DB'])]:o.box(rect,title,lines)
for x1,x2,label in [(330,470,str(HTTPS_PORT)),(800,940,'3000'),(1270,1410,'5432')]:
 o.arrow([(x1,240),(x2,240)]);o.text((x1+x2)//2,195,label,28,True,anchor='middle')
o.arrow([(1585,435),(1585,345)]);o.text(1610,375,'SQL',26)
o.arrow([(1270,500),(1340,500),(1340,385),(1470,385),(1470,345)])
o.text(500,455,'Các UI chỉ mở trên 127.0.0.1',27)
o.text(500,500,'DB và app không publish port',27)
o.text(500,545,'Job không phải dịch vụ chạy dài hạn',25)
o.text(40,700,'B  METRICS   |   mạng monitoring internal',32,True)
metric_nodes=[('App /metrics :3000',['Tham chiếu service app ở vùng A']),('nginx-exporter :9113',['Đọc nginx:8081/stub_status']),('postgres-exporter :9187',['Đọc postgres:5432, role monitor']),('cadvisor :8080',['CPU / RAM / Network container'])]
for i,(title,lines) in enumerate(metric_nodes):
 y=790+i*160;o.box((40,y,620,y+130),title,lines,fill='#eaf0f8')
 o.arrow([(850,y+65),(620,y+65)]);o.text(735,y+18,'scrape',27,True,anchor='middle')
o.box((850,790,1250,1400),'prometheus :9090',[],fill='#eaf0f8')
for y,s in [(900,'Pull mỗi 15 giây'),(955,'4 endpoint bên trái'),(1010,'+ tự scrape = 5 job'),(1065,'Lưu TSDB: 7d / 1GB'),(1120,'prometheus_data'),(1175,'Host UI :9090')]:o.text(872,y,s,29)
o.box((1430,920,1760,1270),'grafana :3000',[],fill='#fbf2df')
for y,s in [(1005,'Host UI :3001'),(1055,'14 panel metrics'),(1105,'1 panel log / Explore'),(1155,'grafana_data')]:o.text(1450,y,s,27)
o.arrow([(1430,1205),(1250,1205)]);o.text(1340,1135,'PromQL',28,True,anchor='middle')
o.text(40,1500,'C  LOGS   |   volume chỉ đọc → Promtail → Loki',32,True)
for i,(title,lines) in enumerate([('app_logs',['app.log: JSON thời gian sự kiện']),('nginx_logs',['access.log: JSON thời gian sự kiện']),('postgres_logs',['*.log: log PostgreSQL dạng text'])]):
 y=1580+i*160;o.box((40,y,620,y+130),title,lines,fill='#edf6ed');o.arrow([(620,y+65),(850,y+65)],color='#287747')
o.box((850,1580,1250,2060),'promtail :9080',[],fill='#edf6ed')
for y,s in [(1680,'Đọc 3 nguồn file'),(1730,'Parse time / gắn label'),(1780,'Lưu offset: positions'),(1830,'Mount log chỉ đọc'),(1880,'Không Docker socket')]:o.text(872,y,s,28)
o.box((1430,1760,1760,2030),'loki :3100',[],fill='#edf6ed')
for y,s in [(1840,'LogQL / TSDB v13'),(1890,'loki_data'),(1940,'Retention 168 giờ')]:o.text(1450,y,s,27)
o.arrow([(1250,1975),(1430,1975)],color='#287747');o.text(1340,1905,'HTTP push',26,True,anchor='middle')
o.arrow([(1595,1270),(1595,1760)]);o.text(1615,1430,'LogQL',28,True)
o.text(40,2120,'Xanh dương: chiều yêu cầu web / SQL / scrape / truy vấn; phản hồi đi ngược lại.',28,color='#315d82')
o.text(40,2170,'Xanh lá: chiều dữ liệu log. Các volume là nơi lưu dữ liệu, không tính thêm service.',28,color='#287747')
o.text(40,2220,'13 service = 11 chạy dài hạn + 2 job; sơ đồ chi tiết từng luồng nằm trong các phần tiếp theo.',28)
o.save('00-full-system-architecture')

a=Drawing(1800,960)
a.text(40,20,'LUỒNG TRUY CẬP WEB VÀ DỮ LIỆU',43,True)
for rect,title,lines in [
((40,140,500,380),'Khách / quản trị viên',['Trình duyệt trên Windows',HTTPS_URL,'HTTP 8080: kênh lab phụ']),
((670,140,1130,380),'Nginx reverse proxy',['Kết thúc TLS 1.2 / 1.3','Headers và giới hạn request','Chỉ publish lên loopback']),
((1300,140,1760,380),'Ứng dụng Express + EJS',['HTTP nội bộ app:3000','Frontend + xử lý nghiệp vụ','Session, CSRF, transaction']),
((40,620,500,850),'Quản trị cơ sở dữ liệu',['Trình duyệt của quản trị','http://localhost:5050','Tài khoản riêng của pgAdmin']),
((670,620,1130,850),'pgAdmin',['Container pgadmin:8080','Giao diện xem / truy vấn DB','Không phải backend đặt lịch']),
((1300,620,1760,850),'PostgreSQL 17',['postgres:5432 trong mạng db','Nghiệp vụ + session','Không publish 5432 ra host'])]:a.box(rect,title,lines)
a.arrow([(500,260),(670,260)]);a.text(585,190,'HTTPS',29,True,anchor='middle');a.text(585,224,str(HTTPS_PORT),29,anchor='middle')
a.arrow([(1130,260),(1300,260)]);a.text(1215,190,'HTTP',29,True,anchor='middle');a.text(1215,224,'3000',29,anchor='middle')
a.arrow([(1530,380),(1530,620)]);a.text(1555,475,'SQL / 5432',31,True)
a.arrow([(500,730),(670,730)]);a.text(585,660,'HTTP',29,True,anchor='middle');a.text(585,694,'5050',29,anchor='middle')
a.arrow([(1130,730),(1300,730)]);a.text(1215,660,'SQL',29,True,anchor='middle');a.text(1215,694,'5432',29,anchor='middle')
a.text(40,910,'Mũi tên: bên chủ động gửi yêu cầu → bên tiếp nhận; phản hồi đi theo chiều ngược lại.',30)
a.save('01-web-data-flow')

m=Drawing(1800,1020);m.text(40,20,'THU THẬP METRICS VÀ TRUY VẤN DASHBOARD',43,True)
targets=[('App :3000',['/metrics: HTTP, latency, Node.js']),('nginx-exporter :9113',['Đọc nginx:8081/stub_status']),('postgres-exporter :9187',['Đọc PostgreSQL bằng role monitor']),('cAdvisor :8080',['Đọc tài nguyên container trên host'])]
for i,(title,lines) in enumerate(targets):
 y=110+i*210;m.box((40,y,660,y+160),title,lines)
 m.arrow([(910,y+80),(660,y+80)]);m.text(785,y+30,'scrape',30,True,anchor='middle')
m.box((910,110,1320,900),'Prometheus :9090',[],fill='#e9eff8')
for y,s in [(310,'15 giây / lần'),(375,'Lưu chuỗi thời gian'),(440,'4 nguồn bên trái'),(505,'+ tự scrape chính nó'),(570,'Tổng cộng 5 job'),(635,'Retention 7 ngày')]:m.text(930,y,s,30)
m.box((1470,370,1770,650),'Grafana',[],fill='#f6f1e7');m.text(1490,455,'Dashboard 15 panel',27);m.text(1490,500,'Nguồn Prometheus',27)
m.arrow([(1470,550),(1320,550)]);m.text(1395,480,'PromQL',29,True,anchor='middle')
m.text(40,960,'Mũi tên: yêu cầu scrape hoặc truy vấn. Metrics trả về theo chiều ngược lại.',31)
m.save('02-metrics-pull-flow')

l=Drawing(1800,1080);l.text(40,20,'THU THẬP LOG VÀ TRA CỨU LOGQL',43,True)
files=[('app_logs',['Pino JSON: app.log']),('nginx_logs',['Access JSON: access.log']),('postgres_logs',['Log DB: postgresql-*.log'])]
for i,(title,lines) in enumerate(files):
 y=130+i*230;l.box((40,y,610,y+170),title,lines,fill='#eef1f8');l.arrow([(610,y+85),(800,y+85)])
l.box((800,130,1210,820),'Promtail',[])
for y,s in [(300,'Mount log chỉ đọc'),(365,'Parse JSON time'),(430,'Gắn label service'),(495,'Ghi vị trí đã đọc'),(560,'Không Docker socket')]:l.text(820,y,s,29)
l.box((1390,230,1760,490),'Loki :3100',['Lưu log / chỉ mục label','Retention 168 giờ'],fill='#f6f1e7')
l.arrow([(1210,355),(1390,355)]);l.text(1300,275,'HTTP push',28,True,anchor='middle')
l.box((1390,730,1760,940),'Grafana Explore',['LogQL → kết quả log'],fill='#f6f1e7')
l.arrow([(1575,730),(1575,490)]);l.text(1600,590,'LogQL',29,True)
l.text(40,900,'Ba nguồn file → Promtail → Loki: chiều dữ liệu log.',32,True)
l.text(40,950,'Grafana → Loki: chiều yêu cầu truy vấn, không phải chiều đẩy log.',30)
l.text(40,1000,'Pipeline hiện tại không thu stdout/stderr của tất cả container.',30)
l.save('03-log-collection-flow')

e=Drawing(1800,1520);e.text(40,20,'MÔ HÌNH DỮ LIỆU THEO SCHEMA THỰC TẾ',43,True)
for rect,title,lines in [
((40,120,500,320),'staff',['PK id; full_name; active']),
((670,120,1130,320),'staff_services',['PK (staff_id, service_id)','FK → staff, services']),
((1300,120,1760,320),'services',['PK id; duration_minutes','price; active']),
((670,530,1130,770),'time_slots',['PK id; start_at; end_at','FK staff_id → staff','FK service_id → services']),
((40,950,500,1170),'customer_accounts',['PK id; email; active','password_hash']),
((670,950,1130,1170),'customers',['PK id; liên hệ snapshot','FK account_id → tài khoản']),
((1300,950,1760,1220),'appointments',['PK id; booking_code; status','FK customer_id → customers','FK slot_id → time_slots','Snapshot dịch vụ / người / giá']),
((1300,1320,1760,1490),'appointment_events',['FK appointment_id → lịch','Trạng thái / tác nhân / giờ'])]:e.box(rect,title,lines)
e.arrow([(500,220),(670,220)]);e.text(585,155,'1—N',30,anchor='middle')
e.arrow([(1300,220),(1130,220)]);e.text(1215,155,'1—N',30,anchor='middle')
e.arrow([(270,320),(270,650),(670,650)]);e.text(300,590,'1—N',30)
e.arrow([(1530,320),(1530,650),(1130,650)]);e.text(1435,590,'1—N',30)
e.arrow([(500,1060),(670,1060)]);e.text(585,990,'1—N',30,anchor='middle')
e.arrow([(1130,1060),(1300,1060)]);e.text(1215,990,'1—N',30,anchor='middle')
e.arrow([(900,770),(900,850),(1530,850),(1530,950)]);e.text(1170,805,'1—N trong lịch sử',29,anchor='middle')
e.arrow([(1530,1220),(1530,1320)]);e.text(1570,1260,'1—N',30)
e.text(40,1270,'Mũi tên: bảng cha → bảng chứa khóa ngoại.',29)
e.text(40,1320,'Tài khoản sở hữu lịch thông qua customers.account_id.',29,True)
e.text(40,1370,'Không có appointments.account_id trong schema hiện tại.',29,True)
e.text(40,1430,'Session, admin_users và schema_migrations là bảng hỗ trợ.',28)
e.save('04-actual-erd')

s=Drawing(1800,650);s.text(40,20,'VÒNG ĐỜI MỘT LỊCH HẸN',43,True)
s.box((40,180,490,390),'pending',['Khách gửi yêu cầu','Slot được giữ'])
s.box((675,180,1125,390),'confirmed',['Admin xác nhận','Trước giờ bắt đầu'])
s.box((1310,180,1760,390),'completed',['Admin hoàn tất','Sau giờ kết thúc'])
s.arrow([(490,280),(675,280)]);s.arrow([(1125,280),(1310,280)])
s.box((675,470,1125,620),'cancelled',['Giữ lịch sử, giải phóng slot'])
s.arrow([(260,390),(260,540),(675,540)]);s.arrow([(900,390),(900,470)])
s.text(40,80,'Các nhánh hủy phải thỏa quyền và thời gian; trạng thái kết thúc không tự mở lại.',30)
s.save('05-appointment-states')
print('Created six SVG/PNG diagrams in',OUT)
