"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/push";

export function ServiceWorkerRegistry() {
  useEffect(() => {
    registerServiceWorker();
  }, []);
  return null;
}
