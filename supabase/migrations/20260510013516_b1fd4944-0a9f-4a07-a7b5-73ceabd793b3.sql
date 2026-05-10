ALTER TABLE public.leads 
ADD CONSTRAINT leads_assigned_to_fkey 
FOREIGN KEY (assigned_to) 
REFERENCES public.profiles(user_id)
ON DELETE SET NULL;