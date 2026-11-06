import clsx from "clsx";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type Notify = (message: string, kind?: "success" | "error") => void;
const ToastContext = createContext<Notify | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; message: string; kind: "success" | "error" }[]>([]);
  const nextId = useRef(0);
  const notify = useCallback<Notify>((message, kind = "success") => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 7000 : 3500);
  }, []);
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div aria-live="polite" className="fixed right-4 bottom-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 print:hidden">
        {toasts.map((t) => (
          <div key={t.id} role="status" className="flex items-start gap-2 rounded-md border border-edge bg-card px-3 py-2.5 text-sm font-medium shadow-lg">
            {t.kind === "success" ? <CheckCircle2 size={17} className="mt-px shrink-0 text-brand" /> : <CircleAlert size={17} className={clsx("mt-px shrink-0 text-rose-600")} />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
