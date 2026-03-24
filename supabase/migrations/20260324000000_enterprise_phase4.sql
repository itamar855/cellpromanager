-- Phase 4: Estoque e CRM (Webhooks & Product History)

CREATE TABLE IF NOT EXISTS "public"."product_history" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "product_id" uuid NOT NULL,
    "action" text NOT NULL,
    "old_cost" numeric,
    "new_cost" numeric,
    "notes" text,
    "created_by" uuid NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "product_history_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."product_history" ADD CONSTRAINT "product_history_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS "public"."webhooks" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "store_id" uuid NOT NULL,
    "event_type" text NOT NULL,
    "url" text NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."webhooks" ADD CONSTRAINT "webhooks_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;
