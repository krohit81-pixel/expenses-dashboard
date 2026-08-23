import type { Metadata } from "next";

import { listAhaanaActivities } from "@/services/AhaanaActivityService";
import { ManageActivitiesSection } from "@/features/ahaana/components/ManageActivitiesSection";

export const metadata: Metadata = {
  title: "Manage Activities",
};

/** v3.4.0 — the "set once" side of French/kickboxing/horse riding/study blocks: add a recurring activity, deactivate or delete an existing one. Editing an existing activity's own fields isn't in this first pass (deactivate + re-add covers it for now) — kept simple deliberately. */
export default async function AhaanaManagePage() {
  const activities = await listAhaanaActivities();

  return <ManageActivitiesSection activities={activities} />;
}
