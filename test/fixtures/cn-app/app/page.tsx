import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
export default function P() {
  const busy = false
  return (
    <>
      {/* static-only cn() — SHOULD cluster as static appearance drift */}
      <Button className={cn("bg-blue-600 hover:bg-blue-700 text-white")}>A</Button>
      {/* multi-arg static cn() — same effective set, SHOULD join + cluster with A */}
      <Button className={cn("bg-blue-600", "hover:bg-blue-700", "text-white")}>B</Button>
      {/* conditional cn() — SHOULD stay dynamic/untouchable */}
      <Button className={cn(busy && "opacity-50", "bg-red-600")}>C</Button>
    </>
  )
}
