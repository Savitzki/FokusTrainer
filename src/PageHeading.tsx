import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Shared heading for the app's destination pages. */
export default function PageHeading({
  title,
  icon: Icon,
  before,
  children,
}: {
  title: string;
  icon: LucideIcon;
  before?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="screen-heading page-heading">
      {before}
      <h1 id="page-title" className="page-title" tabIndex={-1}>
        <Icon size={22} aria-hidden="true" />
        {title}
      </h1>
      {children}
    </div>
  );
}
