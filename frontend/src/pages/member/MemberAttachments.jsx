import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Paperclip, Trash2, X } from "lucide-react";
import { toast } from "react-hot-toast";
import {
  deletePublicAttachment,
  getPublicAttachments,
  uploadPublicAttachment,
  ATTACHMENT_CATEGORIES,
} from "../../services/attachments.service";
import { formatHumanDate } from "../../utils/date.utils";

function MemberAttachments() {
  const { token } = useOutletContext();

  const [attachments, setAttachments] = useState([]);
  const [status, setStatus] = useState("idle");

  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState(null);
  const [category, setCategory] = useState(ATTACHMENT_CATEGORIES[0].value);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);

  const [preview, setPreview] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setStatus("loading");
      try {
        const data = await getPublicAttachments(token);
        if (!active) return;
        setAttachments(data);
        setStatus("success");
      } catch (err) {
        console.error(err);
        if (!active) return;
        setStatus("error");
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [token]);

  function handleFileChange(e) {
    const selected = e.target.files?.[0] || null;
    setFile(selected);

    if (selected) {
      setPreview(URL.createObjectURL(selected));
    } else {
      setPreview(null);
    }
  }

  function resetUpload() {
    setFile(null);
    setPreview(null);
    setCategory(ATTACHMENT_CATEGORIES[0].value);
    setNote("");
    setShowUpload(false);
  }

  async function handleUpload() {
    if (!file) {
      toast.error("Seleccioná una imagen");
      return;
    }

    try {
      setUploading(true);
      const created = await uploadPublicAttachment(token, file, category, note);
      setAttachments((prev) => [created, ...prev]);
      resetUpload();
      toast.success("Adjunto subido");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "No se pudo subir el adjunto");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id) {
    try {
      setDeletingId(id);
      await deletePublicAttachment(token, id);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      toast.success("Adjunto eliminado");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "No se pudo eliminar el adjunto");
    } finally {
      setDeletingId(null);
    }
  }

  const pending = attachments.filter((a) => !a.reviewed).length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface-elevated p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Mis adjuntos
          </h2>

          {!showUpload && (
            <button
              onClick={() => setShowUpload(true)}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus size={16} />
              Subir adjunto
            </button>
          )}
        </div>

        <p className="mt-1 text-xs text-text-secondary">
          Mandale al gimnasio la orden de sesiones, el comprobante de pago o
          cualquier estudio que necesitemos ver (ej. electrocardiograma para
          natación).
        </p>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-lg bg-surface-input px-2 py-1 text-text-secondary">
            {attachments.length} adjuntos
          </span>
          {pending > 0 && (
            <span className="rounded-lg bg-warning/15 px-2 py-1 text-warning-text dark:text-warning">
              {pending} sin revisar
            </span>
          )}
        </div>
      </div>

      {showUpload && (
        <div className="rounded-xl bg-surface-elevated p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              Nuevo adjunto
            </h3>

            <button
              onClick={resetUpload}
              className="rounded-lg p-1 text-text-secondary transition hover:bg-surface-input"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-3 space-y-3">
            <label
              htmlFor="attachment-file"
              className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface-input px-4 py-6 text-sm text-text-secondary transition hover:border-blue-500"
            >
              <Paperclip size={18} />
              {file ? file.name : "Elegí la imagen a subir"}
            </label>

            <input
              id="attachment-file"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {preview && (
              <div className="flex items-center gap-3">
                <img
                  src={preview}
                  alt="Vista previa"
                  className="h-24 w-24 rounded-xl border border-border object-cover"
                />

                <button
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                  }}
                  className="rounded-lg bg-surface-input px-3 py-1.5 text-xs text-text-secondary transition hover:bg-surface-border"
                >
                  Elegir otra
                </button>
              </div>
            )}

            <label className="block text-xs font-medium text-text-secondary">
              Categoría
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-surface-input px-3 py-2 text-sm text-text-primary focus:border-blue-500 focus:outline-none"
              >
                {ATTACHMENT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium text-text-secondary">
              Nota (opcional)
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ej. el pago lo hice desde el banco de mi tía."
                rows={2}
                className="mt-1 w-full resize-none rounded-xl border border-border bg-surface-input px-3 py-2 text-sm text-text-primary focus:border-blue-500 focus:outline-none"
              />
            </label>

            <button
              onClick={handleUpload}
              disabled={uploading || !file}
              className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
            >
              {uploading ? "Subiendo..." : "Subir"}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl bg-surface-elevated p-4 shadow-sm">
        {status === "loading" ? (
          <p className="text-sm text-text-secondary">Cargando...</p>
        ) : status === "error" ? (
          <p className="text-sm text-danger-text dark:text-danger">
            No se pudieron cargar los adjuntos.
          </p>
        ) : attachments.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface-input px-4 py-8 text-center">
            <Paperclip size={28} className="text-text-secondary" />
            <p className="text-sm font-medium text-text-primary">
              No subiste adjuntos todavía
            </p>
            <p className="text-xs text-text-secondary">
              Cuando mandes un comprobante o un estudio, lo vas a ver acá.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="overflow-hidden rounded-xl border border-border bg-surface-input"
              >
                <button
                  onClick={() => setLightboxUrl(attachment.url)}
                  className="block w-full"
                >
                  <img
                    src={attachment.url}
                    alt={attachment.category_label}
                    className="h-32 w-full object-cover"
                  />
                </button>

                <div className="p-2.5">
                  <div className="flex items-center justify-between gap-1">
                    <p className="truncate text-xs font-medium text-text-primary">
                      {attachment.category_label}
                    </p>

                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        attachment.reviewed
                          ? "bg-success/15 text-success-text dark:text-success"
                          : "bg-warning/15 text-warning-text dark:text-warning"
                      }`}
                    >
                      {attachment.reviewed ? "Revisado" : "Pendiente"}
                    </span>
                  </div>

                  {attachment.note && (
                    <p className="mt-1 line-clamp-2 text-[11px] text-text-secondary">
                      {attachment.note}
                    </p>
                  )}

                  <p className="mt-1 text-[11px] text-text-secondary">
                    {formatHumanDate(attachment.created_at)}
                  </p>

                  {!attachment.reviewed && (
                    <button
                      onClick={() => handleDelete(attachment.id)}
                      disabled={deletingId === attachment.id}
                      className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-surface-elevated px-2 py-1 text-[11px] text-danger dark:text-danger transition hover:bg-danger/10 disabled:opacity-50"
                    >
                      <Trash2 size={12} />
                      {deletingId === attachment.id
                        ? "Eliminando..."
                        : "Eliminar"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative">
            <img
              src={lightboxUrl}
              alt="Adjunto"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain"
            />

            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-3 -right-3 rounded-full bg-surface-elevated p-2 text-text-primary shadow transition hover:bg-surface-input"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MemberAttachments;