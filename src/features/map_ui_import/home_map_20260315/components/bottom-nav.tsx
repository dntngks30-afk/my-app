"use client"

import { motion } from "framer-motion"
import { Map, Route, Compass } from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  id: string
  label: string
  icon: typeof Map
}

const navItems: NavItem[] = [
  { id: "map", label: "지도", icon: Map },
  { id: "journey", label: "리셋", icon: Route },
  { id: "my", label: "여정", icon: Compass },
]

interface BottomNavProps {
  activeTab?: string
  onTabChange?: (tab: string) => void
}

export function BottomNav({ activeTab = "map", onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/95 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-md items-center justify-around px-8 pb-4">
        {navItems.map((item) => {
          const isActive = activeTab === item.id
          const Icon = item.icon

          return (
            <motion.button
              key={item.id}
              onClick={() => onTabChange?.(item.id)}
              className={cn(
                "relative flex flex-col items-center gap-1.5 px-6 py-2 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
              whileTap={{ scale: 0.92 }}
            >
              {isActive && (
                <motion.div
                  className="absolute -top-px left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full bg-primary"
                  layoutId="activeTab"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
              <span className="text-[11px] font-medium">
                {item.label}
              </span>
            </motion.button>
          )
        })}
      </div>
    </nav>
  )
}
