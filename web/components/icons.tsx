/* Material-style outline icons, drawn inline so nothing loads from outside. */
type P = { size?: number; className?: string };
const S = ({ size = 20, className, d }: P & { d: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor"
    strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
export const IHome = (p: P) => <S {...p} d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />;
export const IClaim = (p: P) => <S {...p} d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M9 13h6M9 17h4" />;
export const ICases = (p: P) => <S {...p} d="M4 6h16M4 12h16M4 18h10M18 16l2 2 3-3" />;
export const ISignal = (p: P) => <S {...p} d="M3 17l5-6 4 3 5-7 4 4M3 21h18" />;
export const ISupplier = (p: P) => <S {...p} d="M3 21V9l6-4v4l6-4v4l6-4v16zM7 17h2M11 17h2M15 17h2" />;
export const IChart = (p: P) => <S {...p} d="M4 20V10M10 20V4M16 20v-7M22 20H2" />;
export const IStart = (p: P) => <S {...p} d="M5 3l14 9-14 9z" />;
export const IHelp = (p: P) => <S {...p} d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" />;
export const IReset = (p: P) => <S {...p} d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />;
export const IMenu = (p: P) => <S {...p} d="M3 6h18M3 12h18M3 18h18" />;
export const IClose = (p: P) => <S {...p} d="M18 6 6 18M6 6l12 12" />;
export const IArrow = (p: P) => <S {...p} d="M5 12h14M13 6l6 6-6 6" />;
export const ICheck = (p: P) => <S {...p} d="M5 12l5 5L20 7" />;
export const ILink = (p: P) => <S {...p} d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />;
export const ISpark = (p: P) => <S {...p} d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />;
export const IDoc = (p: P) => <S {...p} d="M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6" />;
export const ITree = (p: P) => <S {...p} d="M6 3v18M6 8h8M6 15h8M17 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM17 13a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />;
export const IEvidence = (p: P) => <S {...p} d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5" />;
export const ISwitch = (p: P) => <S {...p} d="M7 7h13l-4-4M17 17H4l4 4" />;
export const ILogout = (p: P) => <S {...p} d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />;
export const IUpload = (p: P) => <S {...p} d="M12 16V4M7 9l5-5 5 5M4 20h16" />;
