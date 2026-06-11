import { useEffect, useRef, useState } from "react";
import { Outlet, useParams, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import {
  getPublicRoutine,
  updatePublicMemberPhoto,
  getPublicSlots,
  getPublicScheduleChangeRequests,
  getPublicScheduleSwapRequests,
} from "../../services/routines.service";

function MemberPortalLayout() {
  const { token } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [routine, setRoutine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [photoFile, setPhotoFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [slots, setSlots] = useState([]);
  const [changeRequests, setChangeRequests] = useState([]);
  const [swapRequests, setSwapRequests] = useState([]);

  const lastRefreshAt = useRef(0);

  useEffect(() => {
    if (token) {
      localStorage.setItem("member_token", token);
    }

    loadRoutine();

    function refreshIfVisible() {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRefreshAt.current < 5 * 60 * 1000) return;
      lastRefreshAt.current = Date.now();
      refreshRoutine();
    }

    document.addEventListener("visibilitychange", refreshIfVisible);
    const interval = setInterval(refreshIfVisible, 5 * 60 * 1000);

    return () => {
      document.removeEventListener("visibilitychange", refreshIfVisible);
      clearInterval(interval);
    };
  }, [token]);

  async function loadRoutine() {
    try {
      setLoading(true);
      const data = await getPublicRoutine(token);
      lastRefreshAt.current = Date.now();
      setRoutine(data);

      if (data.gym?.allow_member_schedule_changes) {
        const [slotsData, requestsData, swapData] = await Promise.all([
          getPublicSlots(token),
          getPublicScheduleChangeRequests(token),
          getPublicScheduleSwapRequests(token),
        ]);
        setSlots(slotsData);
        setChangeRequests(requestsData);
        setSwapRequests(swapData);
      }
    } catch (err) {
      console.error(err);
      setError("No se encontró la rutina.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshRoutine() {
    try {
      const data = await getPublicRoutine(token);
      setRoutine(data);
      lastRefreshAt.current = Date.now();

      if (data.gym?.allow_member_schedule_changes) {
        const [slotsData, requestsData, swapData] = await Promise.all([
          getPublicSlots(token),
          getPublicScheduleChangeRequests(token),
          getPublicScheduleSwapRequests(token),
        ]);
        setSlots(slotsData);
        setChangeRequests(requestsData);
        setSwapRequests(swapData);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handlePhotoUpload() {
    if (!photoFile) return;

    try {
      setUploadingPhoto(true);
      const response = await updatePublicMemberPhoto(token, photoFile);
      setRoutine((prev) => ({
        ...prev,
        member: {
          ...prev.member,
          photo: response.photo,
        },
      }));
      setPhotoFile(null);
      setPreview(null);
      toast.success("Foto actualizada correctamente");
    } catch (error) {
      console.error(error);
      toast.error("No se pudo actualizar la foto");
    } finally {
      setUploadingPhoto(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#161616] text-white">
        Cargando portal...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#161616] text-red-400">
        {error}
      </div>
    );
  }

  const { member, gym } = routine;

  const tabs = [
    { path: `/routine/${token}`, label: "Inicio" },
    { path: `/routine/${token}/workout`, label: "Rutina" },
    { path: `/routine/${token}/payments`, label: "Pagos" },
    { path: `/routine/${token}/schedules`, label: "Horarios" },
  ];

  return (
    <div className="min-h-screen bg-[#161616]">
      <div className="mx-auto max-w-2xl pb-24 sm:pb-6">
        <div className="p-4">
          <div className="rounded-2xl bg-[#201f1f] p-6">
            <div className="flex items-center gap-4">
              {member.photo ? (
                <img
                  src={member.photo}
                  alt={member.first_name}
                  className="h-20 w-20 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-pink-500 text-2xl font-bold text-white">
                  {member.first_name?.charAt(0)}
                  {member.last_name?.charAt(0)}
                </div>
              )}

              <div className="flex-1">
                <h1 className="text-2xl font-bold text-white">
                  {member.first_name} {member.last_name}
                </h1>
                <p className="text-zinc-400">Socio de {gym.name}</p>
              </div>
            </div>

            <div className="mt-5 border-t border-white/5 pt-4">
              <label className="mb-2 block text-sm text-zinc-400">
                Cambiar foto
              </label>

              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setPhotoFile(file);

                  if (file) {
                    setPreview(URL.createObjectURL(file));
                  } else {
                    setPreview(null);
                  }
                }}
                className="w-full rounded-xl bg-[#2a2a2a] px-3 py-2 text-sm text-white"
              />

              {preview && (
                <div className="mt-4">
                  <p className="mb-2 text-sm text-zinc-400">Vista previa</p>
                  <img
                    src={preview}
                    alt="Preview"
                    className="h-24 w-24 rounded-full border border-white/10 object-cover"
                  />
                </div>
              )}

              {photoFile && (
                <button
                  onClick={handlePhotoUpload}
                  disabled={uploadingPhoto}
                  className="mt-3 rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white"
                >
                  {uploadingPhoto ? "Subiendo..." : "Actualizar foto"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="hidden sm:block px-4 mb-6">
          <div className="flex rounded-xl bg-[#2a2a2a] p-1">
            {tabs.map((tab) => {
              const active = location.pathname === tab.path;
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-blue-500 text-white"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4">
          <Outlet
            context={{
              routine,
              token,
              refreshRoutine,
              slots,
              changeRequests,
              swapRequests,
            }}
          />
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#201f1f] sm:hidden">
        <div className="mx-auto flex max-w-2xl">
          {tabs.map((tab) => {
            const active = location.pathname === tab.path;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition ${
                  active
                    ? "text-blue-400"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default MemberPortalLayout;
