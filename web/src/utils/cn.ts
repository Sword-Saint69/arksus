import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** shadcn/ui's class joiner; lives in utils/ because src/lib/ belongs to the data contract. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
