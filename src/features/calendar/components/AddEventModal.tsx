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
  deleteCalendarEventAction,
  updateCalendarEventAction,
  type CalendarEventFormState,
} from "@/features/calendar/api/actions";
import {
  knownTravelers,
  travelerColorClass,
} from "@/features/travel/travelers";
import type { CalendarEvent } from "@/services/CalendarEventService";

const initialState: CalendarEventFormState = {};

/** Same four categories the static school calendar already uses — "trip" is excluded (that meaning belongs to Add a trip / finance.trips, not here). */
const EVENT_TAGS: Exclude<EventTag, "trip">[] = [
  "vacation",
  "holiday",
  "exam",
  "event",
];

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
 * Uses the same direct-await + synchronous isSubmitting-guard pattern
 * AddTripModal was rewritten to use in v1.1.1, for the same reason:
 * useActionState's close-on-success effect could miss a state update
 * across a revalidatePath-triggered remount and leave the modal open
 * and resubmittable.
 */
export function AddEventModal({
  open,
  onClose,
  editingEvent,
  initialDate,
}: {
  open: boolean;
  onClose: () => void;
  editingEvent: CalendarEvent | null;
  initialDate?: string;
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

  useEffect(() => {
    if (!open) return;
    if (editingEvent) {
      setTitle(editingEvent.title);
      setTag(editingEvent.tag);
      setStartDate(editingEvent.startDate);
      setEndDate(editingEvent.endDate);
      setNotes(editingEvent.notes ?? "");
      setSelectedPeople(editingEvent.people);
      setExtraPeopleOptions(editingEvent.people);
    } else {
      setTitle("");
      setTag("event");
      setStartDate(initialDate ?? "");
      setEndDate(initialDate ?? "");
      setNotes("");
      setSelectedPeople([]);
      setExtraPeopleOptions([]);
    }
  }, [open, editingEvent, initialDate]);

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

          {/* Same grid-cols-1 sm:grid-cols-2 stacking as AddTripModal's
              Departs/Returns fields (v1.1.1) — each date field gets the
              full row width on narrow screens rather than sharing one. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="event-startDate">Start date</Label>
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
              <Label htmlFor="event-endDate">End date</Label>
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
              Save event
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
