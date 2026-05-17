import uuid
from pathlib import Path
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

import cloudinary
import cloudinary.uploader

from app.core.dependencies import require_role
from app.core.config import settings
from app.database import get_db
from app.models.gallery import GalleryImage
from app.models.user import User


router = APIRouter()


cloudinary.config(
	cloud_name=settings.CLOUDINARY_CLOUD_NAME,
	api_key=settings.CLOUDINARY_API_KEY,
	api_secret=settings.CLOUDINARY_API_SECRET,
)


class GalleryImageOut(BaseModel):
	id: uuid.UUID
	image_url: str
	caption: str | None = None
	display_order: int

	model_config = ConfigDict(from_attributes=True)


class GalleryOrderUpdate(BaseModel):
	display_order: int


@router.get("/", response_model=list[GalleryImageOut])
def list_gallery_images(db: Session = Depends(get_db)) -> list[GalleryImageOut]:
	images = db.query(GalleryImage).order_by(GalleryImage.display_order.asc()).all()
	return [GalleryImageOut.model_validate(image) for image in images]


@router.post("/", response_model=GalleryImageOut, status_code=status.HTTP_201_CREATED)
def upload_gallery_image(
	image: UploadFile = File(...),
	caption: str | None = Form(None),
	display_order: int = Form(0),
	db: Session = Depends(get_db),
	current_user: User = Depends(require_role("gym_owner", "admin")),
) -> GalleryImageOut:
	result = cloudinary.uploader.upload(
		image.file,
		folder="apex_gym/gallery",
		transformation=[{"width": 1200, "crop": "limit"}],
	)

	image_url = result.get("secure_url")

	gallery_image = GalleryImage(
		image_url=image_url,
		caption=caption,
		display_order=display_order,
	)
	db.add(gallery_image)
	db.commit()
	db.refresh(gallery_image)
	return GalleryImageOut.model_validate(gallery_image)


@router.delete("/{image_id}")
def delete_gallery_image(
	image_id: uuid.UUID,
	db: Session = Depends(get_db),
	current_user: User = Depends(require_role("gym_owner", "admin")),
) -> dict[str, str]:
	image = db.query(GalleryImage).filter(GalleryImage.id == image_id).first()
	if image is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")

	# extract filename from URL and derive Cloudinary public_id
	parsed = urlparse(image.image_url)
	filename = Path(parsed.path).name
	public_id = "apex_gym/gallery/" + Path(filename).stem

	try:
		cloudinary.uploader.destroy(public_id)
	except Exception:
		# ignore Cloudinary errors but proceed to delete DB record
		pass

	db.delete(image)
	db.commit()
	return {"message": "Image deleted"}


@router.put("/{image_id}/order", response_model=GalleryImageOut)
def update_gallery_order(
	image_id: uuid.UUID,
	data: GalleryOrderUpdate,
	db: Session = Depends(get_db),
	current_user: User = Depends(require_role("gym_owner", "admin")),
) -> GalleryImageOut:
	image = db.query(GalleryImage).filter(GalleryImage.id == image_id).first()
	if image is None:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")

	image.display_order = data.display_order
	db.commit()
	db.refresh(image)
	return GalleryImageOut.model_validate(image)
