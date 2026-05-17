"use client";

import Link from 'next/link';
import { MapPin, Phone, Mail } from 'lucide-react';
import { siteConfig } from '@/lib/config';

export default function ContactSection() {
  const contact = siteConfig.contact;

  return (
    <section id="contact" className="py-16 bg-surface">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-textPrimary mb-6">Find Us</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-primary mt-1" />
              <div className="text-textSecondary">{contact.address}</div>
            </div>

            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-primary" />
              <a href={`tel:${contact.phone}`} className="text-textSecondary hover:text-primary">{contact.phone}</a>
            </div>

            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-primary" />
              <a href={`mailto:${contact.email}`} className="text-textSecondary hover:text-primary">{contact.email}</a>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <Link href={contact.whatsapp} target="_blank" rel="noreferrer" className="inline-block px-4 py-2 rounded bg-primary text-textPrimary hover:bg-primaryHover">WhatsApp</Link>
              <Link href={contact.instagram} target="_blank" rel="noreferrer" className="inline-block px-4 py-2 rounded bg-transparent border border-accent text-textPrimary hover:bg-primaryHover hover:text-textPrimary">Instagram</Link>
            </div>
          </div>

          <div>
            {/* Replace src with your Google Maps embed URL */}
            <iframe
              title="map"
              // temporary — replace with your real Google Maps embed URL later
              src="https://maps.google.com/maps?q=Bengaluru&output=embed"
              className="w-full h-64 md:h-full rounded-lg border-0"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
