
-- Migration: WhatsApp Professional API & Financial Intelligence (Fixed Expenses)
-- Created: 2026-03-31

-- 1. WhatsApp Configuration Table
CREATE TABLE IF NOT EXISTS public.whatsapp_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    api_url TEXT NOT NULL,
    api_key TEXT NOT NULL,
    instance_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(store_id)
);

-- 2. Fixed Expenses Table
CREATE TABLE IF NOT EXISTS public.fixed_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    category TEXT,
    due_day INTEGER CHECK (due_day >= 1 AND due_day <= 31),
    is_pf BOOLEAN DEFAULT false,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Update Leads table for Multi-Agent support
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT now();

-- 4. Update Lead Messages for Media and Sender support
ALTER TABLE public.lead_messages ADD COLUMN IF NOT EXISTS sender_user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.lead_messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';
ALTER TABLE public.lead_messages ADD COLUMN IF NOT EXISTS media_url TEXT;

-- 5. Enable RLS
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_expenses ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for whatsapp_config
CREATE POLICY "Admins can manage whatsapp_config" ON public.whatsapp_config
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can view whatsapp_config" ON public.whatsapp_config
    FOR SELECT TO authenticated USING (true);

-- 7. RLS Policies for fixed_expenses
CREATE POLICY "Users can view own fixed_expenses or admin" ON public.fixed_expenses
    FOR SELECT USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can manage own fixed_expenses" ON public.fixed_expenses
    FOR ALL USING (created_by = auth.uid());

-- 8. Storage Bucket for Chat Media
-- This part might require manual execution in Supabase Dashboard if the DB user doesn't have permissions to storage schema
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat_media', 'chat_media', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for chat_media
CREATE POLICY "Public Access to chat_media" ON storage.objects
    FOR SELECT USING (bucket_id = 'chat_media');
CREATE POLICY "Authenticated can upload to chat_media" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat_media');

-- 9. Trigger for updated_at in whatsapp_config
CREATE TRIGGER update_whatsapp_config_updated_at 
BEFORE UPDATE ON public.whatsapp_config 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
