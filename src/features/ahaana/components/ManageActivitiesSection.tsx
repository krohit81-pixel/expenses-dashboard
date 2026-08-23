"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SectionHeading } from "@/features/dashboard/components/SectionHeading";
import { ReminderFields } from "@/features/calendar/components/ReminderFields";
import { cn } from "@/lib/utils";
import {
  createAhaanaActivityAction,
  deleteAhaanaActivityAction,
  updateAhaanaActivityAction,
  type AhaanaActivityFormState,
} from "@/features/ahaana/api/activity-actions";
import type {
  AhaanaActivity,
  AhaanaActivityCategory,
} from "@/services/AhaanaActivityService";

const DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "M" },
  { value: 2, label: "T" },
  { value: 3, label: "W" },
  { value: 4, label: "T" },
  { value: 5, label: "F" },
  { value: 6, label: "S" },
  { value: 0, label: "S" },
];

const CATEGORY_OPTIONS: { value: AhaanaActivityCategory; label: string }[] = [
  { value: "class", label: "Class" },
  { value: "sport", label: "Sport" },
  { value: "study", label: "Study" },
  { value: "other", label: "Other" },
];

const initialState: AhaanaActivityFormState = {};

function AddActivityForm() {
  const [state, formAction, isPending] = useActionState(
    createAhaanaActivityAction,
    initialState,
  );
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [remindEnabled, setRemindEnabled] = useState(false);
  const [remindLeadDays, setRemindLeadDays] = useState(0);
  const [remindLeadHours, setRemindLeadHours] = useState<number | null>(null);

  function toggleDay(value: number) {
    setDaysOfWeek((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value],
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="activity-title">Title</Label>
        <Input
          id="activity-title"
          name="title"
          placeholder="e.g. French, Kickboxing, Horse Riding"
          required
          maxLength={200}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="activity-category">Category</Label>
        <Select id="activity-category" name="category" defaultValue="class">
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Days of week</Label>
        <div className="flex gap-1.5">
          {DAY_OPTIONS.map((day) => {
            const selected = daysOfWeek.includes(day.value);
            return (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleDay(day.value)}
                aria-pressed={selected}
                className={cn(
                  "flex size-9 items-center justify-center rounded-full font-display text-xs font-bold",
                  selected ? "bg-accent text-white" : "bg-bg text-ink-faint",
                )}
              >
                {day.label}
              </button>
            );
          })}
        </div>
        {daysOfWeek.map((d) => (
          <input key={d} type="hidden" name="daysOfWeek" value={d} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="activity-startTime">Starts</Label>
          <Input
            id="activity-startTime"
            name="startTime"
            type="time"
            required
            defaultValue="17:00"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="activity-endTime">Ends</Label>
          <Input
            id="activity-endTime"
            name="endTime"
            type="time"
            required
            defaultValue="18:00"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="activity-startDate">From</Label>
          <Input
            id="activity-startDate"
            name="startDate"
            type="date"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="activity-endDate">Until</Label>
          <Input id="activity-endDate" name="endDate" type="date" required />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="activity-planNotes">
          What&apos;s expected{" "}
          <span className="font-normal text-ink-faint">(optional)</span>
        </Label>
        <Input
          id="activity-planNotes"
          name="planNotes"
          placeholder="e.g. Focus on conversational practice"
          maxLength={1000}
        />
      </div>

      <ReminderFields
        idPrefix="activity"
        enabled={remindEnabled}
        onEnabledChange={setRemindEnabled}
        leadDays={remindLeadDays}
        onLeadDaysChange={setRemindLeadDays}
        leadHours={remindLeadHours}
        onLeadHoursChange={setRemindLeadHours}
        allowHourly
      />

      <FieldError message={state.error} />
      <Button type="submit" loading={isPending} className="w-full">
        <Plus className="size-4" /> Add activity
      </Button>
    </form>
  );
}

function ActivityRow({ activity }: { activity: AhaanaActivity }) {
  const [toggleState, toggleAction, togglePending] = useActionState(
    updateAhaanaActivityAction,
    initialState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteAhaanaActivityAction,
    initialState,
  );

  return (
    <div className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[13px] font-bold text-ink">
          {activity.title}
        </div>
        <div className="text-[11px] text-ink-faint">
          {activity.category} · {activity.startTime}–{activity.endTime}
          {activity.remindEnabled &&
            ` · 🔔 ${
              activity.remindLeadHours !== null
                ? `${activity.remindLeadHours}h before`
                : activity.remindLeadDays === 0
                  ? "on the day"
                  : `${activity.remindLeadDays}d before`
            }`}
          {!activity.active && " · inactive"}
        </div>
      </div>
      <form action={toggleAction}>
        <input type="hidden" name="id" value={activity.id} />
        <input type="hidden" name="title" value={activity.title} />
        <input type="hidden" name="category" value={activity.category} />
        {activity.daysOfWeek.map((d) => (
          <input key={d} type="hidden" name="daysOfWeek" value={d} />
        ))}
        <input type="hidden" name="startTime" value={activity.startTime} />
        <input type="hidden" name="endTime" value={activity.endTime} />
        <input type="hidden" name="startDate" value={activity.startDate} />
        <input type="hidden" name="endDate" value={activity.endDate} />
        <input
          type="hidden"
          name="planNotes"
          value={activity.planNotes ?? ""}
        />
        {activity.remindEnabled && (
          <input type="hidden" name="remindEnabled" value="true" />
        )}
        <input
          type="hidden"
          name="remindLeadDays"
          value={activity.remindLeadDays}
        />
        <input
          type="hidden"
          name="remindLeadHours"
          value={activity.remindLeadHours ?? ""}
        />
        <input
          type="hidden"
          name="active"
          value={activity.active ? "" : "true"}
        />
        <Button type="submit" variant="outline" loading={togglePending}>
          {activity.active ? "Deactivate" : "Activate"}
        </Button>
      </form>
      <form action={deleteAction}>
        <input type="hidden" name="id" value={activity.id} />
        <button
          type="submit"
          disabled={deletePending}
          aria-label="Delete"
          className="flex size-9 items-center justify-center rounded-full text-negative hover:bg-negative-soft disabled:opacity-50"
        >
          <Trash2 className="size-4" />
        </button>
      </form>
      {(toggleState.error || deleteState.error) && (
        <FieldError message={toggleState.error ?? deleteState.error} />
      )}
    </div>
  );
}

export function ManageActivitiesSection({
  activities,
}: {
  activities: AhaanaActivity[];
}) {
  return (
    <div className="space-y-6">
      <section>
        <SectionHeading index="01" title="Add Activity" />
        <div className="rounded-[20px] bg-surface p-5 shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
          <AddActivityForm />
        </div>
      </section>

      <section>
        <SectionHeading
          index="02"
          title="Your Activities"
          meta={`${activities.length}`}
        />
        {activities.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-line p-6 text-center text-[12.5px] text-ink-faint">
            Nothing added yet.
          </div>
        ) : (
          <div className="rounded-[20px] bg-surface shadow-[0_1px_2px_rgba(28,20,36,0.04),0_4px_14px_rgba(28,20,36,0.05)]">
            {activities.map((activity) => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
