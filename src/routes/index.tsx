import { createFileRoute } from "@tanstack/react-router";
import { CatalystApp } from "@/components/catalyst/app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <CatalystApp />;
}
