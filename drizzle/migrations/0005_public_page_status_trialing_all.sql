DO $$
DECLARE
  r record;
  def text;
BEGIN
  FOR r IN SELECT oid, proname FROM pg_proc
           WHERE proname IN ('get_public_availability','create_public_appointment')
             AND pronamespace = 'public'::regnamespace
  LOOP
    def := pg_get_functiondef(r.oid);
    def := replace(def, 't.status = ''active''', 't.status in (''active'',''trialing'')');
    EXECUTE def;
  END LOOP;
END $$;