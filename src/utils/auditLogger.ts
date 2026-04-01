import { supabase } from "@/integrations/supabase/client";

export type AuditAction = 
  | "CREATE_SALE" 
  | "UPDATE_OS_STATUS" 
  | "UPDATE_PRODUCT_PRICE" 
  | "CREATE_RECORD"
  | "UPDATE_RECORD"
  | "DELETE_RECORD" 
  | "LOGIN" 
  | "TRANSFER_STOCK";

export const logAction = async (
  action: AuditAction,
  entityType?: string,
  entityId?: string,
  oldValues?: any,
  newValues?: any,
  storeId?: string | null
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let finalStoreId = storeId;
    if (!finalStoreId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("store_id")
        .eq("user_id", user.id)
        .maybeSingle();
      finalStoreId = profile?.store_id;
    }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      store_id: finalStoreId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      before_state: oldValues,
      after_state: newValues,
    });
  } catch (error) {
    console.error("Failed to log action:", error);
  }
};
