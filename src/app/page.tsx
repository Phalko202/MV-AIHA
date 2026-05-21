import SurveillancePortal from "@/components/SurveillancePortal";
import { redirect } from "next/navigation";
import { isAiPaused } from "@/lib/openrouter";

export default function Home() {
  if (process.env.MV_PORTAL_MODE === "vinavi") {
    redirect("/vinavi");
  }

  return <SurveillancePortal aiPaused={isAiPaused()} />;
}
