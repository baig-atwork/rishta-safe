import type { ReactNode } from "react";
import "./instrument.css";

export interface InstrumentLayoutProps {
  queue: ReactNode;
  brief: ReactNode;
  trace: ReactNode;
}

/**
 * Three panes at the staff width axis: queue, brief, trace. Below 1100 px they stack, queue first. The panes bring
 * their own headings (the queue owns the page h1); this component only places them.
 */
export function InstrumentLayout({ queue, brief, trace }: InstrumentLayoutProps) {
  return (
    <div className="inst" data-testid="instrument">
      <div className="inst-pane inst-q">{queue}</div>
      <div className="inst-pane inst-b">{brief}</div>
      <div className="inst-pane inst-t">{trace}</div>
    </div>
  );
}
