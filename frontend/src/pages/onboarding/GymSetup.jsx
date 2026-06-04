import useAuthStore from "../../store/auth.store";

export default function GymSetup() {
  const setGym = useAuthStore((state) => state.setGym);

  function handleCreateGym() {
    // mock temporal
    setGym({
      id: 1,
      name: "Sinkro",
    });

    window.location.href = "/dashboard";
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="text-center">
        <h1 className="text-2xl mb-4">Crear tu gimnasio</h1>

        <button
          onClick={handleCreateGym}
          className="bg-blue-600 px-4 py-2 rounded"
        >
          Crear Gym (demo)
        </button>
      </div>
    </div>
  );
}
