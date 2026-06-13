import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function SettingsPage() {
  const isPrimary = true

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Card cluster: accent-border (REORDERED — same set as home) */}
      <Card className="shadow-lg border-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Plan
            {/* Badge cluster: muted-gray square */}
            <Badge className="bg-gray-100 text-gray-600 rounded-sm">Free</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input className="w-full" placeholder="Workspace name" />

          {/* Button cluster B: blue-primary via ARBITRARY values (#2563eb == blue-600) */}
          <Button className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-full shadow-lg">
            Upgrade
          </Button>

          {/* Layout-only override — KEPT */}
          <Button variant="outline" className="ml-auto">
            Reset
          </Button>

          {/* Conditional className — flagged untouchable, never clustered */}
          <Button className={isPrimary ? "bg-blue-600 text-white" : "bg-gray-200"}>
            Toggle
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
