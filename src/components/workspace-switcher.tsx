"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check, ChevronsUpDown, Plus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  avatar?: string;
  role: "owner" | "admin" | "editor" | "viewer";
}

export function WorkspaceSwitcher() {
  const router = useRouter();
  const { workspaceId } = useParams();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  // Get workspaces from session
  const workspaces: Workspace[] = session?.workspaces?.map(w => ({
    id: w.id,
    name: w.name,
    slug: w.slug,
    role: w.role,
    avatar: `https://avatar.vercel.sh/${w.slug}`,
  })) || [];

  const currentWorkspace = workspaces.find(w => w.id === workspaceId) || workspaces[0];

  const handleWorkspaceSelect = (workspace: Workspace) => {
    router.push(`/workspaces/${workspace.id}`);
    setOpen(false);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "owner":
        return "text-blue-600";
      case "admin": 
        return "text-green-600";
      case "editor":
        return "text-yellow-600";
      case "viewer":
        return "text-gray-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[240px] justify-between"
        >
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarImage src={currentWorkspace?.avatar} />
              <AvatarFallback className="text-xs">
                {currentWorkspace?.name?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{currentWorkspace?.name}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0">
        <Command>
          <CommandInput placeholder="Search workspaces..." />
          <CommandList>
            <CommandEmpty>No workspace found.</CommandEmpty>
            <CommandGroup heading="Workspaces">
              {workspaces.map((workspace) => (
                <CommandItem
                  key={workspace.id}
                  onSelect={() => handleWorkspaceSelect(workspace)}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-2 w-full">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={workspace.avatar} />
                      <AvatarFallback className="text-xs">
                        {workspace.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{workspace.name}</div>
                      <div className={cn("text-xs capitalize", getRoleBadgeColor(workspace.role))}>
                        {workspace.role}
                      </div>
                    </div>
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        currentWorkspace?.id === workspace.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  router.push("/workspaces/new");
                }}
                className="cursor-pointer"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Workspace
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  router.push(`/workspaces/${currentWorkspace?.id}/settings`);
                }}
                className="cursor-pointer"
              >
                <Users className="mr-2 h-4 w-4" />
                Manage Members
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}