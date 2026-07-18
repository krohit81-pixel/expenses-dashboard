"use client";

import { useActionState, useEffect, useState } from "react";
import { Sparkles, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  createTripAction,
  deleteTripAction,
  updateTripAction,
  type TripFormState,
} from "@/features/travel/api/actions";
import { parseItineraryText } from "@/features/travel/parse-itinerary";
import {
  knownTravelers,
  travelerColorClass,
} from "@/features/travel/travelers";
import type { Trip } from "@/services/TripService";

const initialTripState: TripFormState = {};

export function AddTripModal({
  open,
  onClose,
  editingTrip,
  initialDate,
  defaultEntryTab = "upload",
}: {
  open: boolean;
  onClose: () => void;
  editingTrip: Trip | null;
  initialDate?: string;
  defaultEntryTab?: "upload" | "manual";
}) {
  const isEditing = editingTrip !== null;

  const [entryTab, setEntryTab] = useState<"upload" | "manual">("upload");
  const [isParsing, setIsParsing] = useState(false);
  const [parseNote, setParseNote] = useState<string | null>(null);

  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [flight, setFlight] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedTravelers, setSelectedTravelers] = useState<string[]>([]);
  const [customTraveler, setCustomTraveler] = useState("");
  const [extraTravelerOptions, setExtraTravelerOptions] = useState<string[]>(
    [],
  );

  // Re-seed every field whenever the modal opens (or switches between add
  // and edit) rather than only on mount — this is a modal that gets
  // reused across many open/close cycles, not remounted each time, so
  // useState's initial value alone wouldn't pick up a newly-clicked trip.
  useEffect(() => {
    if (!open) return;
    if (editingTrip) {
      setDestination(editingTrip.destination);
      setStartDate(editingTrip.startDate);
      setEndDate(editingTrip.endDate);
      setFlight(editingTrip.flight ?? "");
      setNotes(editingTrip.notes ?? "");
      setSelectedTravelers(editingTrip.travelerNames);
      setExtraTravelerOptions(editingTrip.travelerNames);
    } else {
      setDestination("");
      setStartDate(initialDate ?? "");
      setEndDate(initialDate ?? "");
      setFlight("");
      setNotes("");
      setSelectedTravelers([]);
      setExtraTravelerOptions([]);
      setEntryTab(defaultEntryTab);
    }
    setParseNote(null);
  }, [open, editingTrip, initialDate, defaultEntryTab]);

  const [createState, createFormAction, isCreating] = useActionState(
    createTripAction,
    initialTripState,
  );
  const [updateState, updateFormAction, isUpdating] = useActionState(
    updateTripAction,
    initialTripState,
  );
  const [deleteState, deleteFormAction, isDeleting] = useActionState(
    deleteTripAction,
    initialTripState,
  );

  const activeState = isEditing ? updateState : createState;
  const isPending = isEditing ? isUpdating : isCreating;

  useEffect(() => {
    if (createState.success || updateState.success || deleteState.success)
      onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only close on a fresh success, not on every state identity change
  }, [createState.success, updateState.success, deleteState.success]);

  if (!open) return null;

  const travelerOptions = Array.from(
    new Set([...knownTravelers(), ...extraTravelerOptions]),
  );

  function toggleTraveler(name: string) {
    setSelectedTravelers((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  }

  function addCustomTraveler() {
    const name = customTraveler.trim();
    if (!name) return;
    setExtraTravelerOptions((prev) =>
      prev.includes(name) ? prev : [...prev, name],
    );
    setSelectedTravelers((prev) =>
      prev.includes(name) ? prev : [...prev, name],
    );
    setCustomTraveler("");
  }

  async function handlePdfUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsParsing(true);
    setParseNote(null);
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();

      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      let text = "";
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        text +=
          content.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" ") + "\n";
      }

      const parsed = parseItineraryText(text);
      if (parsed.destination) setDestination(parsed.destination);
      if (parsed.startDate) setStartDate(parsed.startDate);
      if (parsed.endDate) setEndDate(parsed.endDate);
      if (parsed.flight) setFlight(parsed.flight);

      setParseNote(
        parsed.destination || parsed.startDate || parsed.flight
          ? "Auto-detected from the PDF — please check before saving."
          : "Couldn't auto-detect anything from that PDF — please fill the details in yourself.",
      );
    } catch {
      setParseNote(
        "Couldn't read that PDF — you can still fill the details in manually.",
      );
    } finally {
      setIsParsing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-[480px] overflow-y-auto rounded-t-[22px] bg-surface p-5 sm:rounded-[22px] sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-[17px] font-extrabold text-ink">
            {isEditing ? "Edit trip" : "Add trip"}
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

        {!isEditing && (
          <div className="mb-4 flex rounded-full bg-bg p-[3px]">
            <button
              type="button"
              onClick={() => setEntryTab("upload")}
              className={cn(
                "flex-1 rounded-full py-2 font-display text-xs font-bold text-ink-faint",
                entryTab === "upload" && "bg-surface text-ink shadow-sm",
              )}
            >
              Upload PDF
            </button>
            <button
              type="button"
              onClick={() => setEntryTab("manual")}
              className={cn(
                "flex-1 rounded-full py-2 font-display text-xs font-bold text-ink-faint",
                entryTab === "manual" && "bg-surface text-ink shadow-sm",
              )}
            >
              Enter manually
            </button>
          </div>
        )}

        {!isEditing && entryTab === "upload" && (
          <div className="mb-4">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-[1.5px] border-dashed border-line px-4 py-6 text-center text-[12.5px] text-ink-faint">
              <Upload className="size-6 text-ink-faint" />
              <span>
                <strong className="text-ink">Tap to upload</strong> a PDF
                itinerary
              </span>
              <span>
                Flight or hotel confirmation, e-ticket, boarding pass PDF
              </span>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handlePdfUpload}
              />
            </label>
            {isParsing && (
              <p className="mt-3 flex items-center gap-2 text-[12.5px] text-ink-soft">
                <span className="size-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
                Reading itinerary…
              </p>
            )}
          </div>
        )}

        {parseNote && (
          <div className="mb-4 flex items-center gap-2 rounded-[10px] bg-accent-soft px-2.5 py-2 font-display text-[11px] font-bold text-accent">
            <Sparkles className="size-3.5 shrink-0" />
            {parseNote}
          </div>
        )}

        <form
          action={isEditing ? updateFormAction : createFormAction}
          className="space-y-3.5"
        >
          {isEditing && (
            <input type="hidden" name="id" value={editingTrip.id} />
          )}

          <div className="space-y-1.5">
            <Label htmlFor="trip-destination">Destination</Label>
            <Input
              id="trip-destination"
              name="destination"
              placeholder="e.g. Singapore"
              required
              maxLength={200}
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </div>

          {/* min-w-0 on each cell is the fix, not cosmetic — Tailwind's
              grid-cols-2 already puts minmax(0,1fr) on the *tracks*, but
              each item is still a block box with the browser default
              min-width: auto. iOS Safari's native date input has a wide
              intrinsic content size, so without min-w-0 the item refuses
              to shrink to its 50% track and the two inputs overlap
              instead of sitting side by side. */}
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="trip-startDate">Departs</Label>
              <Input
                id="trip-startDate"
                name="startDate"
                type="date"
                required
                className="w-full min-w-0"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="trip-endDate">Returns</Label>
              <Input
                id="trip-endDate"
                name="endDate"
                type="date"
                required
                className="w-full min-w-0"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trip-flight">Flight (name only)</Label>
            <Input
              id="trip-flight"
              name="flight"
              placeholder="e.g. 6E 204"
              maxLength={60}
              value={flight}
              onChange={(e) => setFlight(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Travellers</Label>
            <div className="flex flex-wrap gap-1.5">
              {travelerOptions.map((name) => {
                const selected = selectedTravelers.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleTraveler(name)}
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
            {selectedTravelers.map((name) => (
              <input
                key={name}
                type="hidden"
                name="travelerNames"
                value={name}
              />
            ))}
            <div className="flex gap-2 pt-1">
              <Input
                placeholder="Add another traveller…"
                value={customTraveler}
                onChange={(e) => setCustomTraveler(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomTraveler();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={addCustomTraveler}
              >
                Add
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trip-notes">
              Notes{" "}
              <span className="font-normal text-ink-faint">(optional)</span>
            </Label>
            <Input
              id="trip-notes"
              name="notes"
              placeholder="e.g. Diwali with family"
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <FieldError message={activeState.error} />
          <FieldError message={deleteState.error} />

          <div className="flex gap-2.5 pt-1">
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                loading={isDeleting}
                onClick={() => {
                  const formData = new FormData();
                  formData.set("id", editingTrip.id);
                  deleteFormAction(formData);
                }}
              >
                Delete
              </Button>
            )}
            <Button type="submit" className="flex-1" loading={isPending}>
              Save trip
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
