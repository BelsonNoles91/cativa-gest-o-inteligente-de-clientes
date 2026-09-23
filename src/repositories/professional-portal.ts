import { supabase } from "@/integrations/supabase/client";

export interface MyProfessionalProfile {
  id: string;
  tenantId: string;
  unitId: string | null;
  displayName: string;
  roleTitle: string | null;
  specialty: string | null;
  bio: string | null;
  color: string | null;
}

export interface ScheduleRequest {
  id: string;
  tenantId: string;
  professionalId: string;
  professionalName?: string | null;
  unitId: string | null;
  weekday: number;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "canceled";
  reviewNote: string | null;
  createdAt: string;
}

export async function getMyProfessional(tenantId: string): Promise<MyProfessionalProfile | null> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("professionals")
    .select("id, tenant_id, unit_id, display_name, role_title, specialty, bio, color")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    tenantId: data.tenant_id,
    unitId: data.unit_id,
    displayName: data.display_name,
    roleTitle: data.role_title,
    specialty: data.specialty,
    bio: data.bio,
    color: data.color,
  };
}

export async function listScheduleRequests(
  tenantId: string,
  options?: { professionalId?: string; onlyPending?: boolean },
): Promise<ScheduleRequest[]> {
  let q = supabase
    .from("professional_schedule_requests")
    .select(
      "id, tenant_id, professional_id, unit_id, weekday, starts_at, ends_at, reason, status, review_note, created_at, professional:professionals(display_name)",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (options?.professionalId) q = q.eq("professional_id", options.professionalId);
  if (options?.onlyPending) q = q.eq("status", "pending");
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    tenantId: r.tenant_id,
    professionalId: r.professional_id,
    professionalName:
      (r as { professional?: { display_name?: string } | null }).professional?.display_name ?? null,
    unitId: r.unit_id,
    weekday: r.weekday,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    reason: r.reason,
    status: r.status as ScheduleRequest["status"],
    reviewNote: r.review_note,
    createdAt: r.created_at,
  }));
}

export async function createScheduleRequest(input: {
  tenantId: string;
  professionalId: string;
  unitId?: string | null;
  weekday: number;
  startsAt: string;
  endsAt: string;
  reason?: string | null;
}): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("professional_schedule_requests").insert({
    tenant_id: input.tenantId,
    professional_id: input.professionalId,
    unit_id: input.unitId ?? null,
    weekday: input.weekday,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    reason: input.reason ?? null,
    requested_by: auth.user?.id ?? null,
  });
  if (error) throw error;
}

export async function approveScheduleRequest(requestId: string, note?: string): Promise<void> {
  const { error } = await supabase.rpc("approve_schedule_request", {
    _request_id: requestId,
    _note: note ?? null,
  });
  if (error) throw error;
}

export async function rejectScheduleRequest(requestId: string, note?: string): Promise<void> {
  const { error } = await supabase.rpc("reject_schedule_request", {
    _request_id: requestId,
    _note: note ?? null,
  });
  if (error) throw error;
}

export async function updateMyProfessionalDetails(input: {
  professionalId: string;
  roleTitle?: string | null;
  specialty?: string | null;
  bio?: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from("professionals")
    .update({
      role_title: input.roleTitle ?? null,
      specialty: input.specialty ?? null,
      bio: input.bio ?? null,
    })
    .eq("id", input.professionalId);
  if (error) throw error;
}
