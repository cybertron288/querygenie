"use client";

import { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "next-themes";
import { useState } from "react";

/**
 * Global providers for the application
 * 
 * Includes:
 * - NextAuth session provider
 * - React Query for server state
 * - Theme provider for dark mode
 * - React Query DevTools (development only)
 */

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  // Create React Query client with optimized settings
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Stale time: how long before data is considered stale
            staleTime: 60 * 1000, // 1 minute
            
            // Cache time: how long to keep unused data in cache
            gcTime: 5 * 60 * 1000, // 5 minutes
            
            // Retry configuration
            retry: (failureCount, error: any) => {
              // Don't retry on 4xx errors
              if (error?.response?.status >= 400 && error?.response?.status < 500) {
                return false;
              }
              // Retry up to 3 times for other errors
              return failureCount < 3;
            },
            
            // Retry delay
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            
            // Refetch configuration
            refetchOnWindowFocus: false,
            refetchOnMount: true,
            refetchOnReconnect: "always",
          },
          mutations: {
            // Retry configuration for mutations
            retry: false, // Don't retry mutations by default
            
            // Network mode
            networkMode: "online",
          },
        },
      })
  );

  return (
    <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        {process.env.NODE_ENV === "development" && (
          <ReactQueryDevtools initialIsOpen={false} position="bottom" />
        )}
      </QueryClientProvider>
    </SessionProvider>
  );
}