import * as React from "react"
import { cn } from "@/lib/utils"

interface PageTransitionProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function PageTransition({ children, className, ...props }: PageTransitionProps) {
  return (
    <div
      className={cn(
        "animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
