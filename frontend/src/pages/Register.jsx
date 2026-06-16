import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";

import MemberForm from "../components/members/MemberForm";
import {
  registerPublicMember,
  getPublicSlots,
  getPublicPlans,
} from "../services/publicRegister.service";

const INITIAL_FORM = {
  first_name: "",
  last_name: "",
  phone: "",
  email: "",
  photo: null,
  schedules: [],
  plan_id: null,
};

function Register() {
  const { gymCode } = useParams();

  const [formData, setFormData] = useState(INITIAL_FORM);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [success, setSuccess] = useState(false);

  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(true);

  const [availablePlans, setAvailablePlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [slots, plans] = await Promise.all([
          getPublicSlots(gymCode),
          getPublicPlans(gymCode),
        ]);
        setAvailableSlots(slots);
        setAvailablePlans(plans);
      } catch {
        toast.error("Error al cargar datos disponibles");
      } finally {
        setLoadingSlots(false);
        setLoadingPlans(false);
      }
    }
    load();
  }, [gymCode]);

  async function handleSubmit(e) {
    e.preventDefault();

    if (availablePlans.length > 0 && !formData.plan_id) {
      toast.error("Por favor seleccioná un plan.");
      return;
    }

    try {
      setIsSubmitting(true);

      const form = new FormData();

      form.append("first_name", formData.first_name);
      form.append("last_name", formData.last_name);
      form.append("phone", formData.phone);
      form.append("email", formData.email || "");

      if (formData.photo) {
        form.append("photo", formData.photo);
      }

      form.append("schedules", JSON.stringify(formData.schedules || []));

      if (formData.plan_id) {
        form.append("plan_id", formData.plan_id);
      }

      await registerPublicMember(gymCode, form);

      setSuccess(true);

      toast.success("Registro realizado correctamente");

      setFormData(INITIAL_FORM);
    } catch (error) {
      toast.error(error.message || "Error al registrarse");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-surface p-6 text-text-primary">
        <div className="mx-auto max-w-xl rounded-xl bg-surface-elevated p-8 text-center">
          <h1 className="mb-4 text-3xl font-bold">¡Registro completado!</h1>

          <p className="text-text-secondary">
            Tus datos fueron enviados correctamente.
          </p>

          <button
            onClick={() => setSuccess(false)}
            className="mt-6 rounded-xl bg-primary px-5 py-3 text-white"
          >
            Registrar otra persona
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-text-primary">
            Registro al gimnasio
          </h1>

          <p className="mt-2 text-text-secondary">
            Completá tus datos y elegí tus horarios.
          </p>
        </div>

        <MemberForm
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleSubmit}
          editingMember={null}
          isSubmitting={isSubmitting}
          availableSlots={availableSlots}
          loadingSlots={loadingSlots}
          availablePlans={availablePlans}
          loadingPlans={loadingPlans}
        />
      </div>
    </div>
  );
}

export default Register;
