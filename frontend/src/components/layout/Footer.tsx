import Link from 'next/link';
import { MapPin, Phone, Mail, Globe } from 'lucide-react';
import { siteConfig } from '@/lib/config';

export default function Footer() {
	const about = siteConfig.about?.description ?? '';
	const shortAbout = about.length > 140 ? `${about.slice(0, 140).trim()}...` : about;

	return (
		<footer className="w-full bg-surface text-textPrimary">
			<div className="max-w-6xl mx-auto px-6 py-12">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 md:divide-x md:divide-accent">
					{/* Brand */}
					<div className="space-y-3 md:pr-6">
						<h3 className="text-xl font-bold text-primary">{siteConfig.brand.name}</h3>
						<p className="text-textSecondary">{siteConfig.brand.tagline}</p>
						<p className="text-textSecondary text-sm mt-2">{shortAbout}</p>
					</div>

					{/* Quick Links */}
					<div className="pt-2 md:px-6">
						<h4 className="font-semibold mb-3">Quick Links</h4>
						<ul className="space-y-2">
							<li>
								<a href="#hero" className="text-textSecondary hover:text-primary">Home</a>
							</li>
							<li>
								<a href="#gallery" className="text-textSecondary hover:text-primary">Gallery</a>
							</li>
							<li>
								<a href="#pricing" className="text-textSecondary hover:text-primary">Pricing</a>
							</li>
							<li>
								<a href="#contact" className="text-textSecondary hover:text-primary">Contact</a>
							</li>
							<li>
								<Link href="/login" className="text-textSecondary hover:text-primary">Member Login</Link>
							</li>
						</ul>
					</div>

					{/* Contact */}
					<div className="pt-2 md:pl-6">
						<h4 className="font-semibold mb-3">Contact</h4>
						<ul className="space-y-3 text-textSecondary text-sm">
							<li className="flex items-start gap-2">
								<MapPin className="w-4 h-4 text-textSecondary mt-0.5" />
								<span>{siteConfig.contact.address}</span>
							</li>
							<li className="flex items-center gap-2">
								<Phone className="w-4 h-4 text-textSecondary" />
								<a href={`tel:${siteConfig.contact.phone}`} className="hover:text-primary">{siteConfig.contact.phone}</a>
							</li>
							<li className="flex items-center gap-2">
								<Mail className="w-4 h-4 text-textSecondary" />
								<a href={`mailto:${siteConfig.contact.email}`} className="hover:text-primary">{siteConfig.contact.email}</a>
							</li>

							<li className="flex items-center gap-3 mt-2">
								<a href={siteConfig.contact.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className="text-textSecondary hover:text-primary">
									<Globe className="w-5 h-5" />
								</a>
								<a href={siteConfig.contact.whatsapp} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="text-textSecondary hover:text-primary">
									<Phone className="w-5 h-5 transform rotate-0" />
								</a>
							</li>
						</ul>
					</div>
				</div>

				<hr className="my-6 border-accent" />

				<div className="pt-4 text-center text-textSecondary text-sm border-t border-accent pt-6">
					© 2025 {siteConfig.brand.name}. All rights reserved.
				</div>
			</div>
		</footer>
	);
}

