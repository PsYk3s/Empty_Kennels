import type { LeadStatus } from '../types/lead';
import { statusVariant } from '../types/lead';

type Props = {
  letter: string;
  status: LeadStatus | undefined;
  label: string;
};

export function StatusChip({ letter, status, label }: Props) {
  const variant = statusVariant(status);
  return (
    <span
      className={`status-chip status-chip-${variant}`}
      title={`${label}: ${status ?? 'pending'}`}
      aria-label={`${label} status: ${status ?? 'pending'}`}
      role='listitem'
    >
      {letter}
    </span>
  );
}
