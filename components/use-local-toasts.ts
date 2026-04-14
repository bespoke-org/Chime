"use client";

import { useCallback, useState } from "react";

import type { ToastData } from "@/components/ui/toast";

export function useLocalToasts() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = useCallback(
    (
      message: string,
      variant: ToastData["variant"] = "success",
      duration?: number,
    ) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { id, message, variant, duration }]);
    },
    [],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return {
    toasts,
    showToast,
    dismissToast,
  };
}
