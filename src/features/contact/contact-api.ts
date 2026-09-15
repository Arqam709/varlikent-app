import { apiRequest } from '@/services/api-client';
import type { MessageResponse } from '@/types/api';

export type ContactEnquiry = {
  name: string;
  email: string;
  phone: string;
  interestType: string;
  message: string;
  source?: 'mobile';
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
      ...(enquiry.source ? { source: enquiry.source } : {}),
    },
  });
}
