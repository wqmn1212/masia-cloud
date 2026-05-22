import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

const AUTO_DISMISS_MS = 5000;

function ToastItem({ id, title, description, action, dismiss, ...props }) {
  const [hovered, setHovered] = useState(false);
  const timerRef = useRef(null);

  const startTimer = () => {
    timerRef.current = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
  };

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  useEffect(() => {
    if (!hovered) startTimer();
    else clearTimer();
    return clearTimer;
  }, [hovered]);

  return (
    <Toast
      {...props}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="grid gap-1">
        {title && <ToastTitle>{title}</ToastTitle>}
        {description && <ToastDescription>{description}</ToastDescription>}
      </div>
      {action}
      <ToastClose onClick={() => dismiss(id)} />
    </Toast>
  );
}

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastProvider>
      {toasts.filter(t => t.open !== false).map(({ id, title, description, action, ...props }) => (
        <ToastItem key={id} id={id} title={title} description={description} action={action} dismiss={dismiss} {...props} />
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}