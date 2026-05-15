import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "Noir Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  // Identity gate — Supabase session required.
  if (!user) redirect("/prijava");

  // Authority gate — only platform super-admins reach the dashboard.
  if (user.platform_role !== "super_admin") redirect("/");

  const name =
    [user.profile.first_name, user.profile.last_name]
      .filter(Boolean)
      .join(" ") ||
    user.email ||
    "Admin";

  return (
    <div className="admin-theme min-h-screen">
      <TooltipProvider delayDuration={0}>
        <SidebarProvider>
          <AdminSidebar />
          <SidebarInset>
            <AdminHeader name={name} email={user.email ?? ""} />
            <div className="flex-1 p-4 md:p-6">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </div>
  );
}
