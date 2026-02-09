import { File, Upload } from "lucide-react"

interface FileUploadStepProps {
  file: File | null
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function FileUploadStep({ onFileChange }: FileUploadStepProps) {
  return (
    <div className="space-y-6 py-6">
      <div 
        className="border-2 border-dashed rounded-md p-12 text-center cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => document.getElementById('file-upload')?.click()}
      >
        <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
        <div className="space-y-2">
          <p className="font-medium">Click to upload or drag and drop</p>
          <p className="text-sm text-muted-foreground">
            CSV or JSON files up to 2MB
          </p>
        </div>
        <input
          id="file-upload"
          type="file"
          accept=".csv,.json"
          className="hidden"
          onChange={onFileChange}
        />
      </div>
      
      <div className="bg-muted/50 rounded-md p-4 text-sm">
        <h4 className="font-medium mb-2">File requirements:</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li>CSV files should have headers matching subscription fields</li>
          <li>Required fields: name, amount, currency, billingCycle, nextBillingDate, status</li>
          <li>JSON files should match the subscription data structure</li>
        </ul>
      </div>
    </div>
  )
}