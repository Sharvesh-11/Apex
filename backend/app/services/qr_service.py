from app.core.config import settings


def _build_qr_signature(member_id: str) -> str:
	return f"APEX-{member_id}-{settings.SECRET_KEY[:8]}"


def generate_qr_data(member_id: str) -> str:
	"""Generate signed QR data string for a member."""
	return _build_qr_signature(member_id)


def validate_qr(qr_data: str, member_id: str) -> bool:
	"""Validate a QR data string against the expected member signature."""
	expected = _build_qr_signature(member_id)
	return qr_data == expected
