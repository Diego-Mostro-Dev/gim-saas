import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { apiFetch } from "../services/api";

export default function Checkin() {
  const { gymCode } = useParams();

  const [message, setMessage] = useState("Registrando asistencia...");

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

  async function registerAttendance(memberToken) {
    try {
      const data = await apiFetch(`/api/attendance/checkin/${memberToken}/`, {
        method: "POST",
        skipAuth: true,
      });

      setMessage(data?.message || "Asistencia registrada");
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
      <h1 className="whitespace-pre-line">{message}</h1>
    </div>
  );
}
