import type { SVGProps } from "react";

/**
 * Circular "buffering" spinner — a partial ring that rotates via CSS
 * animation. Used inside buttons during a pending form submission, so
 * every save action across the app gives the same visible "it's working"
 * feedback, not just a text change that's easy to miss.
 */
export function Spinner({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`animate-spin ${className ?? ""}`}
      aria-hidden="true"
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        strokeOpacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
