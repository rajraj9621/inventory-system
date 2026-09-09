-- Prisma runs on the server. Browser/API roles must not bypass its authorization.
-- One statement keeps permission changes atomic, including on non-Supabase Postgres.
DO $security$
DECLARE
  table_name text;
  api_role text;
  protected_tables text[] := ARRAY[
    'User', 'Category', 'Location', 'StaffLocationAssignment', 'Item',
    'StockMovement', 'ItemTimelineEntry', 'LowStockAlertDismissal',
    '_prisma_migrations'
  ];
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);

  FOREACH table_name IN ARRAY protected_tables LOOP
    -- Prisma's shadow database may not contain its migration bookkeeping table.
    IF table_name = '_prisma_migrations'
       AND to_regclass('public."_prisma_migrations"') IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC', table_name);

    FOR api_role IN
      SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
    LOOP
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I', table_name, api_role);
    END LOOP;
  END LOOP;

  -- Stop automatic API grants on future objects created by this migration role.
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC;
  FOR api_role IN
    SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
  LOOP
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', api_role);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', api_role);
  END LOOP;
END;
$security$;
