"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  createRecurringCalendarEventAction,
  deleteRecurringCalendarEventAction,
  updateRecurringCalendarEventAction,
  type RecurringCalendarEventFormState,
} from "@/features/calendar/api/actions";
import {
  knownTravelers,
  travelerColorClass,
} from "@/features/travel/travelers";
import type { RecurringCalendarEvent } from "@/services/RecurringCalendarEventService";

const initialState: RecurringCalendarEventFormState = {};

/** Displayed Monday-first (matching the rest of the calendar UI's
 * Monday-start grid), but the stored value is 0=Sunday..6=Saturday —
 * see the finance.recurring_calendar_events migration comment. */
const DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "M" },
  { value: 2, label: "T" },
  { value: 3, label: "W" },
  { value: 4, label: "T" },
  { value: 5, label: "F" },
  { value: 6, label: "S" },
  { value: 0, label: "S" },
];

/**
 * The "Add recurring event" modal (v2.2.0) — a weekly-repeating rule
 * (title, one or more days of week, one time range, an optional
 * free-text mode tag, a bounded start/end date), not a single date. See
 * the /calendar brainstorm this shipped from for why it's general-purpose
 * rather than class-schedule-specific.
 *
 * Same direct-await + synchronous isSubmitting-guard pattern as
 * AddEventModal/AddTripModal (v1.1.1) for the same reason: useActionState's
 * close-on-success effect can miss a state update across a
 * revalidatePath-triggered remount and leave the modal open and
 * resubmittable.
 */
export function AddRecurringEventModal({
  open,
  onClose,
  editingRule,
}: {
  open: boolean;
  onClose: () => void;
  editingRule: RecurringCalendarEvent | null;
}) {
  const isEditing = editingRule !== null;

  const [title, setTitle] = useState("");
  const [mode, setMode] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:30");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [customPerson, setCustomPerson] = useState("");
  const [extraPeopleOptions, setExtraPeopleOptions] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    // Reset submission/delete status every time the modal opens, not
    // just the form fields below — this component stays mounted (just
    // hidden via `if (!open) return null`) across an open/close cycle,
    // so without this a successful save leaves isSubmitting stuck
    // `true` forever (onClose() never reset it), silently blocking
    // every future submit via the `if (isSubmitting) return;` guard —
    // exactly the "Save recurring event just spins" bug this fixes.
    setIsSubmitting(false);
    setFormError(undefined);
    setIsDeleting(false);
    setDeleteError(undefined);
    if (editingRule) {
      setTitle(editingRule.title);
      setMode(editingRule.mode ?? "");
      setDaysOfWeek(editingRule.daysOfWeek);
      setStartTime(editingRule.startTime);
      setEndTime(editingRule.endTime);
      setStartDate(editingRule.startDate);
      setEndDate(editingRule.endDate);
      setNotes(editingRule.notes ?? "");
      setSelectedPeople(editingRule.people);
      setExtraPeopleOptions(editingRule.people);
    } else {
      setTitle("");
      setMode("");
      setDaysOfWeek([]);
      setStartTime("08:00");
      setEndTime("09:30");
      setStartDate("");
      setEndDate("");
      setNotes("");
      setSelectedPeople([]);
      setExtraPeopleOptions([]);
    }
  }, [open, editingRule]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>(undefined);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setFormError(undefined);

    const formData = new FormData(event.currentTarget);
    const action = isEditing
      ? updateRecurringCalendarEventAction
      : createRecurringCalendarEventAction;
    const result = await action(initialState, formData);

    if (result.success) {
      onClose();
      return;
    }
    setFormError(result.error);
    setIsSubmitting(false);
  }

  async function handleDelete() {
    if (!editingRule || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(undefined);

    const formData = new FormData();
    formData.set("id", editingRule.id);
    const result = await deleteRecurringCalendarEventAction(
      initialState,
      formData,
    );

    if (result.success) {
      onClose();
      return;
    }
    setDeleteError(result.error);
    setIsDeleting(false);
  }

  const peopleOptions = Array.from(
    new Set([...knownTravelers(), ...extraPeopleOptions]),
  );

  function togglePerson(name: string) {
    setSelectedPeople((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  }

  function addCustomPerson() {
    const name = customPerson.trim();
    if (!name) return;
    setExtraPeopleOptions((prev) =>
      prev.includes(name) ? prev : [...prev, name],
    );
    setSelectedPeople((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setCustomPerson("");
  }

  function toggleDay(value: number) {
    setDaysOfWeek((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value],
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-[480px] overflow-y-auto rounded-t-[22px] bg-surface p-5 sm:rounded-[22px] sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-[17px] font-extrabold text-ink">
            {isEditing ? "Edit recurring event" : "Add recurring event"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-7 items-center justify-center rounded-full bg-bg text-ink-soft"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {isEditing && (
            <input type="hidden" name="id" value={editingRule.id} />
          )}

          <div className="space-y-1.5">
            <Label htmlFor="recurring-title">Title</Label>
            <Input
              id="recurring-title"
              name="title"
              placeholder="e.g. Calculus"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              Who&apos;s this for{" "}
              <span className="font-normal text-ink-faint">(optional)</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {peopleOptions.map((name) => {
                const selected = selectedPeople.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => togglePerson(name)}
                    className={cn(
                      "rounded-full border-[1.5px] border-line px-3 py-1.5 font-display text-xs font-bold text-ink-soft",
                      selected &&
                        cn(
                          "border-transparent text-white",
                          travelerColorClass(name),
                        ),
                    )}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
            {selectedPeople.map((name) => (
              <input key={name} type="hidden" name="people" value={name} />
            ))}
            <div className="flex gap-2 pt-1">
              <Input
                placeholder="Add someone else…"
                value={customPerson}
                onChange={(e) => setCustomPerson(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomPerson();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addCustomPerson}>
                Add
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="recurring-mode">
              Mode{" "}
              <span className="font-normal text-ink-faint">(optional)</span>
            </Label>
            <Input
              id="recurring-mode"
              name="mode"
              placeholder="e.g. Online, Offline"
              maxLength={40}
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            />
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
                      selected
                        ? "bg-accent text-white"
                        : "bg-bg text-ink-faint",
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
              <Label htmlFor="recurring-startTime">Starts</Label>
              <Input
                id="recurring-startTime"
                name="startTime"
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recurring-endTime">Ends</Label>
              <Input
                id="recurring-endTime"
                name="endTime"
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="recurring-startDate">From</Label>
              <Input
                id="recurring-startDate"
                name="startDate"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recurring-endDate">Until</Label>
              <Input
                id="recurring-endDate"
                name="endDate"
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-ink-faint">
            Tip: match &ldquo;Until&rdquo; to the semester&apos;s instructional
            weeks so this stops appearing on its own once the break or the
            semester ends — there&apos;s no separate pause step.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="recurring-notes">
              Notes{" "}
              <span className="font-normal text-ink-faint">(optional)</span>
            </Label>
            <Input
              id="recurring-notes"
              name="notes"
              placeholder="e.g. Zoom link in the NUS LMS"
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <FieldError message={formError} />
          <FieldError message={deleteError} />

          <div className="flex gap-2.5 pt-1">
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                loading={isDeleting}
                onClick={handleDelete}
              >
                Delete
              </Button>
            )}
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              Save recurring event
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
