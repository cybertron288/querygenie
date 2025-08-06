"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Database,
  FileCode,
  FileText,
  Users,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
  History,
  BookOpen,
  Key,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
// import { WorkspaceSwitcher } from "@/components/workspace-switcher";

interface SidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
  workspaceId?: string;
}

export function Sidebar({ isOpen = true, onToggle, workspaceId }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: Home,
    },
    {
      title: "Connections",
      href: "/connections",
      icon: Database,
    },
    {
      title: "Query Editor",
      href: "/editor",
      icon: FileCode,
    },
    {
      title: "AI Assistant",
      href: "/ai",
      icon: Sparkles,
    },
    {
      title: "Query History",
      href: "/history",
      icon: History,
    },
    {
      title: "Documentation",
      href: "/docs",
      icon: BookOpen,
    },
    {
      title: "API Keys",
      href: "/api-keys",
      icon: Key,
    },
  ];

  const bottomNavItems = [
    {
      title: "Team",
      href: "/team",
      icon: Users,
    },
    {
      title: "Settings",
      href: "/settings",
      icon: Settings,
    },
    {
      title: "Help & Support",
      href: "/help",
      icon: HelpCircle,
    },
  ];

  const handleCollapse = () => {
    setIsCollapsed(!isCollapsed);
    onToggle?.();
  };

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "relative flex flex-col border-r bg-background transition-all duration-300",
          isCollapsed ? "w-16" : "w-64",
          !isOpen && "hidden lg:flex"
        )}
      >
        {/* Collapse button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-3 top-20 z-10 h-6 w-6 rounded-full border bg-background"
          onClick={handleCollapse}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </Button>

        {/* Workspace selector - commented out for now */}
        {/* <div className="border-b p-4">
          {isCollapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-full">
                  <FolderOpen className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Switch Workspace
              </TooltipContent>
            </Tooltip>
          ) : (
            <WorkspaceSwitcher />
          )}
        </div> */}

        {/* Main navigation */}
        <ScrollArea className="flex-1">
          <nav className="space-y-1 p-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Tooltip key={item.href} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-secondary text-secondary-foreground"
                          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                        isCollapsed && "justify-center"
                      )}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </Link>
                  </TooltipTrigger>
                  {isCollapsed && (
                    <TooltipContent side="right">
                      <p>{item.title}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </nav>
        </ScrollArea>

        {/* Bottom navigation */}
        <div className="border-t p-2">
          <nav className="space-y-1">
            {bottomNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Tooltip key={item.href} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-secondary text-secondary-foreground"
                          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                        isCollapsed && "justify-center"
                      )}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </Link>
                  </TooltipTrigger>
                  {isCollapsed && (
                    <TooltipContent side="right">
                      <p>{item.title}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </nav>
        </div>
      </aside>
    </TooltipProvider>
  );
}