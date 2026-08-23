import type { Metadata } from "next";

import { listAhaanaActivities } from "@/services/AhaanaActivityService";
import { ManageActivitiesSection } from "@/features/ahaana/components/ManageActivitiesSection";

export const metadata: Metadata = {
  title: "Log Activity",
};

/**
 * v3.4.0 — the "set once" side of French/kickboxing/horse riding/study
 * blocks: add, edit, deactivate, or delete a recurring activity.
 * v3.4.8 — the "Log Activity" tab (renamed from "Manage Activities" to
 * match the household's own naming for it) and added a proper Edit
 * flow — ActivityRow's own inline form, see
 * ManageActivitiesSection.tsx.
 */
export default async function AhaanaManagePage() {
  const activities = await listAhaanaActivities();

  return <ManageActivitiesSection activities={activities} />;
}
