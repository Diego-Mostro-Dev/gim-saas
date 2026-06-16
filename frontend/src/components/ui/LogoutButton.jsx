export default function LogoutButton() {
  function handleLogout() {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded bg-danger px-3 py-2 text-text-primary"
    >
      Cerrar sesión
    </button>
  );
}
