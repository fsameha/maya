import { Badge } from "@astryxdesign/core/Badge";

/** Shown wherever a *.placeholder.* fixture is on screen (PRD §14). */
export function PlaceholderChip({ className = "" }: { className?: string }) {
  return (
    <span className={className} title="Placeholder data: replaced by the recorded run from the real system">
      <Badge variant="warning" label="Placeholder data" />
    </span>
  );
}
