import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function OnboardingPage() {
  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Onboarding</h1>

      {/* Card: layout-only override (mt-6) — KEPT, no appearance drift */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Get started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Button cluster C: green-success (canonical token order) */}
          <Button className="bg-green-600 hover:bg-green-700 text-white">
            Finish setup
          </Button>

          {/* Button OUTLIER: purple one-off (nothing else looks like this) */}
          <Button className="bg-purple-500 rounded-none shadow-2xl px-12 text-xs">
            Skip for now
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
