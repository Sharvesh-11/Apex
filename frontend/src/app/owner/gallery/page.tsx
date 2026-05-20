"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Trash2, UploadCloud, X } from 'lucide-react';

import * as apiClient from '@/lib/api';
import type { GalleryImage } from '@/types';
import useUIStore from '@/store/uiStore';

type GalleryRecord = GalleryImage;

type UploadFormState = {
	caption: string;
	display_order: string;
};

const skeletonCards = Array.from({ length: 6 });

export default function OwnerGalleryPage() {
	const showToast = useUIStore((state) => state.showToast);
	const [images, setImages] = useState<GalleryRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [dragActive, setDragActive] = useState(false);
	const [file, setFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState('');
	const [form, setForm] = useState<UploadFormState>({
		caption: '',
		display_order: '0',
	});
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		let mounted = true;

		void (async () => {
			setLoading(true);
			setError(null);
			try {
				const data = await apiClient.get<GalleryRecord[]>('/gallery/');
				if (!mounted) return;
				setImages(data ?? []);
			} catch {
				if (!mounted) return;
				setError('Failed to load gallery images');
			} finally {
				if (mounted) setLoading(false);
			}
		})();

		return () => {
			mounted = false;
		};
	}, []);

	useEffect(() => {
		if (!file) {
			setPreviewUrl('');
			return;
		}

		const objectUrl = URL.createObjectURL(file);
		setPreviewUrl(objectUrl);

		return () => URL.revokeObjectURL(objectUrl);
	}, [file]);

	const refreshImages = async () => {
		const nextImages = await apiClient.get<GalleryRecord[]>('/gallery/');
		setImages(nextImages ?? []);
	};

	const openModal = () => {
		setForm({ caption: '', display_order: '0' });
		setFile(null);
		setUploadProgress(0);
		setIsModalOpen(true);
	};

	const closeModal = () => {
		setIsModalOpen(false);
		setFile(null);
		setPreviewUrl('');
		setUploadProgress(0);
		setDragActive(false);
		setForm({ caption: '', display_order: '0' });
	};

	const handleFile = (nextFile?: File | null) => {
		if (!nextFile) return;
		setFile(nextFile);
	};

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!file) return;

		setSaving(true);
		setUploadProgress(0);

		try {
			const formData = new FormData();
			formData.append('image', file);
			formData.append('caption', form.caption);
			formData.append('display_order', form.display_order || '0');

					await apiClient.api.post('/gallery/', formData, {
				headers: { 'Content-Type': 'multipart/form-data' },
				onUploadProgress: (progressEvent) => {
					if (!progressEvent.total) return;
					setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
				},
			});

			showToast('Image uploaded successfully', 'success');
			closeModal();
			await refreshImages();
		} catch {
			showToast('Failed to upload image', 'error');
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async (imageId: string) => {
		const confirmed = window.confirm('Delete this image?');
		if (!confirmed) return;

		try {
			await apiClient.del(`/gallery/${imageId}`);
			showToast('Image deleted successfully', 'success');
			await refreshImages();
		} catch {
			showToast('Failed to delete image', 'error');
		}
	};

	const sortedImages = useMemo(
		() => images.slice().sort((a, b) => Number(a.display_order) - Number(b.display_order)),
		[images],
	);

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<h1 className="text-3xl font-bold text-textPrimary">Gallery</h1>
				<button type="button" onClick={openModal} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-textPrimary hover:bg-primaryHover">
					<UploadCloud className="h-4 w-4" />
					Upload Image
				</button>
			</div>

			{error ? <div className="rounded-xl border border-accent bg-surface p-4 text-textSecondary">{error}</div> : null}

			<div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
				{loading
					? skeletonCards.map((_, index) => (
						<div key={index} className="rounded-xl border border-accent bg-surface p-3">
							<div className="h-48 animate-pulse rounded-lg bg-background/60" />
							<div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-background/60" />
						</div>
					))
					: sortedImages.length > 0
						? sortedImages.map((image) => (
							<div key={image.id} className="group relative rounded-xl border border-accent bg-surface p-3">
								<button type="button" onClick={() => handleDelete(image.id)} className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white opacity-0 transition-opacity hover:bg-red-500/80 group-hover:opacity-100" aria-label="Delete image">
									<Trash2 className="h-4 w-4" />
								</button>

								<div className="overflow-hidden rounded-lg">
									<Image src={image.image_url} alt={image.caption ?? 'Gallery image'} width={800} height={600} className="h-56 w-full object-cover transition-transform duration-300 group-hover:scale-105" />
								</div>

								<div className="mt-3 flex items-start justify-between gap-3">
									<div>
										<div className="text-sm font-medium text-textPrimary">{image.caption || 'Untitled image'}</div>
									</div>
									<span className="inline-flex rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">#{image.display_order}</span>
								</div>
							</div>
						))
						: (
							<div className="col-span-full rounded-xl border border-accent bg-surface p-10 text-center text-textSecondary">
								No images yet. Upload your first gym photo.
							</div>
						)}
			</div>

			{isModalOpen ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
					<div className="w-full max-w-2xl rounded-xl border border-accent bg-surface p-6 shadow-2xl">
						<div className="mb-6 flex items-center justify-between gap-4">
							<h2 className="text-xl font-semibold text-textPrimary">Upload Image</h2>
							<button type="button" onClick={closeModal} className="rounded p-2 text-textSecondary hover:text-textPrimary" aria-label="Close modal"><X className="h-5 w-5" /></button>
						</div>

						<form className="grid gap-4" onSubmit={handleSubmit}>
							<div
								onDragOver={(event) => {
									event.preventDefault();
									setDragActive(true);
								}}
								onDragLeave={() => setDragActive(false)}
								onDrop={(event) => {
									event.preventDefault();
									setDragActive(false);
									handleFile(event.dataTransfer.files?.[0]);
								}}
								onClick={() => fileInputRef.current?.click()}
								className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${dragActive ? 'border-primary bg-primary/5' : 'border-accent bg-background hover:border-primary'}`}
							>
								<input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} />
								<UploadCloud className="h-8 w-8 text-primary" />
								<div className="mt-3 text-textPrimary">Drag and drop an image here, or click to select</div>
								<div className="mt-1 text-sm text-textSecondary">PNG, JPG, or WEBP</div>
							</div>

							{previewUrl ? (
								<div className="overflow-hidden rounded-xl border border-accent bg-background">
									{/* Using next/image for preview as well */}
									<Image src={previewUrl} alt="Selected preview" width={800} height={500} className="h-64 w-full object-cover" unoptimized />
								</div>
							) : null}

							<div className="grid gap-4 md:grid-cols-2">
								<div>
									<label className="mb-1 block text-sm text-textSecondary">Caption</label>
									<input value={form.caption} onChange={(event) => setForm((current) => ({ ...current, caption: event.target.value }))} className="w-full rounded-lg border border-accent bg-background px-4 py-2 text-textPrimary outline-none focus:border-primary" />
								</div>
								<div>
									<label className="mb-1 block text-sm text-textSecondary">Display Order</label>
									<input type="number" value={form.display_order} onChange={(event) => setForm((current) => ({ ...current, display_order: event.target.value }))} className="w-full rounded-lg border border-accent bg-background px-4 py-2 text-textPrimary outline-none focus:border-primary" />
								</div>
							</div>

							{saving ? (
								<div className="space-y-2">
									<div className="h-2 rounded-full bg-background">
										<div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${uploadProgress}%` }} />
									</div>
									<div className="text-sm text-textSecondary">Uploading... {uploadProgress}%</div>
								</div>
							) : null}

							<div className="flex justify-end gap-3 pt-2">
								<button type="button" onClick={closeModal} className="rounded-lg border border-accent px-4 py-2 text-textSecondary hover:text-textPrimary">Cancel</button>
								<button type="submit" disabled={!file || saving} className="rounded-lg bg-primary px-4 py-2 text-textPrimary hover:bg-primaryHover disabled:opacity-60">{saving ? 'Uploading...' : 'Upload Image'}</button>
							</div>
						</form>
					</div>
				</div>
			) : null}
		</div>
	);
}

