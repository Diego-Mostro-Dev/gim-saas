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

    registerAttendance(gymCode);
  }, [gymCode]);

  async function registerAttendance(token) {
    try {
      const res = await fetch(
        `http://localhost:8000/api/attendance/checkin/${token}/`,
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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#161616",
        color: "white",
        padding: 24,
        textAlign: "center",
      }}
    >
      <h1>{message}</h1>
    </div>
  );
}
