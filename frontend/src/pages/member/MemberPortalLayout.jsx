import { useEffect, useRef, useState } from "react";
import { Outlet, useParams, useLocation, useNavigate } from "react-router-dom";
import { Home, Dumbbell, CreditCard, Calendar, Sparkles } from "lucide-react";
import toast from "react-hot-toast";

import {
  getPublicRoutine,
  updatePublicMemberPhoto,
  getPublicSlots,
  getPublicScheduleChangeRequests,
  getPublicScheduleSwapRequests,
  getPublicPlanChangeRequests,
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
  const [planChangeRequests, setPlanChangeRequests] = useState([]);

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

      if (data.gym?.allow_member_schedule_changes && data.gym?.allow_schedule_changes !== false) {
        const [slotsData, requestsData, swapData] = await Promise.all([
          getPublicSlots(token),
          getPublicScheduleChangeRequests(token),
          getPublicScheduleSwapRequests(token),
        ]);
        setSlots(slotsData);
        setChangeRequests(requestsData);
        setSwapRequests(swapData);
      }

      if (data.gym?.allow_plan_changes !== false) {
        try {
          const planRequestsData = await getPublicPlanChangeRequests(token);
          setPlanChangeRequests(planRequestsData);
        } catch {
          // plan change requests are optional
        }
      }
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar el portal.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshRoutine() {
    try {
      const data = await getPublicRoutine(token);
      setRoutine(data);
      lastRefreshAt.current = Date.now();

      if (data.gym?.allow_member_schedule_changes && data.gym?.allow_schedule_changes !== false) {
        const [slotsData, requestsData, swapData] = await Promise.all([
          getPublicSlots(token),
          getPublicScheduleChangeRequests(token),
          getPublicScheduleSwapRequests(token),
        ]);
        setSlots(slotsData);
        setChangeRequests(requestsData);
        setSwapRequests(swapData);
      }

      if (data.gym?.allow_plan_changes !== false) {
        try {
          const planRequestsData = await getPublicPlanChangeRequests(token);
          setPlanChangeRequests(planRequestsData);
        } catch {
          // plan change requests are optional
        }
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
      <div className="flex min-h-screen items-center justify-center bg-surface text-text-primary">
        Cargando portal...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-danger-text dark:text-danger">
        {error}
      </div>
    );
  }

  const { member, gym } = routine;
  const isActivityOnly = member.entry_mode === "ACTIVITY_ONLY";

  const tabs = isActivityOnly
    ? [
        { path: `/routine/${token}/payments`, label: "Pagos", icon: CreditCard },
        { path: `/routine/${token}/activities`, label: "Actividades", icon: Sparkles },
      ]
    : [
        { path: `/routine/${token}`, label: "Inicio", icon: Home },
        { path: `/routine/${token}/workout`, label: "Rutina", icon: Dumbbell },
        { path: `/routine/${token}/payments`, label: "Pagos", icon: CreditCard },
        { path: `/routine/${token}/activities`, label: "Actividades", icon: Sparkles },
        { path: `/routine/${token}/schedules`, label: "Horarios", icon: Calendar },
      ];

  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto max-w-2xl pb-6">
        <div className="p-4">
          <div className="rounded-xl bg-surface-elevated p-5 shadow-sm">
            <div className="flex items-center gap-4">
              {member.photo ? (
                <img
                  src={member.photo}
                  alt={member.first_name}
                  className="h-20 w-20 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-2xl font-bold text-white">
                  {member.first_name?.charAt(0)}
                  {member.last_name?.charAt(0)}
                </div>
              )}

              <div className="flex-1">
                <h1 className="text-2xl font-bold text-text-primary">
                  {member.first_name} {member.last_name}
                </h1>
                <p className="text-text-secondary">
                  {isActivityOnly ? "Miembro de" : "Socio de"} {gym.name}
                </p>
              </div>
            </div>

            <div className="mt-4 border-t border-border pt-4">
              <input
                type="file"
                id="photo-upload"
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
                className="hidden"
              />
              <label
                htmlFor="photo-upload"
                className="inline-block cursor-pointer rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90"
              >
                {member.photo ? "Cambiar foto" : "Subir foto"}
              </label>

              {preview && (
                <div className="mt-4">
                  <p className="mb-2 text-sm text-text-secondary">Vista previa</p>
                  <div className="flex items-center gap-4">
                    <img
                      src={preview}
                      alt="Preview"
                      className="h-20 w-20 rounded-full border border-border object-cover"
                    />
                    <button
                      onClick={handlePhotoUpload}
                      disabled={uploadingPhoto}
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
                    >
                      {uploadingPhoto ? "Subiendo..." : "Confirmar foto"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 mb-6">
          <div className="flex rounded-xl bg-surface-elevated border border-border p-1">
            {tabs.map((tab) => {
              const active = location.pathname === tab.path;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className={`flex-1 rounded-lg px-2 py-2 text-sm font-medium transition flex items-center justify-center gap-1.5 sm:gap-2 sm:px-4 ${
                    active
                      ? "bg-primary text-white shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <Icon size={18} />
                  <span className="max-[420px]:hidden">{tab.label}</span>
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
              planChangeRequests,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default MemberPortalLayout;
