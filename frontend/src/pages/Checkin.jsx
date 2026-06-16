import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL;

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
      const res = await fetch(
        `${API_URL}/api/attendance/checkin/${memberToken}/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      const data = await res.json();

      setMessage(data.message);
    } catch (error) {
      console.error(error);

      setMessage("No pudimos registrar tu asistencia");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6 text-center text-text-primary">
      <h1>{message}</h1>
    </div>
  );
}
