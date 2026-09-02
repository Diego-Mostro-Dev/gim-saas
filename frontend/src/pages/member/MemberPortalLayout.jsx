import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Outlet, useParams, useLocation, useNavigate } from "react-router-dom";

import { Home, Dumbbell, CreditCard, Calendar, Sparkles } from "lucide-react";
import { FeatureProvider, useFeature, FeatureContext } from "../../features/FeatureProvider";
import { usePortalRefreshController } from "../../hooks/usePortalRefreshController";
import { useGymTitle } from "../../hooks/useGymTitle";
import { clearCached } from "../../utils/cache";
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

  const [slotsStatus, setSlotsStatus] = useState("idle");
  const [changeRequestsStatus, setChangeRequestsStatus] = useState("idle");
  const [swapRequestsStatus, setSwapRequestsStatus] = useState("idle");
  const [planChangeRequestsStatus, setPlanChangeRequestsStatus] = useState("idle");

  const currentTokenRef = useRef(token);
  const sectionRequestSeqRef = useRef({});
  const hasInitializedRef = useRef(false);

  useLayoutEffect(() => {
    currentTokenRef.current = token;
  }, [token]);

  function beginSectionRequest(section) {
    const seq = (sectionRequestSeqRef.current[section] ?? 0) + 1;
    sectionRequestSeqRef.current[section] = seq;
    return { section, token, seq };
  }

  function canApplySection(ctx) {
    return (
      ctx.token === currentTokenRef.current &&
      sectionRequestSeqRef.current[ctx.section] === ctx.seq
    );
  }

  async function loadSlots({ force = false } = {}) {
    if (force) {
      setSlotsStatus("loading");
    } else {
      setSlotsStatus((prev) => (prev === "idle" ? "loading" : prev));
    }
    const ctx = beginSectionRequest("slots");
    try {
      const slotsData = await getPublicSlots(token);
      if (!canApplySection(ctx)) return;
      setSlots(slotsData);
      setSlotsStatus("success");
    } catch (err) {
      console.error(err);
      if (!canApplySection(ctx)) return;
      setSlotsStatus("error");
    }
  }

  async function loadChangeRequests({ force = false } = {}) {
    if (force) {
      setChangeRequestsStatus("loading");
    } else {
      setChangeRequestsStatus((prev) => (prev === "idle" ? "loading" : prev));
    }
    const ctx = beginSectionRequest("changeRequests");
    try {
      const requestsData = await getPublicScheduleChangeRequests(token);
      if (!canApplySection(ctx)) return;
      setChangeRequests(requestsData);
      setChangeRequestsStatus("success");
    } catch (err) {
      console.error(err);
      if (!canApplySection(ctx)) return;
      setChangeRequestsStatus("error");
    }
  }

  async function loadSwapRequests({ force = false } = {}) {
    if (force) {
      setSwapRequestsStatus("loading");
    } else {
      setSwapRequestsStatus((prev) => (prev === "idle" ? "loading" : prev));
    }
    const ctx = beginSectionRequest("swapRequests");
    try {
      const swapData = await getPublicScheduleSwapRequests(token);
      if (!canApplySection(ctx)) return;
      setSwapRequests(swapData);
      setSwapRequestsStatus("success");
    } catch (err) {
      console.error(err);
      if (!canApplySection(ctx)) return;
      setSwapRequestsStatus("error");
    }
  }

  async function loadPlanChangeRequests({ force = false } = {}) {
    if (force) {
      setPlanChangeRequestsStatus("loading");
    } else {
      setPlanChangeRequestsStatus((prev) =>
        prev === "idle" ? "loading" : prev,
      );
    }
    const ctx = beginSectionRequest("planChangeRequests");
    try {
      const planRequestsData = await getPublicPlanChangeRequests(token);
      if (!canApplySection(ctx)) return;
      setPlanChangeRequests(planRequestsData);
      setPlanChangeRequestsStatus("success");
    } catch {
      // plan change requests are optional
      console.error("plan change requests failed");
      if (!canApplySection(ctx)) return;
      setPlanChangeRequestsStatus("error");
    }
  }

  function reloadSlots() {
    return loadSlots({ force: true });
  }

  function reloadChangeRequests() {
    return loadChangeRequests({ force: true });
  }

  function reloadSwapRequests() {
    return loadSwapRequests({ force: true });
  }

  async function loadSecondaryRequests(data) {
    const secondaryLoads = [];
    if (data.gym?.allow_schedule_changes !== false) {
      secondaryLoads.push(loadSlots(), loadChangeRequests(), loadSwapRequests());
    }
    if (data.gym?.allow_plan_changes !== false) {
      secondaryLoads.push(loadPlanChangeRequests());
    }
    await Promise.all(secondaryLoads);
  }

  async function loadRoutine() {
    const ctx = beginSectionRequest("routine");
    try {
      setLoading(true);
      const data = await getPublicRoutine(token);
      if (!canApplySection(ctx)) return;
      setRoutine(data);
      await loadSecondaryRequests(data);
    } catch (err) {
      console.error(err);
      if (!canApplySection(ctx)) return;
      setError("No se pudo cargar el portal.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshRoutine() {
    const ctx = beginSectionRequest("routine");
    try {
      const data = await getPublicRoutine(token);
      if (!canApplySection(ctx)) return undefined;
      setRoutine(data);
      await loadSecondaryRequests(data);
      return data;
    } catch (err) {
      console.error(err);
      return undefined;
    }
  }

  const { request, runInitialLoad } = usePortalRefreshController({
    refresh: refreshRoutine,
    initialLoad: loadRoutine,
  });

  function refreshNow() {
    clearCached(`public-routine-${token}`);
    return request({ cause: "manual", force: true });
  }

  useEffect(() => {
    if (token) {
      localStorage.setItem("member_token", token);
    }

    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      runInitialLoad();
    }
  }, [token, runInitialLoad]);

  async function handlePhotoUpload() {
    if (!photoFile) return;
    const paymentStatus = routine?.subscription?.payment_status;
    if (paymentStatus === "blocked" || paymentStatus === "initial_pending") {
      return;
    }

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

  return (
    <FeatureProvider mode="public" initialFeatures={routine?.gym?.features} onRefreshFeatures={refreshNow}>
      <MemberPortalLayoutContent
        routine={routine}
        token={token}
        location={location}
        navigate={navigate}
        photoFile={photoFile}
        preview={preview}
        uploadingPhoto={uploadingPhoto}
        setPhotoFile={setPhotoFile}
        setPreview={setPreview}
        handlePhotoUpload={handlePhotoUpload}
        slots={slots}
        changeRequests={changeRequests}
        swapRequests={swapRequests}
        planChangeRequests={planChangeRequests}
        slotsStatus={slotsStatus}
        changeRequestsStatus={changeRequestsStatus}
        swapRequestsStatus={swapRequestsStatus}
        planChangeRequestsStatus={planChangeRequestsStatus}
        reloadSlots={reloadSlots}
        reloadChangeRequests={reloadChangeRequests}
        reloadSwapRequests={reloadSwapRequests}
        refreshRoutine={refreshNow}
      />
    </FeatureProvider>
  );
}

function MemberPortalLayoutContent({
  routine,
  token,
  location,
  navigate,
  photoFile,
  preview,
  uploadingPhoto,
  setPhotoFile,
  setPreview,
  handlePhotoUpload,
  slots,
  changeRequests,
  swapRequests,
  planChangeRequests,
  slotsStatus,
  changeRequestsStatus,
  swapRequestsStatus,
  planChangeRequestsStatus,
  reloadSlots,
  reloadChangeRequests,
  reloadSwapRequests,
  refreshRoutine,
}) {
  const { member, gym } = routine;
  useGymTitle(routine.gym, token);
  const isActivityOnly = member.entry_mode === "ACTIVITY_ONLY";
  const activitiesEnabled = useFeature("activities");
  const { features } = useContext(FeatureContext);
  const paymentStatus = routine?.subscription?.payment_status;
  const isOperativeBlocked =
    paymentStatus === "blocked" || paymentStatus === "initial_pending";
  const isInitialPending = paymentStatus === "initial_pending";
  const outstandingDebtTotal = routine?.outstanding_debt?.total;

  const routeFeatureMap = {
    [`/routine/${token}/activities`]: "activities",
  };
  const homeRoute = `/routine/${token}`;

  // Pre-render guard: prevent flash of disabled feature content
  const featureKey = routeFeatureMap[location.pathname];
  if (featureKey && Object.keys(features).length > 0 && features[featureKey] === false) {
    navigate(homeRoute, { replace: true });
    return null;
  }

  useEffect(() => {
    const featureName = routeFeatureMap[location.pathname];
    if (!featureName) return;
    if (Object.keys(features).length === 0) return;
    if (features[featureName] === false) {
      navigate(homeRoute, { replace: true });
    }
  }, [location.pathname, features, navigate]);

  const activitiesTab = [
    { path: `/routine/${token}/activities`, label: "Actividades", icon: Sparkles },
  ];

  const allTabs = isActivityOnly
    ? [
        { path: `/routine/${token}`, label: "Inicio", icon: Home },
        { path: `/routine/${token}/payments`, label: "Pagos", icon: CreditCard },
        ...activitiesTab,
      ]
    : [
        { path: `/routine/${token}`, label: "Inicio", icon: Home },
        { path: `/routine/${token}/workout`, label: "Rutina", icon: Dumbbell },
        { path: `/routine/${token}/payments`, label: "Pagos", icon: CreditCard },
        ...activitiesTab,
        { path: `/routine/${token}/schedules`, label: "Horarios", icon: Calendar },
      ];

  const tabs = activitiesEnabled ? allTabs : allTabs.filter((t) => t.path !== `/routine/${token}/activities`);

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
              {isOperativeBlocked ? (
                <span
                  className="inline-block cursor-not-allowed rounded-xl bg-surface-input px-4 py-2 text-sm font-medium text-text-secondary opacity-60"
                  title="No disponible por falta de pago"
                >
                  {member.photo ? "Cambiar foto" : "Subir foto"}
                </span>
              ) : (
                <label
                  htmlFor="photo-upload"
                  className="inline-block cursor-pointer rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90"
                >
                  {member.photo ? "Cambiar foto" : "Subir foto"}
                </label>
              )}

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

        {isOperativeBlocked && (
          <div className="px-4 mb-4">
            <div className="rounded-xl border border-danger/20 bg-danger-bg/20 dark:bg-danger/10 px-4 py-3 text-sm text-danger-text dark:text-danger">
              <p className="font-semibold">
                {isInitialPending
                  ? "Pago inicial pendiente"
                  : "Acceso operativo suspendido"}
              </p>
              {isInitialPending ? (
                <p className="mt-1 text-xs leading-relaxed opacity-90">
                  Todavía no podés usar las funciones del portal: tu alta está
                  pendiente del pago inicial con el gimnasio.
                </p>
              ) : (
                <>
                  {outstandingDebtTotal !== undefined &&
                    Number(outstandingDebtTotal) > 0 && (
                      <p className="mt-1 font-medium">
                        Tenés un saldo pendiente de $
                        {Number(outstandingDebtTotal).toLocaleString("es-AR")}.
                      </p>
                    )}
                  <p className="mt-1 text-xs leading-relaxed opacity-90">
                    Para volver a utilizar las funciones del portal, regularizá
                    tu pago con el gimnasio.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

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
                  <span className="hidden sm:inline">{tab.label}</span>
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
              slotsStatus,
              changeRequestsStatus,
              swapRequestsStatus,
              planChangeRequestsStatus,
              reloadSlots,
              reloadChangeRequests,
              reloadSwapRequests,
              isOperativeBlocked,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default MemberPortalLayout;
