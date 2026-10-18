import type { SVGProps } from "react";

type BrandMarkProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  title?: string;
};

export function BrandMark({
  className,
  title,
  "aria-hidden": ariaHidden = title ? undefined : true,
  ...rest
}: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      role={title ? "img" : undefined}
      className={className}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <path d="M7 21h10" />
      <path d="M12 21V12" />
      <path d="M12 12C12 8.5 9.5 6.5 6 6.5" />
      <path d="M12 12C12 8.5 14.5 6.5 18 6.5" />
    </svg>
  );
}
