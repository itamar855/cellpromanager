-- Phase 3: Conciliação Bancária
ALTER TABLE "public"."transactions" ADD COLUMN IF NOT EXISTS "reconciled" boolean DEFAULT false;
