import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function DashboardPage() {
  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Card cluster: elevated-shadow — hand-rolled shadow-md (== variant="elevated") */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Status
            {/* Badge cluster: status-green pill */}
            <Badge className="bg-green-100 text-green-800">Active</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          {/* Button cluster A: blue-primary (REORDERED again) */}
          <Button className="bg-blue-600 text-white hover:bg-blue-700 rounded-full shadow-lg">
            New report
          </Button>

          {/* Button cluster D: red hand-rolled (== variant="destructive") */}
          <Button className="bg-red-600 hover:bg-red-700 text-white">
            Delete
          </Button>

          {/* Layout-only override — KEPT (spans both columns) */}
          <Button variant="ghost" className="col-span-2 w-full">
            Expand
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
