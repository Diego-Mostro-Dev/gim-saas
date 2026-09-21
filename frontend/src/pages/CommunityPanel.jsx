import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Store, MapPin, Phone, X } from "lucide-react";
import toast from "react-hot-toast";

import {
  getCommunityBusinesses,
  createCommunityBusiness,
  updateCommunityBusiness,
  deleteCommunityBusiness,
} from "../services/community.service";

const inputClass =
  "w-full rounded-xl border border-border bg-surface-input px-4 py-3 text-text-primary outline-none";

const emptyForm = {
  id: null,
  name: "",
  category: "",
  address: "",
  contact: "",
  discount: "",
  description: "",
};

function CommunityPanel() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const data = await getCommunityBusinesses();
      setBusinesses(data);
    } catch (error) {
      toast.error(error.message || "Error al cargar los locales");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const loadTimer = setTimeout(load, 0);
    return () => clearTimeout(loadTimer);
  }, []);

  function openCreate() {
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(business) {
    setForm({
      id: business.id,
      name: business.name ?? "",
      category: business.category ?? "",
      address: business.address ?? "",
      contact: business.contact ?? "",
      discount: business.discount ?? "",
      description: business.description ?? "",
    });
    setShowModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toast.error("El nombre del local es obligatorio");
      return;
    }
    const discount = form.discount.trim();
    if (!discount) {
      toast.error("El descuento/beneficio es obligatorio");
      return;
    }
    const payload = {
      name,
      category: form.category.trim(),
      address: form.address.trim(),
      contact: form.contact.trim(),
      discount,
      description: form.description.trim(),
    };
    setIsSubmitting(true);
    try {
      if (form.id) {
        await updateCommunityBusiness(form.id, payload);
        toast.success("Local actualizado");
      } else {
        await createCommunityBusiness(payload);
        toast.success("Local adherido");
      }
      setShowModal(false);
      load();
    } catch (error) {
      toast.error(error.message || "Error al guardar el local");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("¿Eliminar este local adherido?")) return;
    try {
      await deleteCommunityBusiness(id);
      toast.success("Local eliminado");
      load();
    } catch (error) {
      toast.error(error.message || "Error al eliminar el local");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-6">
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-secondary">
        Comunidad de descuentos
      </h3>

      <p className="mb-4 text-xs text-text-secondary">
        Sumá locales adheridos (ej. carnicería, kiosco, veterinaria). Cada
        socio recibe un QR con su tarjeta de comunidad para mostrar en estos
        locales y acceder al beneficio indicado. El descuento es un texto
        libre (ej. "10%", "2x1", "$500").
      </p>

      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white transition active:scale-95"
        >
          <Plus size={14} />
          Agregar local
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-text-secondary">Cargando...</p>
      ) : businesses.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-input px-4 py-3 text-sm text-text-secondary">
          No hay locales adheridos todavía.
        </div>
      ) : (
        <ul className="space-y-2">
          {businesses.map((business) => (
            <li
              key={business.id}
              className="rounded-xl border border-border bg-surface-input px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    {business.name}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {business.category && (
                      <>
                        {business.category}
                        {" · "}
                      </>
                    )}
                    {business.discount}
                  </p>
                  {(business.address || business.contact) && (
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-secondary">
                      {business.address && (
                        <span className="flex items-center gap-1">
                          <MapPin size={13} />
                          {business.address}
                        </span>
                      )}
                      {business.contact && (
                        <span className="flex items-center gap-1">
                          <Phone size={13} />
                          {business.contact}
                        </span>
                      )}
                    </p>
                  )}
                  {business.description && (
                    <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                      {business.description}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(business)}
                    className="rounded-lg bg-info-bg p-1.5 text-info-text dark:bg-info/15 dark:text-info transition hover:bg-info/30"
                    aria-label={`Editar ${business.name}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(business.id)}
                    className="rounded-lg bg-danger-bg p-1.5 text-danger-text dark:bg-danger/15 dark:text-danger transition hover:bg-danger/30"
                    aria-label={`Eliminar ${business.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-surface-elevated p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
                <Store size={20} />
                {form.id ? "Editar local" : "Agregar local"}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1.5 text-text-secondary transition hover:bg-surface-input"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="overflow-y-auto">
              <div className="mb-3">
                <label className="mb-1 block text-sm text-text-primary">
                  Nombre del local *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Carnicería Don Pedro"
                  className={inputClass}
                  autoFocus
                />
              </div>

              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-text-primary">
                    Categoría / tipo
                  </label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                    placeholder="Ej: Carnicería"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-text-primary">
                    Descuento / beneficio *
                  </label>
                  <input
                    type="text"
                    value={form.discount}
                    onChange={(e) =>
                      setForm({ ...form, discount: e.target.value })
                    }
                    placeholder="Ej: 10%, 2x1, $500"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="mb-1 block text-sm text-text-primary">
                  Dirección
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  placeholder="Ej: Av. Pellegrini 1234"
                  className={inputClass}
                />
              </div>

              <div className="mb-3">
                <label className="mb-1 block text-sm text-text-primary">
                  Contacto (teléfono / WhatsApp)
                </label>
                <input
                  type="text"
                  value={form.contact}
                  onChange={(e) =>
                    setForm({ ...form, contact: e.target.value })
                  }
                  placeholder="Ej: 341 555-1234 / WhatsApp"
                  className={inputClass}
                />
              </div>

              <div className="mb-4">
                <label className="mb-1 block text-sm text-text-primary">
                  Descripción / condiciones
                </label>
                <textarea
                  rows="3"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Ej: 10% de descuento presentando el QR, máximo 1 uso por visita."
                  className={inputClass}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-border px-3 py-2 text-xs text-text-primary transition hover:bg-surface-input"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white transition active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting
                    ? "Guardando..."
                    : form.id
                      ? "Guardar"
                      : "Agregar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CommunityPanel;