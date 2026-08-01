-- =================================================================================
-- Grainfolio-Web: Epic 1 & 2 Supabase Schema Updates and RLS
-- =================================================================================

-- 1. ADD MISSING COLUMNS from Epic 1 (Status & Purchase Price)
ALTER TABLE public.cameras ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

ALTER TABLE public.lenses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.lenses ADD COLUMN IF NOT EXISTS purchase_price NUMERIC;

-- 2. CREATE ledger_transactions TABLE
CREATE TABLE IF NOT EXISTS public.ledger_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    date BIGINT NOT NULL,
    type TEXT NOT NULL, -- 'expense' | 'income'
    category TEXT NOT NULL,
    related_entity_id UUID,
    notes TEXT,
    added_at BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 3. APPLY RLS POLICY TO THE NEW TABLE
-- The previous init_schema applied policies to existing tables. We must apply it to this new table.
ALTER TABLE public.ledger_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Isolation Policy" ON public.ledger_transactions;
CREATE POLICY "Tenant Isolation Policy" 
ON public.ledger_transactions 
FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- 4. ENSURE RLS IS STRICTLY ENFORCED ON ALL TABLES
-- This re-runs the generic template to ensure nothing was missed.
DO $$ 
DECLARE
  t text;
BEGIN
  FOR t IN 
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    
    -- Drop the policy if it exists to avoid errors on re-run
    EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation Policy" ON public.%I;', t);

    -- Absolute Isolation: Only allow actions if user_id matches authenticated user
    EXECUTE format('
      CREATE POLICY "Tenant Isolation Policy" 
      ON public.%I 
      FOR ALL 
      USING (auth.uid() = user_id) 
      WITH CHECK (auth.uid() = user_id);
    ', t);
  END LOOP;
END $$;
