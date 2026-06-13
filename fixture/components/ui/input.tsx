import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Input is intentionally the "clean" component in the fixture: it is overridden
// only with LAYOUT utilities (w-full), never appearance. DriftFold should report
// Input as having no appearance drift — the empty/clean-wall path. See DRIFT-MAP.md.
const inputVariants = cva(
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      inputSize: {
        default: "h-10",
        sm: "h-9 text-xs",
      },
    },
    defaultVariants: {
      inputSize: "default",
    },
  },
)

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, inputSize, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(inputVariants({ inputSize }), className)}
      {...props}
    />
  ),
)
Input.displayName = "Input"

export { Input, inputVariants }
