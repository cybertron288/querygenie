"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "rectangular" | "circular";
  width?: string | number;
  height?: string | number;
}

export function SkeletonAnimated({
  className,
  variant = "text",
  width,
  height,
}: SkeletonProps) {
  const baseStyles = "bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:200%_100%]";
  
  const variantStyles = {
    text: "h-4 rounded-md",
    rectangular: "rounded-md",
    circular: "rounded-full",
  };

  return (
    <motion.div
      className={cn(baseStyles, variantStyles[variant], className)}
      style={{ width, height }}
      animate={{
        backgroundPosition: ["200% 0", "-200% 0"],
      }}
      transition={{
        duration: 1.5,
        ease: "linear",
        repeat: Infinity,
      }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="p-4 border rounded-lg space-y-3">
      <SkeletonAnimated variant="text" className="w-1/3" />
      <SkeletonAnimated variant="text" className="w-full" />
      <SkeletonAnimated variant="text" className="w-4/5" />
      <div className="flex gap-2 pt-2">
        <SkeletonAnimated variant="rectangular" className="h-8 w-20" />
        <SkeletonAnimated variant="rectangular" className="h-8 w-20" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted/50 p-3 border-b">
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((col) => (
            <SkeletonAnimated key={col} variant="text" className="flex-1" />
          ))}
        </div>
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-3">
            <div className="flex gap-4">
              {[1, 2, 3, 4].map((col) => (
                <SkeletonAnimated 
                  key={col} 
                  variant="text" 
                  className="flex-1"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}