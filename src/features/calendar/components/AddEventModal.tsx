"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { TAG_LABELS, type EventTag } from "@/features/calendar/data";
import {
  createCalendarEventAction,
  createRecurringCalendarEventAction,
  deleteCalendarEventAction,
  sendCalendarEventReminderNowAction,
  updateCalendarEventAction,
  type CalendarEventFormState,
  type RecurringCalendarEventFormState,
} from "@/features/calendar/api/actions";
import { DAY_OPTIONS } from "@/features/calendar/components/AddRecurringEventModal";
import {
  knownTravelers,
  travelerColorClass,
} from "@/features/travel/travelers";
import { ReminderFields } from "@/features/calendar/components/ReminderFields";
import type { CalendarEvent } from "@/services/CalendarEventService";

const initialState: CalendarEventFormState = {};
const initialRecurringState: RecurringCalendarEventFormState = {};

/** Same four categories the static school calendar already uses — "trip" is excluded (that meaning belongs to Add a trip / finance.trips, not here). Not shown at all in "Repeats weekly" mode — finance.recurring_calendar_events has no tag column. */
const EVENT_TAGS: Exclude<EventTag, "trip">[] = [
  "vacation",
  "holiday",
  "exam",
  "event",
];

const DEFAULT_START_TIME = "08:00";
const DEFAULT_END_TIME = "09:30";

/**
 * The free-text sibling to AddTripModal (v1.1.5) — a trip needs a
 * destination, flight, and travellers; a plain calendar entry ("Dinner
 * with someone") needs none of that, just a title, a category, and a
 * date range. Deliberately a separate, smaller modal rather than
 * folding a "what kind of thing is this" branch into AddTripModal,
 * which is already the more complex of the two (PDF upload, traveller
 * tagging) and shouldn't also carry an unrelated free-text-event mode.
 *
 * v1.1.6: gained the same people-tagging UI AddTripModal already had —
 * same knownTravelers()/travelerColorClass toggle-chip + custom-add
 * pattern, just optional here (an event doesn't need anyone tagged to
 * be worth saving, unlike a trip).
 *
 * v3.3.0: gained a "Repeats weekly" toggle (household request — "allow
 * to make the event as recurring between the event dialogue box, no
 * need to add a separate section") so creating a recurring rule no
 * longer needs its own entry point in Log; AddRecurringEventModal
 * itself is unchanged and still handles EDITING an existing rule
 * (tapped from the grid/week view/Recurring events list) — this
 * toggle is add-flow only (`!isEditing`), since turning an existing
 * single event into a recurring rule mid-edit has no sane, obvious
 * meaning (delete the event and create a rule? silently do nothing?).
 * Toggling it on switches which server action the same form submits
 * to (createRecurringCalendarEventAction instead of
 * createCalendarEventAction) and swaps a few fields: the Category
 * select disappears (recurring rules have no tag column), a day-of-week
 * picker and an "Ends" time appear alongside the existing Start
 * time/date fields (reusing AddRecurringEventModal's own DAY_OPTIONS
 * rather than a second copy), and Start/End date read as "From"/"Until"
 * instead of a single occurrence's own span. Both action shapes happen
 * to share almost every other field name (title, people, notes,
 * remindEnabled/remindLeadDays/remindLeadHours, startDate, endDate,
 * startTime) — only mode/daysOfWeek/endTime are recurring-specific
 * additions, rendered conditionally into the same <form>.
 *
 * Uses the same direct-await + synchronous isSubmitting-guard pattern
 * AddTripModal was rewritten to use in v1.1.1, for the same reason:
 * useActionState's close-on-success effect could miss a state update
 * across a revalidatePath-triggered remount and leave the modal open
 * and resubmittable.
 *
 * v3.4.13: gained a "Send reminder now" button (edit mode only) — a
 * genuinely manual, on-demand Telegram push for this one event,
 * independent of its remindEnabled/remindLeadDays settings entirely.
 * Disabled unless `isLoggedIn` (this modal is reachable from the
 * PUBLIC /calendar page — see CalendarPage's own comment for where
 * that prop comes from); the real enforcement is server-side, in
 * sendCalendarEventReminderNowAction itself, since a disabled
 * attribute is a UI nicety, not a security boundary.
 */
