"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import * as apiClient from '@/lib/api';
import type { GalleryImage } from '@/types';

export default function GallerySection() {
  const [images, setImages] = useState<GalleryImage[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      setLoading(true);
      try {
        const data = await apiClient.get<GalleryImage[]>('/gallery/');
        if (!mounted) return;
        setImages(data ?? []);
      } catch (err) {
        console.error('Failed to load gallery', err);
        if (!mounted) return;
        setImages([]);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const skeletons = Array.from({ length: 6 }).map((_, i) => (
    <div key={i} className="rounded-xl overflow-hidden bg-surface animate-pulse h-72" />
  ));

  const emptyStateSkeletons = Array.from({ length: 3 }).map((_, i) => (
    <div key={i} className="h-72 animate-pulse rounded-xl bg-accent/40" />
  ));

  return (
    <section id="gallery" className="py-20 px-6 bg-background border-b border-accent">
      <div className="max-w-6xl mx-auto">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-textPrimary mb-4">Our Gallery</h2>
          <p className="text-textSecondary">Take a look inside</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">{skeletons}</div>
        ) : images && images.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
            {images.map((img) => (
              <figure key={img.id} className="relative rounded-xl overflow-hidden">
                <Image
                  src={img.image_url}
                  alt={img.caption ?? 'Gallery image'}
                  width={1200}
                  height={900}
                  className="w-full h-72 object-cover transition-transform duration-300 hover:scale-105"
                />

                {img.caption && (
                  <figcaption className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-white text-sm">
                    <span>{img.caption}</span>
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        ) : (
          <div className="space-y-4 mt-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{emptyStateSkeletons}</div>
            <p className="text-textSecondary text-center">Photos coming soon</p>
          </div>
        )}
      </div>
    </section>
  );
}
