import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export default function CheckoutPage() {
  const isLoading = false

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Checkout</h1>

      {/* Input: layout-only override (w-full) — Input stays clean */}
      <Input className="w-full" placeholder="Card number" />

      {/* Button cluster A: blue-primary (tokens REORDERED — same effective set) */}
      <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg rounded-full">
        Pay now
      </Button>

      {/* Layout-only override — KEPT */}
      <Button variant="outline" className="w-full mt-3">
        Cancel
      </Button>

      {/* Dynamic className — flagged untouchable, never clustered */}
      <Button className={cn(isLoading && "opacity-50", "w-full")}>
        {isLoading ? "Processing…" : "Apply coupon"}
      </Button>
    </main>
  )
}
