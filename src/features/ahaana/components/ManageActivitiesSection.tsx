"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";

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

interface ActivityDefaults {
  title: string;
  category: AhaanaActivityCategory;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  startDate: string;
  endDate: string;
  planNotes: string;
  remindEnabled: boolean;
  remindLeadDays: number;
  remindLeadHours: number | null;
}

const EMPTY_DEFAULTS: ActivityDefaults = {
  title: "",
  category: "class",
  daysOfWeek: [],
  startTime: "17:00",
  endTime: "18:00",
  startDate: "",
  endDate: "",
  planNotes: "",
  remindEnabled: false,
  remindLeadDays: 0,
  remindLeadHours: null,
};

/**
 * v3.4.8 — the field set shared by the "Add Activity" form and each
 * row's inline "Edit" form: same fields either way, only the
 * pre-filled `defaults`, the wrapping `<form>`'s action, and its own
 * submit button differ between the two callers (kept in
 * AddActivityForm/EditActivityForm below, not here). `idPrefix` keeps
 * every field's `id`/`htmlFor` pair unique across however many of
 * these render on the page at once (the Add form plus one per
 * activity's own Edit form, if several are expanded at the same time).
 */
function ActivityFormFields({
  idPrefix,
  defaults,
}: {
  idPrefix: string;
  defaults: ActivityDefaults;
}) {
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(defaults.daysOfWeek);
  const [remindEnabled, setRemindEnabled] = useState(defaults.remindEnabled);
  const [remindLeadDays, setRemindLeadDays] = useState(defaults.remindLeadDays);
  const [remindLeadHours, setRemindLeadHours] = useState<number | null>(
    defaults.remindLeadHours,
  );

  function toggleDay(value: number) {
    setDaysOfWeek((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value],
    );
  }

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-title`}>Title</Label>
        <Input
          id={`${idPrefix}-title`}
          name="title"
          defaultValue={defaults.title}
          placeholder="e.g. French, Kickboxing, Horse Riding"
          required
          maxLength={200}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-category`}>Category</Label>
        <Select
          id={`${idPrefix}-category`}
          name="category"
          defaultValue={defaults.category}
        >
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
          <Label htmlFor={`${idPrefix}-startTime`}>Starts</Label>
          <Input
            id={`${idPrefix}-startTime`}
            name="startTime"
            type="time"
            required
            defaultValue={defaults.startTime}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-endTime`}>Ends</Label>
          <Input
            id={`${idPrefix}-endTime`}
            name="endTime"
            type="time"
            required
            defaultValue={defaults.endTime}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-startDate`}>From</Label>
          <Input
            id={`${idPrefix}-startDate`}
            name="startDate"
            type="date"
            required
            defaultValue={defaults.startDate}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-endDate`}>Until</Label>
          <Input
            id={`${idPrefix}-endDate`}
            name="endDate"
            type="date"
            required
            defaultValue={defaults.endDate}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-planNotes`}>
          What&apos;s expected{" "}
          <span className="font-normal text-ink-faint">(optional)</span>
        </Label>
        <Input
          id={`${idPrefix}-planNotes`}
          name="planNotes"
          defaultValue={defaults.planNotes}
          placeholder="e.g. Focus on conversational practice"
          maxLength={1000}
        />
      </div>

      <ReminderFields
        idPrefix={idPrefix}
        enabled={remindEnabled}
        onEnabledChange={setRemindEnabled}
        leadDays={remindLeadDays}
        onLeadDaysChange={setRemindLeadDays}
        leadHours={remindLeadHours}
        onLeadHoursChange={setRemindLeadHours}
        allowHourly
      />
    </>
  );
}

function AddActivityForm() {
  const [state, formAction, isPending] = useActionState(
    createAhaanaActivityAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <ActivityFormFields idPrefix="activity" defaults={EMPTY_DEFAULTS} />
      <FieldError message={state.error} />
      <Button type="submit" loading={isPending} className="w-full">
        <Plus className="size-4" /> Add activity
      </Button>
    </form>
  );
}

/**
 * v3.4.8 — the inline edit form ActivityRow expands into. Submits to
 * the same updateAhaanaActivityAction the Activate/Deactivate toggle
 * already uses, but changes the actual content fields instead of just
 * `active` — carries the CURRENT active value through unchanged (a
 * literal "true"/"false" string, not the toggle's inverted one) so
 * editing never accidentally activates/deactivates as a side effect.
 * Auto-collapses back to the read-only row on a successful save.
 */
function EditActivityForm({
  activity,
  onSaved,
  onCancel,
}: {
  activity: AhaanaActivity;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    updateAhaanaActivityAction,
    initialState,
  );

  useEffect(() => {
    if (state.success) onSaved();
    // onSaved is a fresh closure from the parent every render (it
    // updates the parent's own `editing` state) — only state.success
    // itself should ever re-trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form
      action={formAction}
      className="mt-3 space-y-3 border-t border-line pt-3"
    >
      <input type="hidden" name="id" value={activity.id} />
      <input
        type="hidden"
        name="active"
        value={activity.active ? "true" : "false"}
      />
      <ActivityFormFields
        idPrefix={`edit-${activity.id}`}
        defaults={{
          title: activity.title,
          category: activity.category,
          daysOfWeek: activity.daysOfWeek,
          startTime: activity.startTime,
          endTime: activity.endTime,
          startDate: activity.startDate,
          endDate: activity.endDate,
          planNotes: activity.planNotes ?? "",
          remindEnabled: activity.remindEnabled,
          remindLeadDays: activity.remindLeadDays,
          remindLeadHours: activity.remindLeadHours,
        }}
      />
      <FieldError message={state.error} />
      <div className="flex gap-2">
        <Button type="submit" loading={isPending} className="flex-1">
          <Check className="size-4" /> Save changes
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ActivityRow({ activity }: { activity: AhaanaActivity }) {
  const [editing, setEditing] = useState(false);
  const [toggleState, toggleAction, togglePending] = useActionState(
    updateAhaanaActivityAction,
    initialState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteAhaanaActivityAction,
    initialState,
  );

  return (
    <div className="border-b border-line px-4 py-3 last:border-b-0">
      <div className="flex items-center gap-2">
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
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          aria-label={editing ? "Close edit form" : "Edit"}
          aria-pressed={editing}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            editing
              ? "bg-accent-soft text-accent"
              : "text-ink-faint hover:bg-bg",
          )}
        >
          <Pencil className="size-4" />
        </button>
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
          {/* The one field this form actually changes — the literal
              OPPOSITE of the current value, since this button's whole
              job is to flip it. See the schema's own comment on why
              this needs to be a real "true"/"false" string now, not
              the old ""/"true" trick. */}
          <input
            type="hidden"
            name="active"
            value={activity.active ? "false" : "true"}
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
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-negative hover:bg-negative-soft disabled:opacity-50"
          >
            <Trash2 className="size-4" />
          </button>
        </form>
      </div>
      {(toggleState.error || deleteState.error) && (
        <FieldError message={toggleState.error ?? deleteState.error} />
      )}
      {editing && (
        <EditActivityForm
          activity={activity}
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
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
