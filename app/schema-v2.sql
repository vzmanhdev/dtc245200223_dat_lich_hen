-- Additive migration: preserve legacy bookings and customer contact snapshots.
CREATE TABLE IF NOT EXISTS customer_accounts(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 email varchar(200) UNIQUE NOT NULL CHECK(email=lower(email)),
 full_name varchar(100) NOT NULL, phone varchar(20) NOT NULL,
 password_hash text NOT NULL, active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS account_id bigint REFERENCES customer_accounts(id);
CREATE INDEX IF NOT EXISTS customers_account_idx ON customers(account_id);
CREATE TABLE IF NOT EXISTS staff(
 id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 full_name varchar(100) UNIQUE NOT NULL, title varchar(120) NOT NULL,
 bio text NOT NULL, active boolean NOT NULL DEFAULT true
);
INSERT INTO staff(full_name,title,bio) VALUES
 ('Nguyễn Minh An','Chuyên viên tư vấn','Tư vấn công nghệ, giải pháp phần mềm và định hướng dự án.'),
 ('Trần Thu Hà','Chuyên viên tư vấn','Đồng hành cùng khách hàng trong lựa chọn giải pháp và hỗ trợ kỹ thuật.'),
 ('Lê Hoàng Nam','Chuyên viên tư vấn','Hỗ trợ triển khai, vận hành và giải đáp các vấn đề công nghệ.')
 ON CONFLICT(full_name) DO NOTHING;
ALTER TABLE time_slots ADD COLUMN IF NOT EXISTS staff_id integer NOT NULL DEFAULT 1 REFERENCES staff(id);
DO $$
DECLARE item record;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM schema_migrations WHERE version=2) THEN
  FOR item IN SELECT conname FROM pg_constraint WHERE conrelid='time_slots'::regclass AND contype IN ('x','u') LOOP
   EXECUTE format('ALTER TABLE time_slots DROP CONSTRAINT %I',item.conname);
  END LOOP;
  ALTER TABLE time_slots ADD CONSTRAINT staff_start_unique UNIQUE(staff_id,start_at);
  ALTER TABLE time_slots ADD CONSTRAINT staff_no_overlap EXCLUDE USING gist(staff_id WITH =,tstzrange(start_at,end_at,'[)') WITH &&);
 END IF;
END $$;
GRANT SELECT,INSERT ON customer_accounts TO appointment_app;
GRANT SELECT ON staff TO appointment_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO appointment_app;
INSERT INTO schema_migrations(version) VALUES(2) ON CONFLICT DO NOTHING;
