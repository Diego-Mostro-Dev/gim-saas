export default function LogoutButton() {
  function handleLogout() {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded bg-red-600 px-3 py-2 text-white"
    >
      Cerrar sesión
    </button>
  );
}
