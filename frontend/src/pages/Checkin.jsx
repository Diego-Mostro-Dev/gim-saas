import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { apiFetch } from "../services/api";
import { getPublicGym } from "../services/gym.service";
import { txt } from "../utils/labels";

export default function Checkin() {
  const { gymCode } = useParams();
  const navigate = useNavigate();

  const [message, setMessage] = useState("Registrando asistencia...");
  const [gym, setGym] = useState(null);
  const [redirecting, setRedirecting] = useState(false);
  const redirectTimerRef = useRef(null);

  useEffect(() => {
    if (!gymCode) return;
    getPublicGym(gymCode).then(setGym).catch(() => {});
  }, [gymCode]);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  function goToPortal(memberToken) {
    redirectTimerRef.current = setTimeout(() => {
      navigate(`/routine/${memberToken}`);
    }, 2000);
  }

  async function registerAttendance(memberToken) {
    try {
      const data = await apiFetch(`/api/attendance/checkin/${memberToken}/`, {
        method: "POST",
        skipAuth: true,
      });

      // ACC-04: el backend responde 409 cuando la asistencia ya estaba
      // registrada. Si aun así llega un 200 con success:false, no se
      // redirige como si fuera un éxito.
      if (data?.success === false) {
        setMessage(data?.message || "No pudimos registrar tu asistencia");
        return;
      }

      setMessage(data?.message || "Asistencia registrada");
      setRedirecting(true);
      goToPortal(memberToken);
    } catch (error) {
      console.error(error);

      const blockedByDebt =
        error?.status === 403 &&
        error?.message === "Acceso suspendido por falta de pago.";

      if (blockedByDebt) {
        setMessage(
          "Acceso operativo suspendido\n\n" +
            "No podés registrar tu asistencia porque tenés un saldo pendiente.\n" +
            txt(gym, "checkin.regularize")
        );
      } else if (error?.status === 404) {
        setMessage("Socio no encontrado.");
      } else if (error?.status === 401) {
        setMessage(
          error?.message ||
            "Tu sesión no es válida. Abrí nuevamente tu Portal del Socio."
        );
      } else if (error?.status === 400) {
        setMessage(error?.message || "No se pudo registrar tu asistencia.");
      } else if (error?.status === 403) {
        setMessage(
          error?.message || "No podés registrar tu asistencia en este momento."
        );
      } else if (error?.status === 409) {
        // ACC-04: la asistencia de hoy ya estaba registrada.
        setMessage(error?.message || "Ya registraste asistencia hoy");
      } else {
        setMessage(error?.message || "No pudimos registrar tu asistencia");
      }
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      if (!gymCode) {
        setMessage("Código inválido");
        return;
      }

      const memberToken = localStorage.getItem("member_token");

      if (!memberToken) {
        setMessage("No pudimos identificarte. Abrí primero tu Portal del Socio.");
        return;
      }

      registerAttendance(memberToken);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gymCode]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6 text-center text-text-primary">
      <div>
        <h1 className="whitespace-pre-line">{message}</h1>
        {redirecting && (
          <div className="mt-4 rounded-xl border border-border bg-surface-input px-4 py-3">
            <p className="flex items-center justify-center gap-2 text-sm text-text-primary">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Te llevamos a tu portal...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
