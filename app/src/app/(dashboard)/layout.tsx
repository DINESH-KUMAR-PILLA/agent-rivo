import { redirect } from "next/navigation";
import { NavBar } from "@/components/nav";
import { currentAppUser } from "@/lib/dashboard";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const me = await currentAppUser();
  if (!me) redirect("/login");

  return (
    <div className="min-h-screen">
      <NavBar displayName={me.display_name} />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
