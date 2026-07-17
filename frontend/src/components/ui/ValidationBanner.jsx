import { AlertTriangle } from "lucide-react";

function ValidationBanner({ message }) {
  if (!message) return null;

  return (
    <div className="flex items-center gap-2 rounded-xl bg-warning-bg dark:bg-warning/10 px-4 py-3">
      <AlertTriangle size={16} className="text-warning-text dark:text-warning" />
      <p className="text-sm text-warning-text dark:text-warning">{message}</p>
    </div>
  );
}

export default ValidationBanner;
