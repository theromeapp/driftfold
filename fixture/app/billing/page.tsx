import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function BillingPage() {
  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Billing</h1>

      {/* Card cluster: elevated-shadow — hand-rolled shadow-md (== variant="elevated") */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Invoices
            {/* Badge cluster: muted-gray square (2nd site) */}
            <Badge className="bg-gray-100 text-gray-600 rounded-sm">Draft</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Button cluster A: blue-primary (REORDERED — rounded-full leads) */}
          <Button className="rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg">
            Add payment method
          </Button>

          {/* Button cluster D: red hand-rolled (== variant="destructive") */}
          <Button className="bg-red-600 hover:bg-red-700 text-white">
            Cancel subscription
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
