-- Migration: Create leads table
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    source TEXT,
    status TEXT DEFAULT 'novo',
    notes TEXT,
    store_id UUID REFERENCES public.stores(id),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read leads"
ON public.leads FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert leads"
ON public.leads FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update leads"
ON public.leads FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to delete leads"
ON public.leads FOR DELETE
TO authenticated
USING (true);
