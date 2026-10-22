-- ====================================================================
-- SCHEMA: LongWallet Personal Expense Tracker (Supabase / Postgres 17)
-- ====================================================================

-- 1. PROFILES TABLE (Linked with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    default_currency TEXT DEFAULT 'VND' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. WALLETS TABLE (Supports Bank accounts & Notification listening)
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    bank_code TEXT, -- e.g. 'VCB', 'MB', 'TCB', 'MOMO', 'CASH'
    account_number TEXT, -- e.g. '0123456789' or last 4 digits for matching
    package_name TEXT, -- Android app package e.g. 'com.VCB', 'com.mbmobile'
    current_balance NUMERIC(15, 2) DEFAULT 0 NOT NULL,
    icon TEXT DEFAULT 'wallet' NOT NULL,
    color TEXT DEFAULT '#10B981' NOT NULL,
    is_archived BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. CATEGORIES TABLE (System defaults + user custom categories)
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL means system default
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
    icon TEXT DEFAULT 'tag' NOT NULL,
    color TEXT DEFAULT '#3B82F6' NOT NULL,
    is_default BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. CATEGORY KEYWORDS TABLE (For auto-classifying bank notifications)
CREATE TABLE IF NOT EXISTS public.category_keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL means system default
    keyword TEXT NOT NULL, -- e.g. 'grab', 'be', 'shopee', 'highlands'
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. TRANSACTIONS TABLE (With Anti-duplicate hash and Auto-detected flag)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    type TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE', 'TRANSFER')),
    transaction_date TIMESTAMPTZ DEFAULT now() NOT NULL,
    note TEXT,
    receipt_url TEXT,
    is_auto_detected BOOLEAN DEFAULT false NOT NULL,
    raw_message TEXT,
    raw_hash TEXT, -- Anti-duplicate hash for bank notifications
    status TEXT DEFAULT 'CONFIRMED' NOT NULL CHECK (status IN ('CONFIRMED', 'PENDING', 'REJECTED')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Unique index to prevent duplicate auto-detected transactions per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_user_raw_hash 
ON public.transactions(user_id, raw_hash) 
WHERE raw_hash IS NOT NULL;

-- 6. BUDGETS TABLE (Monthly budget limits per category)
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    amount_limit NUMERIC(15, 2) NOT NULL CHECK (amount_limit > 0),
    month_year TEXT NOT NULL, -- Format: YYYY-MM e.g. '2026-10'
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (user_id, category_id, month_year)
);

-- ====================================================================
-- PERFORMANCE INDEXES
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_account_number ON public.wallets(user_id, account_number);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_category_keywords_cat_id ON public.category_keywords(category_id);
CREATE INDEX IF NOT EXISTS idx_category_keywords_keyword ON public.category_keywords(keyword);
CREATE INDEX IF NOT EXISTS idx_category_keywords_user_id ON public.category_keywords(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON public.transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON public.budgets(user_id, month_year);
CREATE INDEX IF NOT EXISTS idx_budgets_category_id ON public.budgets(category_id);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS)
-- ====================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT TO authenticated 
USING ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE TO authenticated 
USING ((select auth.uid()) = id) 
WITH CHECK ((select auth.uid()) = id);

-- Wallets Policies
CREATE POLICY "Users can view own wallets" 
ON public.wallets FOR SELECT TO authenticated 
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own wallets" 
ON public.wallets FOR INSERT TO authenticated 
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own wallets" 
ON public.wallets FOR UPDATE TO authenticated 
USING ((select auth.uid()) = user_id) 
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own wallets" 
ON public.wallets FOR DELETE TO authenticated 
USING ((select auth.uid()) = user_id);

-- Categories Policies (View system defaults OR own categories)
CREATE POLICY "Users can view default or own categories" 
ON public.categories FOR SELECT TO authenticated 
USING (user_id IS NULL OR (select auth.uid()) = user_id);

CREATE POLICY "Users can insert own categories" 
ON public.categories FOR INSERT TO authenticated 
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own categories" 
ON public.categories FOR UPDATE TO authenticated 
USING ((select auth.uid()) = user_id) 
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own categories" 
ON public.categories FOR DELETE TO authenticated 
USING ((select auth.uid()) = user_id);

-- Category Keywords Policies
CREATE POLICY "Users can view default or own keywords" 
ON public.category_keywords FOR SELECT TO authenticated 
USING (user_id IS NULL OR (select auth.uid()) = user_id);

CREATE POLICY "Users can insert own keywords" 
ON public.category_keywords FOR INSERT TO authenticated 
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own keywords" 
ON public.category_keywords FOR DELETE TO authenticated 
USING ((select auth.uid()) = user_id);

-- Transactions Policies
CREATE POLICY "Users can view own transactions" 
ON public.transactions FOR SELECT TO authenticated 
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own transactions" 
ON public.transactions FOR INSERT TO authenticated 
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own transactions" 
ON public.transactions FOR UPDATE TO authenticated 
USING ((select auth.uid()) = user_id) 
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own transactions" 
ON public.transactions FOR DELETE TO authenticated 
USING ((select auth.uid()) = user_id);

-- Budgets Policies
CREATE POLICY "Users can view own budgets" 
ON public.budgets FOR SELECT TO authenticated 
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own budgets" 
ON public.budgets FOR INSERT TO authenticated 
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own budgets" 
ON public.budgets FOR UPDATE TO authenticated 
USING ((select auth.uid()) = user_id) 
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own budgets" 
ON public.budgets FOR DELETE TO authenticated 
USING ((select auth.uid()) = user_id);

-- ====================================================================
-- AUTOMATION TRIGGERS
-- ====================================================================

-- 1. Trigger: Auto create profile and default cash wallet when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Create profile
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.raw_user_meta_data->>'avatar_url'
    );

    -- Create default 'Ví tiền mặt'
    INSERT INTO public.wallets (user_id, name, bank_code, current_balance, icon, color)
    VALUES (
        NEW.id,
        'Ví tiền mặt',
        'CASH',
        0,
        'cash',
        '#10B981'
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Trigger: Auto adjust wallet balance on confirmed transaction insert/update/delete
CREATE OR REPLACE FUNCTION public.handle_wallet_balance_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Revert old transaction if existed and confirmed
    IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
        IF OLD.status = 'CONFIRMED' THEN
            IF OLD.type = 'EXPENSE' THEN
                UPDATE public.wallets SET current_balance = current_balance + OLD.amount, updated_at = now() WHERE id = OLD.wallet_id;
            ELSIF OLD.type = 'INCOME' THEN
                UPDATE public.wallets SET current_balance = current_balance - OLD.amount, updated_at = now() WHERE id = OLD.wallet_id;
            END IF;
        END IF;
    END IF;

    -- Apply new transaction if confirmed
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF NEW.status = 'CONFIRMED' THEN
            IF NEW.type = 'EXPENSE' THEN
                UPDATE public.wallets SET current_balance = current_balance - NEW.amount, updated_at = now() WHERE id = NEW.wallet_id;
            ELSIF NEW.type = 'INCOME' THEN
                UPDATE public.wallets SET current_balance = current_balance + NEW.amount, updated_at = now() WHERE id = NEW.wallet_id;
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_transaction_balance_change ON public.transactions;
CREATE TRIGGER on_transaction_balance_change
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.handle_wallet_balance_change();

-- Revoke direct RPC execution from public/anon/authenticated on trigger functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_wallet_balance_change() FROM PUBLIC, anon, authenticated;

-- ====================================================================
-- SEED SYSTEM DEFAULT CATEGORIES & KEYWORDS
-- ====================================================================
DO $$
DECLARE
    cat_food UUID;
    cat_transport UUID;
    cat_shopping UUID;
    cat_bills UUID;
    cat_entertainment UUID;
    cat_health UUID;
    cat_salary UUID;
    cat_investment UUID;
BEGIN
    -- Expenses
    INSERT INTO public.categories (name, type, icon, color, is_default)
    VALUES ('Ăn uống', 'EXPENSE', 'utensils', '#EF4444', true) RETURNING id INTO cat_food;

    INSERT INTO public.categories (name, type, icon, color, is_default)
    VALUES ('Di chuyển', 'EXPENSE', 'car', '#F59E0B', true) RETURNING id INTO cat_transport;

    INSERT INTO public.categories (name, type, icon, color, is_default)
    VALUES ('Mua sắm', 'EXPENSE', 'shopping-bag', '#8B5CF6', true) RETURNING id INTO cat_shopping;

    INSERT INTO public.categories (name, type, icon, color, is_default)
    VALUES ('Hóa đơn & Tiện ích', 'EXPENSE', 'receipt', '#3B82F6', true) RETURNING id INTO cat_bills;

    INSERT INTO public.categories (name, type, icon, color, is_default)
    VALUES ('Giải trí', 'EXPENSE', 'film', '#EC4899', true) RETURNING id INTO cat_entertainment;

    INSERT INTO public.categories (name, type, icon, color, is_default)
    VALUES ('Sức khỏe', 'EXPENSE', 'heart-pulse', '#10B981', true) RETURNING id INTO cat_health;

    -- Incomes
    INSERT INTO public.categories (name, type, icon, color, is_default)
    VALUES ('Lương', 'INCOME', 'briefcase', '#10B981', true) RETURNING id INTO cat_salary;

    INSERT INTO public.categories (name, type, icon, color, is_default)
    VALUES ('Thưởng & Đầu tư', 'INCOME', 'trending-up', '#06B6D4', true) RETURNING id INTO cat_investment;

    -- Keywords for auto-classification
    INSERT INTO public.category_keywords (category_id, keyword) VALUES
    (cat_food, 'highland'), (cat_food, 'coffee'), (cat_food, 'cafe'), (cat_food, 'tea'), (cat_food, 'phuc long'),
    (cat_food, 'pho'), (cat_food, 'com'), (cat_food, 'banh mi'), (cat_food, 'bun cha'), (cat_food, 'kfc'),
    (cat_food, 'lotteria'), (cat_food, 'mcdonald'), (cat_food, 'pizza'), (cat_food, 'baemin'), (cat_food, 'shopeefood'),

    (cat_transport, 'grab'), (cat_transport, 'be group'), (cat_transport, 'xanh sm'), (cat_transport, 'gojek'),
    (cat_transport, 'petrolimex'), (cat_transport, 'pvoil'), (cat_transport, 'xang'), (cat_transport, 've xe'),

    (cat_shopping, 'shopee'), (cat_shopping, 'lazada'), (cat_shopping, 'tiki'), (cat_shopping, 'tiktok shop'),
    (cat_shopping, 'winmart'), (cat_shopping, 'coopmart'), (cat_shopping, 'bach hoa xanh'), (cat_shopping, 'circle k'), (cat_shopping, '7-eleven'),

    (cat_bills, 'dien luc'), (cat_bills, 'evn'), (cat_bills, 'nuoc'), (cat_bills, 'internet'), (cat_bills, 'viettel'), (cat_bills, 'vnpt'), (cat_bills, 'fpt telecom'),

    (cat_salary, 'luong'), (cat_salary, 'salary'), (cat_salary, 'payroll'), (cat_salary, 'thu lao');
END $$;
