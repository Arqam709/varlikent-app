import { apiRequest } from '@/services/api-client';
import type { MessageResponse } from '@/types/api';

export const CONTACT_REASONS = [
  'Buying',
  'Renting',
  'Selling',
  'Renovation',
  'Interior Design',
  'Architecture',
  'Construction',
  'General',
] as const;

export type ContactReason = (typeof CONTACT_REASONS)[number];


export function reasonKey(reason: ContactReason): string {
  const camel = reason
    .split(' ')
    .map((word, index) => (index === 0 ? word.toLowerCase() : word))
    .join('');

  return `contact.reasons.${camel}`;
}

export function toContactReason(value: unknown): ContactReason | null {
  return typeof value === 'string' && (CONTACT_REASONS as readonly string[]).includes(value)
    ? (value as ContactReason)
    : null;
}

export type ContactEnquiry = {
  name: string;
  email: string;
  phone: string;
  interestType: ContactReason;
  message: string;
};

export async function sendContactEnquiry(enquiry: ContactEnquiry): Promise<void> {
  await apiRequest<MessageResponse>('/contact', {
    method: 'POST',
    body: {
      name: enquiry.name,
      email: enquiry.email,
      phone: enquiry.phone,
      interestType: enquiry.interestType,
      message: enquiry.message,
    },
  });
}
