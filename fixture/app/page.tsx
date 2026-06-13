import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function HomePage() {
  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Home</h1>

      {/* Card cluster: accent-border (border-blue-500 shadow-lg) */}
      <Card className="border-blue-500 shadow-lg">
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Pick up where you left off.</p>

          {/* Button cluster A: blue-primary (canonical token order) */}
          <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg">
            Continue
          </Button>

          {/* Button cluster C: green-success */}
          <Button className="bg-green-600 hover:bg-green-700 text-white">
            Save changes
          </Button>

          {/* Layout-only override — must be KEPT, never folded */}
          <Button variant="secondary" className="w-full">
            View all
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