export function AddEventModal({
  open,
  onClose,
  editingEvent,
  initialDate,
  isLoggedIn,
}: {
  open: boolean;
  onClose: () => void;
  editingEvent: CalendarEvent | null;
  initialDate?: string;
  isLoggedIn: boolean;
}) {
  const isEditing = editingEvent !== null;

  const [title, setTitle] = useState("");
  const [tag, setTag] = useState<Exclude<EventTag, "trip">>("event");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [customPerson, setCustomPerson] = useState("");
  const [extraPeopleOptions, setExtraPeopleOptions] = useState<string[]>([]);
  const [remindEnabled, setRemindEnabled] = useState(false);
  const [remindLeadDays, setRemindLeadDays] = useState(0);
  // v3.2.2 — startTime is optional (an event doesn't have to carry a
  // specific time to be worth saving); remindLeadHours can only be set
  // once a time exists to count backward from, so clearing the time
  // also clears any active hour-based reminder rather than leaving it
  // silently pointing at nothing.
  const [startTime, setStartTime] = useState("");
  const [remindLeadHours, setRemindLeadHours] = useState<number | null>(null);

  // v3.3.0 — "Repeats weekly" mode. Add-flow only (never toggled on
  // while isEditing) — see the component comment.
  const [isRecurring, setIsRecurring] = useState(false);
  const [mode, setMode] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [endTime, setEndTime] = useState(DEFAULT_END_TIME);

  function handleStartTimeChange(value: string) {
    setStartTime(value);
    if (!value) setRemindLeadHours(null);
  }

  function handleRecurringToggle(value: boolean) {
    setIsRecurring(value);
    if (value) {
      // A recurring rule requires both times, unlike a one-off event's
      // optional single startTime — default them in rather than
      // forcing an empty required field on the person the moment they
      // flip this on.
      if (!startTime) setStartTime(DEFAULT_START_TIME);
      if (!endTime) setEndTime(DEFAULT_END_TIME);
    }
  }

  function toggleDay(value: number) {
    setDaysOfWeek((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value],
    );
  }

  useEffect(() => {
    if (!open) return;
    // Reset submission/delete status every time the modal opens, not
    // just the form fields below — this component stays mounted (just
    // hidden via `if (!open) return null`) across an open/close cycle,
    // so without this a successful save leaves isSubmitting stuck
    // `true` forever (onClose() never reset it), silently blocking
    // every future submit via the `if (isSubmitting) return;` guard.
    setIsSubmitting(false);
    setFormError(undefined);
    setIsDeleting(false);
    setDeleteError(undefined);
    setIsSendingReminder(false);
    setReminderError(undefined);
    setReminderMessage(undefined);
    setIsRecurring(false);
    setMode("");
    setDaysOfWeek([]);
    setEndTime(DEFAULT_END_TIME);
    if (editingEvent) {
      setTitle(editingEvent.title);
      setTag(editingEvent.tag);
      setStartDate(editingEvent.startDate);
      setEndDate(editingEvent.endDate);
      setNotes(editingEvent.notes ?? "");
      setSelectedPeople(editingEvent.people);
      setExtraPeopleOptions(editingEvent.people);
      setRemindEnabled(editingEvent.remindEnabled);
      setRemindLeadDays(editingEvent.remindLeadDays);
      setStartTime(editingEvent.startTime ?? "");
      setRemindLeadHours(editingEvent.remindLeadHours);
    } else {
      setTitle("");
      setTag("event");
      setStartDate(initialDate ?? "");
      setEndDate(initialDate ?? "");
      setNotes("");
      setSelectedPeople([]);
      setExtraPeopleOptions([]);
      setRemindEnabled(false);
      setRemindLeadDays(0);
      setStartTime("");
      setRemindLeadHours(null);
    }
  }, [open, editingEvent, initialDate]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>(undefined);
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [reminderError, setReminderError] = useState<string | undefined>(
    undefined,
  );
  const [reminderMessage, setReminderMessage] = useState<string | undefined>(
    undefined,
  );

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setFormError(undefined);

    const formData = new FormData(event.currentTarget);

    if (!isEditing && isRecurring) {
      const result = await createRecurringCalendarEventAction(
        initialRecurringState,
        formData,
      );
      if (result.success) {
        onClose();
        return;
      }
      setFormError(result.error);
      setIsSubmitting(false);
      return;
    }

    const action = isEditing
      ? updateCalendarEventAction
      : createCalendarEventAction;
    const result = await action(initialState, formData);

    if (result.success) {
      onClose();
      return;
    }
    setFormError(result.error);
    setIsSubmitting(false);
  }

  async function handleDelete() {
    if (!editingEvent || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(undefined);

    const formData = new FormData();
    formData.set("id", editingEvent.id);
    const result = await deleteCalendarEventAction(initialState, formData);

    if (result.success) {
      onClose();
      return;
    }
    setDeleteError(result.error);
    setIsDeleting(false);
  }

  async function handleSendReminderNow() {
    if (!editingEvent || isSendingReminder) return;
    setIsSendingReminder(true);
    setReminderError(undefined);
    setReminderMessage(undefined);

    const formData = new FormData();
    formData.set("id", editingEvent.id);
    const result = await sendCalendarEventReminderNowAction({}, formData);

    setIsSendingReminder(false);
    if (result.error) {
      setReminderError(result.error);
      return;
    }
    setReminderMessage(result.message);
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

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-[480px] overflow-y-auto rounded-t-[22px] bg-surface p-5 sm:rounded-[22px] sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-[17px] font-extrabold text-ink">
            {isEditing ? "Edit event" : "Add event"}
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
            <input type="hidden" name="id" value={editingEvent.id} />
          )}

          <div className="space-y-1.5">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              name="title"
              placeholder="e.g. Dinner with the Sharmas"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {!isRecurring && (
            <div className="space-y-1.5">
              <Label htmlFor="event-tag">Category</Label>
              <Select
                id="event-tag"
                name="tag"
                required
                value={tag}
                onChange={(e) =>
                  setTag(e.target.value as Exclude<EventTag, "trip">)
                }
              >
                {EVENT_TAGS.map((t) => (
                  <option key={t} value={t}>
                    {TAG_LABELS[t]}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {/* Same grid-cols-1 sm:grid-cols-2 stacking as AddTripModal's
              Departs/Returns fields (v1.1.1) — each date field gets the
              full row width on narrow screens rather than sharing one. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="event-startDate">
                {isRecurring ? "From" : "Start date"}
              </Label>
              <Input
                id="event-startDate"
                name="startDate"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-endDate">
                {isRecurring ? "Until" : "End date"}
              </Label>
              <Input
                id="event-endDate"
                name="endDate"
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          {isRecurring && (
            <p className="-mt-2 text-[11px] leading-relaxed text-ink-faint">
              Tip: match &ldquo;Until&rdquo; to the semester&apos;s
              instructional weeks so this stops appearing on its own once the
              break or the semester ends — there&apos;s no separate pause step.
            </p>
          )}

          {isRecurring ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="event-startTime">Starts</Label>
                <Input
                  id="event-startTime"
                  name="startTime"
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-endTime">Ends</Label>
                <Input
                  id="event-endTime"
                  name="endTime"
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="event-startTime">
                Time{" "}
                <span className="font-normal text-ink-faint">
                  (optional — needed for an hours-before reminder)
                </span>
              </Label>
              <Input
                id="event-startTime"
                name="startTime"
                type="time"
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
              />
            </div>
          )}

          {isRecurring && (
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
          )}

          {isRecurring && (
            <div className="space-y-1.5">
              <Label htmlFor="event-mode">
                Mode{" "}
                <span className="font-normal text-ink-faint">(optional)</span>
              </Label>
              <Input
                id="event-mode"
                name="mode"
                placeholder="e.g. Online, Offline"
                maxLength={40}
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              />
            </div>
          )}

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

          <ReminderFields
            idPrefix="event"
            enabled={remindEnabled}
            onEnabledChange={setRemindEnabled}
            leadDays={remindLeadDays}
            onLeadDaysChange={setRemindLeadDays}
            leadHours={remindLeadHours}
            onLeadHoursChange={setRemindLeadHours}
            allowHourly={Boolean(startTime)}
          />

          {isEditing && (
            <div className="space-y-1.5 rounded-[14px] border-[1.5px] border-line p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display text-[13px] font-bold text-ink">
                    Send reminder now
                  </div>
                  <div className="mt-0.5 text-[11px] text-ink-faint">
                    Push this event to Telegram right away, regardless of its
                    reminder settings above.
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={isSendingReminder}
                  disabled={!isLoggedIn}
                  onClick={handleSendReminderNow}
                >
                  Send now
                </Button>
              </div>
              {!isLoggedIn && (
                <p className="text-[11px] text-ink-faint">
                  Log in to the main app to use this.
                </p>
              )}
              {reminderMessage && (
                <p className="text-[12px] font-semibold text-positive">
                  {reminderMessage}
                </p>
              )}
              <FieldError message={reminderError} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="event-notes">
              Notes{" "}
              <span className="font-normal text-ink-faint">(optional)</span>
            </Label>
            <Input
              id="event-notes"
              name="notes"
              placeholder="e.g. 7pm, their place"
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {!isEditing && (
            <label
              htmlFor="event-isRecurring"
              className="flex cursor-pointer items-center gap-2.5 rounded-[14px] border-[1.5px] border-line p-3"
            >
              <input
                id="event-isRecurring"
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => handleRecurringToggle(e.target.checked)}
                className="size-[18px] shrink-0 accent-accent"
              />
              <div className="min-w-0 flex-1">
                <div className="font-display text-[13px] font-bold text-ink">
                  Repeats weekly
                </div>
                <div className="mt-0.5 text-[11px] text-ink-faint">
                  A class, a standing appointment — pick days, a time range, and
                  how long it should run for
                </div>
              </div>
            </label>
          )}

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
              {isRecurring ? "Save recurring event" : "Save event"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
