import { ChatArea } from "@/components/chat/ChatArea";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { VNCViewer } from "@/components/vnc/VNCViewer";

export default function Page() {
  return (
    <DashboardLayout
      sidebar={<Sidebar />}
      chat={<ChatArea />}
      debug={<DebugPanel />}
      vnc={<VNCViewer />}
    />
  );
}
