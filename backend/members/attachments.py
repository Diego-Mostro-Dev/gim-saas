import logging

import cloudinary
from PIL import Image
from rest_framework.exceptions import ValidationError

logger = logging.getLogger(__name__)

ATTACHMENTS_FOLDER = "gim-saas/member-attachments"

MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024

ALLOWED_IMAGE_FORMATS = {
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "image/webp": ["webp"],
    "image/gif": ["gif"],
    "image/bmp": ["bmp"],
}


def _validate_image(file_obj):
    """Valida que el archivo sea una imagen admitida y no supere 5 MB.

    Devuelve la lista de formatos permitidos para Cloudinary. Levanta
    ValidationError (400) antes de cualquier upload.
    """
    size = getattr(file_obj, "size", None)
    if size is not None and size > MAX_ATTACHMENT_BYTES:
        raise ValidationError("El archivo supera el tamaño máximo de 5 MB.")

    content_type = (getattr(file_obj, "content_type", "") or "").split(";")[0].strip()
    if content_type and content_type not in ALLOWED_IMAGE_FORMATS:
        raise ValidationError(
            "Tipo de archivo no permitido. Usá JPG, PNG, WEBP, GIF o BMP."
        )

    try:
        original_pos = file_obj.tell()
    except (AttributeError, OSError):
        original_pos = 0
    try:
        file_obj.seek(0)
        image = Image.open(file_obj)
        image.verify()
        file_obj.seek(0)
    except Exception:
        file_obj.seek(original_pos)
        raise ValidationError(
            "El archivo no es una imagen válida (JPG, PNG, WEBP, GIF o BMP)."
        )

    return ALLOWED_IMAGE_FORMATS.get(content_type, ["jpg", "jpeg", "png", "webp", "gif", "bmp"])


def upload_member_attachment(file_obj, gym_id, member_id):
    """Sube la imagen como recurso privado a Cloudinary.

    Devuelve el public_id (se guarda en MemberAttachment.file). La URL
    firmada se arma al serializar, nunca se expone la URL sin firma.
    """
    allowed_formats = _validate_image(file_obj)
    result = cloudinary.uploader.upload(
        file_obj,
        resource_type="image",
        type="private",
        folder=f"{ATTACHMENTS_FOLDER}/gym_{gym_id}/member_{member_id}",
        overwrite=False,
        allowed_formats=allowed_formats,
    )
    return result["public_id"]


def signed_attachment_url(public_id):
    """URL firmada (expirable) de un adjunto privado de Cloudinary."""
    if not public_id:
        return None
    try:
        return cloudinary.utils.cloudinary_url(
            public_id,
            resource_type="image",
            type="private",
            secure=True,
            sign_url=True,
        )[0]
    except Exception:
        logger.exception("No se pudo firmar la URL del adjunto: %s", public_id)
        return None