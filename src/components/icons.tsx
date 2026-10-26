import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function make(paths: React.ReactNode, strokeWidth = 1.8) {
  return function Icon({ size = 24, ...props }: IconProps) {
    return (
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        {paths}
      </svg>
    );
  };
}

export const HomeIcon = make(<path d="M3 10.5 12 3l9 7.5V21h-6v-7H9v7H3z" />);
export const ForkIcon = make(<path d="M7 3v18M4 3v5a3 3 0 0 0 6 0V3M17 21V3c-2 0-3.5 2.5-3.5 6s1.5 4 3.5 4" />);
export const DumbbellIcon = make(<path d="M6.5 6v12M3.5 9v6M17.5 6v12M20.5 9v6M6.5 12h11" />);
export const ChartIcon = make(<path d="M4 20V11M10 20V5M16 20v-6M2 20h20" />);
export const PlusIcon = make(<path d="M12 5v14M5 12h14" />, 2.4);
export const BackIcon = make(<path d="M15 5l-7 7 7 7" />, 2.2);
export const ForwardIcon = make(<path d="M9 5l7 7-7 7" />, 2.2);
export const DownIcon = make(<path d="M5 9l7 7 7-7" />, 2.2);
export const CloseIcon = make(<path d="M6 6l12 12M18 6 6 18" />, 2.2);
export const CheckIcon = make(<path d="M5 12.5l4.5 4.5L19 7.5" />, 3);
export const MoreIcon = make(
  <>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" />
  </>,
);
export const SearchIcon = make(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>,
  2,
);
export const CalendarIcon = make(
  <>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </>,
  2,
);
export const UpIcon = make(<path d="M12 19V5M6 11l6-6 6 6" />, 2.2);
export const TrashIcon = make(<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />, 2);
export const ArrowUpDownIcon = make(<path d="M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4" />, 2);
