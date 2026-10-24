-- ====================================================================
-- SCHEMA: DEBTS TABLE (Personal Debt & Loan Tracker)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    person_name TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    type TEXT NOT NULL CHECK (type IN ('DEBT', 'LOAN')), -- 'DEBT': Tôi nợ (Đi vay), 'LOAN': Cho vay
    due_date TIMESTAMPTZ,
    monthly_amount NUMERIC(15, 2),
    is_settled BOOLEAN DEFAULT false NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_debts_user_id ON public.debts(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_settled ON public.debts(user_id, is_settled);

ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'debts' AND policyname = 'Users can view own debts'
    ) THEN
        CREATE POLICY "Users can view own debts" 
        ON public.debts FOR SELECT TO authenticated 
        USING ((select auth.uid()) = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'debts' AND policyname = 'Users can insert own debts'
    ) THEN
        CREATE POLICY "Users can insert own debts" 
        ON public.debts FOR INSERT TO authenticated 
        WITH CHECK ((select auth.uid()) = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'debts' AND policyname = 'Users can update own debts'
    ) THEN
        CREATE POLICY "Users can update own debts" 
        ON public.debts FOR UPDATE TO authenticated 
        USING ((select auth.uid()) = user_id) 
        WITH CHECK ((select auth.uid()) = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'debts' AND policyname = 'Users can delete own debts'
    ) THEN
        CREATE POLICY "Users can delete own debts" 
        ON public.debts FOR DELETE TO authenticated 
        USING ((select auth.uid()) = user_id);
    END IF;
END $$;
