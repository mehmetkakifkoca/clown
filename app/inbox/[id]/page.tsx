"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";

export default function EmailDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/inbox?id=${encodeURIComponent(id)}`);
  }, [id, router]);

  return (
    <div className="min-h-screen bg-background p-6 flex flex-col justify-center items-center">
      <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-3" />
      <p className="text-xs text-secondary">E-posta yükleniyor...</p>
    </div>
  );
}

