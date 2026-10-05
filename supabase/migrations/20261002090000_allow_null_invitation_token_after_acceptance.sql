-- The token hash remains the authoritative lookup value after acceptance.
-- Clearing the plaintext token is intentional, so the legacy column must be nullable.
ALTER TABLE public.team_invitations
  ALTER COLUMN token DROP NOT NULL;
