import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { apiFetch } from "../services/api";

export default function Checkin() {
  const { gymCode } = useParams();
  const navigate = useNavigate();

  const [message, setMessage] = useState("Registrando asistencia...");
  const [redirecting, setRedirecting] = useState(false);
  const redirectTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
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
  }, [gymCode]);

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
            "Regularizá el pago con el gimnasio para volver a utilizar esta función."
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
      } else {
        setMessage(error?.message || "No pudimos registrar tu asistencia");
      }
    }
  }

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
