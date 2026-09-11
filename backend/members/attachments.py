import logging

import cloudinary

logger = logging.getLogger(__name__)

ATTACHMENTS_FOLDER = "gim-saas/member-attachments"


def upload_member_attachment(file_obj, gym_id, member_id):
    """Sube la imagen como recurso privado a Cloudinary.

    Devuelve el public_id (se guarda en MemberAttachment.file). La URL
    firmada se arma al serializar, nunca se expone la URL sin firma.
    """
    result = cloudinary.uploader.upload(
        file_obj,
        resource_type="image",
        type="private",
        folder=f"{ATTACHMENTS_FOLDER}/gym_{gym_id}/member_{member_id}",
        overwrite=False,
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