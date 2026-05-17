import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import HeroSection from '@/components/landing/HeroSection';
import GallerySection from '@/components/landing/GallerySection';
import PricingSection from '@/components/landing/PricingSection';
import ContactSection from '@/components/landing/ContactSection';

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="scroll-smooth">
        <HeroSection />
        <GallerySection />
        <PricingSection />
        <ContactSection />
      </main>
      <Footer />
    </>
  );
}
