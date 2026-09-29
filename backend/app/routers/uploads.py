"""Product image upload, stored on local disk.

Deliberately minimal and defensive, because file upload is the most abused
endpoint category there is:

* the client-supplied filename is never used as a path (no path traversal)
* the stored name is random, so two uploads cannot overwrite each other
* the declared content type is checked against an allow-list
* the byte count is enforced while streaming, not after buffering the file
"""

from __future__ import annotations

import secrets
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Response, UploadFile, status

from app.config import get_settings
from app.deps import CurrentAdmin

router = APIRouter(prefix="/uploads", tags=["uploads"])
settings = get_settings()

EXTENSION_BY_TYPE = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}

UPLOAD_DIR = Path(settings.upload_dir)
CHUNK_SIZE = 64 * 1024


def _storage_dir() -> Path:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    return UPLOAD_DIR


@router.post("/images", status_code=status.HTTP_201_CREATED)
def upload_image(_admin: CurrentAdmin, file: UploadFile = File(...)) -> dict[str, str]:
    content_type = (file.content_type or "").lower()
    if content_type not in settings.allowed_image_mime_types:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Content type '{content_type}' is not allowed",
        )

    suffix = EXTENSION_BY_TYPE.get(content_type, ".bin")
    stored_name = f"{secrets.token_hex(16)}{suffix}"
    destination = _storage_dir() / stored_name

    written = 0
    try:
        with destination.open("wb") as handle:
            while chunk := file.file.read(CHUNK_SIZE):
                written += len(chunk)
                if written > settings.max_upload_bytes:
                    handle.close()
                    destination.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File exceeds {settings.max_upload_bytes} bytes",
                    )
                handle.write(chunk)
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    finally:
        file.file.close()

    if written == 0:
        destination.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file was empty"
        )

    return {"filename": stored_name, "url": f"/uploads/images/{stored_name}"}


@router.get("/images/{filename}")
def get_image(filename: str) -> Response:
    # Reject anything that is not a bare filename before touching the filesystem.
    if "/" in filename or "\\" in filename or filename.startswith("."):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid filename")

    path = _storage_dir() / filename
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")

    media_type = next(
        (mime for mime, ext in EXTENSION_BY_TYPE.items() if path.suffix == ext),
        "application/octet-stream",
    )
    return Response(content=path.read_bytes(), media_type=media_type)
