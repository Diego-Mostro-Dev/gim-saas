import { useState } from "react";
import toast from "react-hot-toast";

import MemberForm from "../components/members/MemberForm";
import { registerPublicMember } from "../services/publicRegister.service";

const INITIAL_FORM = {
  first_name: "",
  last_name: "",
  phone: "",
  email: "",
  schedules: [],
};

function Register() {
  const [formData, setFormData] = useState(INITIAL_FORM);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setIsSubmitting(true);

      await registerPublicMember(formData);

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
      <div className="min-h-screen bg-[#141414] p-6 text-white">
        <div className="mx-auto max-w-xl rounded-2xl bg-[#201f1f] p-8 text-center">
          <h1 className="mb-4 text-3xl font-bold">¡Registro completado!</h1>

          <p className="text-zinc-300">
            Tus datos fueron enviados correctamente.
          </p>

          <button
            onClick={() => setSuccess(false)}
            className="mt-6 rounded-xl bg-blue-500 px-5 py-3 text-white"
          >
            Registrar otra persona
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414] p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-white">
            Registro al gimnasio
          </h1>

          <p className="mt-2 text-zinc-400">
            Completá tus datos y elegí tus horarios.
          </p>
        </div>

        <MemberForm
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleSubmit}
          editingMember={null}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}

export default Register;
