import { ReactNode } from "react";

interface WorkspaceLayoutProps {
  children: ReactNode;
  params: {
    workspaceId: string;
  };
}

export default function WorkspaceLayout({ 
  children, 
  params: { workspaceId } 
}: WorkspaceLayoutProps) {
  return (
    <div className="workspace-layout" data-workspace-id={workspaceId}>
      {children}
    </div>
  );
}