import { permanentRedirect } from "next/navigation";

// Preserve old bookmarks without exposing the retired public ranking.
export default function LeaderboardPage() {
  permanentRedirect("/predictions");
}
