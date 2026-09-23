import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import toast from "react-hot-toast";

import {
  getPublicMemberData,
  updatePublicMemberData,
} from "../../services/routines.service";

// P1-1: si el backend rotó el token (vencido/legacy), la respuesta trae el
// nuevo en "access_token". Se persiste y se navega al mismo tab con la URL
// nueva para que todo el portal use el token vigente sin romper el flujo.
function applyRotatedToken(nextToken, currentToken) {
  if (!nextToken || nextToken === currentToken) return false;
  localStorage.setItem("member_token", nextToken);
  return true;
}

const inputClass =
  "w-full rounded-xl border border-border bg-surface-input px-3.5 py-2.5 text-sm text-text-primary placeholder-text-tertiary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

function MemberData() {
  const { routine, refreshRoutine, token } = useOutletContext();
  const { gym } = routine;
  const navigate = useNavigate();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    whatsapp: "",
    phone: "",
    email: "",
    address: "",
    date_of_birth: "",
    document_number: "",
  });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus("loading");
      setError("");
      try {
        const data = await getPublicMemberData(token);
        if (cancelled) return;
        if (applyRotatedToken(data.access_token, token)) {
          navigate(`/routine/${data.access_token}/data`, { replace: true });
          return;
        }
        setForm({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          whatsapp: data.whatsapp || "",
          phone: data.phone || "",
          email: data.email || "",
          address: data.address || "",
          date_of_birth: data.date_of_birth || "",
          document_number: data.document_number || "",
        });
        setStatus("success");
      } catch (err) {
        console.error(err);
        if (cancelled) return;
        setError("No se pudieron cargar tus datos.");
        setStatus("error");
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [token]);

  function setField(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await updatePublicMemberData(token, form);
      if (saved?.access_token && saved.access_token !== token) {
        localStorage.setItem("member_token", saved.access_token);
        navigate(`/routine/${saved.access_token}/data`, { replace: true });
        return;
      }
      await refreshRoutine();
      toast.success("Datos actualizados correctamente");
    } catch (err) {
      console.error(err);
      const detail =
        err?.data?.phone ||
        err?.data?.date_of_birth ||
        err?.data?.detail;
      toast.error(detail || "No se pudieron guardar los datos");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Mis datos</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Editá tu información para que {gym.name} tenga tus datos al día.
        </p>
      </div>

      {status === "loading" && (
        <div className="text-sm text-text-secondary">Cargando tus datos...</div>
      )}

      {status === "error" && (
        <div className="rounded-xl border border-danger/20 bg-danger-bg/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {status === "success" && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl bg-surface-elevated p-5 shadow-sm"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">
                Nombre
              </label>
              <input
                type="text"
                value={form.first_name}
                onChange={(e) => setField("first_name", e.target.value)}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">
                Apellido
              </label>
              <input
                type="text"
                value={form.last_name}
                onChange={(e) => setField("last_name", e.target.value)}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">
                Teléfono
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">
                WhatsApp
              </label>
              <input
                type="tel"
                value={form.whatsapp}
                onChange={(e) => setField("whatsapp", e.target.value)}
                className={inputClass}
                placeholder="Mismo que el teléfono"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">
                Nº de documento
              </label>
              <input
                type="text"
                value={form.document_number}
                onChange={(e) => setField("document_number", e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">
                Fecha de nacimiento
              </label>
              <input
                type="date"
                value={form.date_of_birth}
                onChange={(e) => setField("date_of_birth", e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">
                Dirección
              </label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setField("address", e.target.value)}
                className={inputClass}
                maxLength={255}
                placeholder="Calle, número, localidad..."
              />
            </div>
          </div>

          <p className="mt-1 text-xs text-text-secondary">
            La dirección se usa para coordinar tu entrenamiento personal a
            domicilio.
          </p>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default MemberData;
