import type {ReactNode} from "react";

export default function SectionLabel({children}: {children: ReactNode}) {
  return (
    <div className="flex items-center gap-4">
      <h2 className="shrink-0 text-[11px] uppercase tracking-[0.3em] text-white/80">{children}</h2>
      <span className="flex-1 border-t border-dashed border-white/25" />
    </div>
  );
}
