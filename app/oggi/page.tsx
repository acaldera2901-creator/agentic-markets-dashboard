import { notFound } from "next/navigation";
import { FeedScreen } from "@/features/feed/FeedScreen";

export default function OggiPage() {
  if (process.env.NEXT_PUBLIC_UX_NEW !== "1") notFound();
  return <FeedScreen />;
}
