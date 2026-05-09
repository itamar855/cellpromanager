CREATE TABLE IF NOT EXISTS public.device_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name TEXT NOT NULL,
    client_phone TEXT NOT NULL,
    client_email TEXT,
    device_model TEXT NOT NULL,
    device_condition TEXT,
    expected_value DECIMAL,
    notes TEXT,
    photos TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Access control
ALTER TABLE public.device_evaluations ENABLE ROW LEVEL SECURITY;

-- Allow public insertion (for the public page)
CREATE POLICY "Allow public insert evaluations"
ON public.device_evaluations FOR INSERT
TO public
WITH CHECK (true);

-- Allow authenticated to read
CREATE POLICY "Allow authenticated read evaluations"
ON public.device_evaluations FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated update evaluations"
ON public.device_evaluations FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated delete evaluations"
ON public.device_evaluations FOR DELETE
TO authenticated
USING (true);

-- Storage bucket for device evaluations photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('device_evaluations', 'device_evaluations', true) 
ON CONFLICT (id) DO NOTHING;

-- Policies for storage
CREATE POLICY "Allow public photo uploads"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'device_evaluations');

CREATE POLICY "Allow public to view photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'device_evaluations');
