# API Design

## There is no conventional API

This isn't a gap — it's the actual architecture. Reads happen directly
in Server Components via `src/services/*.ts` functions; writes happen
via Server Actions. There's no REST or GraphQL contract to design
against, no request/response versioning concern, and no separate
backend deployment. If a task description assumes an "API layer" in
the traditional sense, that assumption doesn't match this codebase —
work within the Server Component + Server Action pattern instead.

The **one exception**:
`src/app/api/attachments/[attachmentId]/download/route.ts` — a real
Route Handler, because signed-URL generation for private Storage
attachments needs an actual HTTP endpoint the browser can navigate to
directly (an `<a href>`, not a fetch from a Server Action).

## The Server Action pattern, as actually used

Every feature's mutations live in `src/features/<feature>/api/actions.ts`,
marked `"use server"` at the top of the file. The shape, consistently:

```ts
export interface SomeFormState {
  error?: string;
  success?: boolean;
}

export async function someAction(
  _prevState: SomeFormState,
  formData: FormData,
): Promise<SomeFormState> {
  const parsed = someInputSchema.safeParse({
    field: formValue(formData, "field"),
    // ...
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    await someServiceFunction(parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Something went wrong" };
  }
  revalidatePath("/relevant-route");
  // ...revalidate every route whose displayed data this mutation affects
  return { success: true };
}
```

Client components call these via React's `useActionState`, giving
`isPending`/error state without hand-rolled fetch logic. `formValue` is
a small shared helper (`src/features/transactions/api/actions.ts` and
similar files) that reads a `FormData` field and returns `undefined`
for an empty string — meaning **empty string and "field omitted" are
indistinguishable** by default. This mattered concretely once: clearing
a `cycle_month` tag needed a real value ("untagged") distinct from
omitting the field, so `TransactionRow`'s cycle select uses a sentinel
string (`"untagged"`) rather than an empty option value, translated to
explicit `null` inside the action. Keep this in mind any time a field's
"empty" and "absent" states need to mean different things.

## `revalidatePath` discipline

Every action revalidates every route whose displayed numbers the
mutation could affect — not just the page the form lives on. Tagging a
recurring transaction to a cycle (`tagRecurringToCycleAction`) touches
`/budgets`, `/recurring`, `/transactions`, *and* `/dashboard` (Home
shows tagged data too). Marking a transaction paid touches
`/transactions`, `/dashboard`, `/accounts`, and possibly `/budgets`.
When adding a new mutation, trace which pages read the affected data
before assuming the revalidate list is obvious — this project has hit
"stale number on a page nobody thought to revalidate" more than once.

## Validation boundary

Zod schemas in each feature's `schemas.ts` are the single validation
point for that feature's mutations — not duplicated in the action, not
re-validated in the service layer beyond what TypeScript's types
already guarantee. `zMoney` specifically is lenient on input format
(see `docs/02-system-architecture.md`'s money-handling section) but
strict on output shape.
