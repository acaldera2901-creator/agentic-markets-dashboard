import { notFound } from "next/navigation";
import { ProfileScreen } from "@/features/profile/ProfileScreen";

export default function ProfiloPage() {
  if (process.env.NEXT_PUBLIC_UX_NEW !== "1") notFound();
  return <ProfileScreen />;
}
