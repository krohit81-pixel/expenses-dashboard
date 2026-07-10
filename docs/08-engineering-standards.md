# Engineering Standards

## TypeScript and validation

- Keep `strict` enabled. Do not use `any`, non-null assertions, or type casts to bypass uncertain data.
- Validate every external boundary with Zod: forms, route parameters, query strings, environment variables, imports, webhooks, and AI tool inputs.
- Represent monetary values as branded decimal strings or a decimal value object. Convert for display only.
- Generate database types from the `finance` schema and do not hand-maintain duplicate row interfaces.

## Code rules

- Prefer small pure functions for financial calculations and test them exhaustively.
- Keep one source of truth for a domain action. UI components request commands; services implement workflows; migrations enforce durable invariants.
- Use explicit names: `postedAt`, `occurredOn`, `currencyCode`, `plannedAmount`. Avoid ambiguous `date`, `value`, or `data` names.
- Do not place secrets, business rules, or service-role initialization in client modules.
- Use comments for non-obvious financial or security decisions, not narration.

## Pull request standard

Every nontrivial change includes scope, affected data, test evidence, error and empty states, accessibility review, and rollback/forward-fix plan. Database changes include a migration, RLS review, index rationale, and staging verification.

## Formatting and quality gates

Run `npm run typecheck`, `npm run lint`, and `npm run build` before merge. Run formatting checks in CI. Reject unresolved TypeScript errors, console debugging, secrets, inaccessible controls, unbounded queries, and bare SQL interpolated from user input.

## Naming and commits

Use lowercase kebab-case for folders, PascalCase for React components/types, and camelCase for functions/variables. Use migration names that describe intent. Keep commits small and imperative, for example: `Add transaction split validation`.
