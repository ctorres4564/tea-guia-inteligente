"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui";
import { signOutUser } from "@/domains/auth/service";
import { siteConfig } from "@/config/site";

export function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout() {
    setIsLoading(true);
    try {
      await signOutUser();
    } finally {
      router.push(siteConfig.routes.home);
      router.refresh();
    }
  }

  return (
    <Button variant="secondary" isLoading={isLoading} onClick={handleLogout}>
      Sair
    </Button>
  );
}
