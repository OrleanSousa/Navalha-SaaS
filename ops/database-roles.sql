-- Execute com uma conta administrativa. Senhas devem ser atribuídas pelo cofre do provedor.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'navalha_owner') THEN
    CREATE ROLE navalha_owner NOLOGIN NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'navalha_app') THEN
    CREATE ROLE navalha_app LOGIN NOBYPASSRLS;
  END IF;
END $$;
GRANT CONNECT ON DATABASE navalha TO navalha_app;
GRANT USAGE ON SCHEMA public TO navalha_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO navalha_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO navalha_app;
ALTER DEFAULT PRIVILEGES FOR ROLE navalha_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO navalha_app;
