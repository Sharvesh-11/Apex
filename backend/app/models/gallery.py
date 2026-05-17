import uuid

from sqlalchemy import Column, DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class GalleryImage(Base):
	__tablename__ = "gallery_images"

	id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
	image_url = Column(String, nullable=False)
	caption = Column(String, nullable=True)
	display_order = Column(Integer, nullable=False, default=0)
	uploaded_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
