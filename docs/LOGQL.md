# Truy vấn log trên localhost

Mở Grafana → Explore → chọn Loki. Log có label `service` bằng `app`, `nginx` hoặc `postgres` và `environment="local"`. Chọn khoảng thời gian 15 phút gần nhất, mở website và đường dẫn không tồn tại để sinh log.

```logql
{service="app", environment="local"}
```

```logql
{service="nginx", environment="local"} | json | __error__="" | status >= 400
```

```logql
sum(count_over_time({service="nginx", environment="local"} | json | __error__="" | status >= 400 [5m]))
```

Kiểm tra bổ sung:

```logql
{service="postgres", environment="local"}
```

```logql
{service="app", environment="local"} | json | __error__="" | level=50
```

Pino dùng level số: 30 là info, 50 là error. Query cuối chỉ có dữ liệu nếu có lỗi thực; không gắn endpoint gây lỗi công khai. Không ghi body request, token, password hoặc query string vào log HTTP.

Promtail là yêu cầu của đề và được giữ cho bài lab localhost; công cụ đã EOL, không coi cấu hình này là khuyến nghị cho vận hành Internet dài hạn.
