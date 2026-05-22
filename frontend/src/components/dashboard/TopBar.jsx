import { Menu } from "lucide-react";

function TopBar() {
  return (
    <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-white/10 bg-[#131313]/80 px-4 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <Menu className="text-blue-400" size={22} />
      </div>

      <h1 className="text-xl font-bold tracking-tight text-blue-300">
        SINKRO DASHBOARD
      </h1>

      <div className="h-8 w-8 overflow-hidden rounded-full border border-white/10 bg-[#2a2a2a]">
        <img
          src="https://i.pravatar.cc/100"
          alt="profile"
          className="h-full w-full object-cover"
        />
      </div>
    </header>
  );
}

export default TopBar;