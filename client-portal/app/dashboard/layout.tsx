import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Topbar from "@/components/Topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .single();

  return (
    <div style={{ minHeight: "100vh", background: "var(--am-bg)" }}>
      <Topbar
        userName={profile?.full_name || user.email?.split("@")[0]}
        userEmail={user.email}
      />
      <main className="pb-[72px] md:pb-0" style={{ paddingTop: 52 }}>
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "28px 20px",
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
