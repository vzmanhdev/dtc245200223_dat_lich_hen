ALTER TABLE admin_users ALTER COLUMN username TYPE varchar(200);
CREATE UNIQUE INDEX IF NOT EXISTS admin_email_unique ON admin_users(lower(username));
CREATE TABLE IF NOT EXISTS staff_services(
 staff_id integer NOT NULL REFERENCES staff(id),
 service_id integer NOT NULL REFERENCES services(id),
 PRIMARY KEY(staff_id,service_id)
);
DO $$
DECLARE item record;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM schema_migrations WHERE version=3) THEN
  FOR item IN SELECT conname FROM pg_constraint WHERE conrelid='services'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%duration_minutes%' LOOP
   EXECUTE format('ALTER TABLE services DROP CONSTRAINT %I',item.conname);
  END LOOP;
  ALTER TABLE services ADD CONSTRAINT service_duration_valid CHECK(duration_minutes BETWEEN 15 AND 240 AND duration_minutes%15=0);
  FOR item IN SELECT conname FROM pg_constraint WHERE conrelid='time_slots'::regclass AND ((contype='c' AND pg_get_constraintdef(oid) LIKE '%end_at%') OR contype IN ('x','u')) LOOP
   EXECUTE format('ALTER TABLE time_slots DROP CONSTRAINT %I',item.conname);
  END LOOP;
  ALTER TABLE time_slots ADD CONSTRAINT slot_duration_valid CHECK(end_at>start_at AND end_at<=start_at+interval '4 hours');
  ALTER TABLE time_slots ADD CONSTRAINT staff_no_overlap EXCLUDE USING gist(staff_id WITH =,tstzrange(start_at,end_at,'[)') WITH &&) WHERE(is_open);
  INSERT INTO staff_services SELECT member.id,s.id FROM staff member CROSS JOIN services s ON CONFLICT DO NOTHING;
 END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS staff_open_start_unique ON time_slots(staff_id,start_at) WHERE is_open;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS staff_name_snapshot varchar(100);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS price_snapshot integer NOT NULL DEFAULT 0 CHECK(price_snapshot>=0);
UPDATE appointments a SET staff_name_snapshot=member.full_name FROM time_slots t JOIN staff member ON member.id=t.staff_id WHERE a.slot_id=t.id AND a.staff_name_snapshot IS NULL;
GRANT SELECT,INSERT,UPDATE ON services,staff,time_slots TO appointment_app;
GRANT SELECT,INSERT,DELETE ON staff_services TO appointment_app;
GRANT UPDATE(full_name,phone,active) ON customer_accounts TO appointment_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO appointment_app;
INSERT INTO schema_migrations(version) VALUES(3) ON CONFLICT DO NOTHING;
