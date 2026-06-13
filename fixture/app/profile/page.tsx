import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function ProfilePage() {
  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      {/* Card cluster: elevated-shadow — hand-rolled shadow-md (== variant="elevated") */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Account
            {/* Badge cluster: status-green pill (2nd site) */}
            <Badge className="bg-green-100 text-green-800">Verified</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Input: layout-only override (w-full) — Input stays clean */}
          <Input className="w-full" placeholder="Display name" />

          {/* Button cluster C: green-success (REORDERED — same effective set) */}
          <Button className="bg-green-600 text-white hover:bg-green-700">
            Save profile
          </Button>

          {/* Button OUTLIER: blue-on-blue mistake (bg-blue-600 + text-blue-600 — illegible) */}
          <Button className="bg-blue-600 text-blue-600">
            Sign out
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
