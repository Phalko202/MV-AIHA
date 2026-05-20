import SurveillancePortal from "@/components/SurveillancePortal";
import { redirect } from "next/navigation";

export default function Home() {
  if (process.env.MV_PORTAL_MODE === "vinavi") {
    redirect("/vinavi");
  }

  return <SurveillancePortal />;
}
