import type { Metadata } from "next";
import { Workspace } from "@/components/workspace/Workspace";

export const metadata: Metadata = {
  title: "Workspace Proyek",
  description: "Editor naskah, breakdown adegan, jadwal syuting, dan anggaran real-time.",
};

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Workspace id={id} />;
}
