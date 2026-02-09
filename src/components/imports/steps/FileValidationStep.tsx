import { File } from "lucide-react"
import { Progress } from "@/components/ui/progress"

interface FileValidationStepProps {
  file: File | null
  progress: number
}

export function FileValidationStep({ file, progress }: FileValidationStepProps) {
  return (
    <div className="space-y-6 py-10">
      <div className="flex items-center space-x-4">
        <File className="h-12 w-12 text-muted-foreground" />
        <div className="space-y-1 flex-1">
          <p className="font-medium">{file?.name}</p>
          <p className="text-sm text-muted-foreground">
            {(file?.size && (file.size / 1024).toFixed(1) + " KB") || "Unknown size"}
          </p>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Validating file...</p>
          <p className="text-sm text-muted-foreground">{progress}%</p>
        </div>
        <Progress value={progress} />
      </div>
    </div>
  )
}