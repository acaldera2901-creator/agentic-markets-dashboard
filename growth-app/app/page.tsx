import { parseWindow } from "@/core/kpi";
import { getSource } from "@/data";
import { GrowthDashboard } from "@/ui/GrowthDashboard";

// Auth is enforced in proxy.ts before this renders. The page only wires a
// source to the component: swapping the source never touches the UI.
export default async function Page({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const w = parseWindow((await searchParams).w);
  const { data, meta } = await (await getSource()).load(w);
  return <GrowthDashboard data={data} meta={meta} hrefFor={(x) => `/?w=${x}`} />;
}
