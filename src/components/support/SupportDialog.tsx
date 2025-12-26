"use client"

import { useState } from "react"
import { useUser } from "@clerk/nextjs"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import {
  Upload,
  X,
  FileText,
  Image,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  Mail,
  Phone,
  Building,
} from "lucide-react"

const supportFormSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  category: z.enum(["technical", "billing", "feature", "general"]).refine(val => val !== undefined, {
    message: "Please select a category",
  }),
  priority: z.enum(["low", "medium", "high", "critical"]).refine(val => val !== undefined, {
    message: "Please select a priority",
  }),
  userName: z.string().min(2, "Name must be at least 2 characters"),
  userEmail: z.string().email("Please enter a valid email address"),
  userPhone: z.string().optional(),
})

type SupportFormData = z.infer<typeof supportFormSchema>

interface SupportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface Attachment {
  file: File
  preview?: string
}

const categories = [
  { value: "technical", label: "Technical Issue", icon: AlertCircle, color: "destructive" },
  { value: "billing", label: "Billing", icon: FileText, color: "secondary" },
  { value: "feature", label: "Feature Request", icon: CheckCircle, color: "default" },
  { value: "general", label: "General Question", icon: User, color: "outline" },
]

const priorities = [
  { value: "low", label: "Low", color: "outline" },
  { value: "medium", label: "Medium", color: "secondary" },
  { value: "high", label: "High", color: "destructive" },
  { value: "critical", label: "Critical", color: "destructive" },
]

export function SupportDialog({ open, onOpenChange }: SupportDialogProps) {
  const { user } = useUser()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [ticketId, setTicketId] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const form = useForm<SupportFormData>({
    resolver: zodResolver(supportFormSchema),
    defaultValues: {
      userName: user?.fullName || user?.firstName || "",
      userEmail: user?.primaryEmailAddress?.emailAddress || "",
      userPhone: "",
      title: "",
      description: "",
      category: undefined,
      priority: undefined,
    },
  })

  // Auto-collect system information
  const getSystemInfo = () => {
    const userAgent = navigator.userAgent
    const browser = userAgent.match(/(chrome|firefox|safari|edge)\/(\d+)/)?.[0] || "Unknown"
    const os = userAgent.match(/(windows|mac|linux|android|ios)/)?.[0] || "Unknown"
    const appVersion = "1.0.0" // This would come from your app version
    
    return {
      browser,
      os,
      appVersion,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      screenResolution: `${screen.width}x${screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    
    files.forEach((file) => {
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 10MB limit.`,
          variant: "destructive",
        })
        return
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain']
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not a supported file type.`,
          variant: "destructive",
        })
        return
      }

      const attachment: Attachment = { file }

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          setAttachments(prev => 
            prev.map(att => 
              att.file === file ? { ...att, preview: e.target?.result as string } : att
            )
          )
        }
        reader.readAsDataURL(file)
      }

      setAttachments(prev => [...prev, attachment])
    })

    // Reset input
    event.target.value = ""
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const onSubmit = async (data: SupportFormData) => {
    setIsSubmitting(true)

    try {
      // Prepare form data for submission
      const formData = new FormData()
      formData.append("title", data.title)
      formData.append("description", data.description)
      formData.append("category", data.category)
      formData.append("priority", data.priority)
      formData.append("userName", data.userName)
      formData.append("userEmail", data.userEmail)
      formData.append("userPhone", data.userPhone || "")
      formData.append("userId", user?.id || "")
      formData.append("systemInfo", JSON.stringify(getSystemInfo()))

      // Add attachments
      attachments.forEach((attachment, index) => {
        formData.append(`attachment_${index}`, attachment.file)
      })

      const response = await fetch("/api/support/tickets", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Failed to submit support ticket")
      }

      const result = await response.json()
      setTicketId(result.ticketId)
      setIsSubmitted(true)

      toast({
        title: "Support ticket submitted",
        description: `Your ticket has been created with ID: ${result.ticketId}`,
      })

    } catch (error) {
      console.error("Error submitting support ticket:", error)
      toast({
        title: "Submission failed",
        description: "Please try again or contact support directly.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetDialog = () => {
    setIsSubmitted(false)
    setTicketId(null)
    setAttachments([])
    form.reset({
      userName: user?.fullName || user?.firstName || "",
      userEmail: user?.primaryEmailAddress?.emailAddress || "",
      userPhone: "",
      title: "",
      description: "",
      category: undefined,
      priority: undefined,
    })
  }

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false)
      if (isSubmitted) {
        resetDialog()
      }
    }
  }

  if (isSubmitted && ticketId) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <DialogTitle>Ticket Submitted Successfully!</DialogTitle>
                <DialogDescription>
                  Your support ticket has been created and assigned to our team.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Ticket ID:</span>
                  <Badge variant="outline" className="font-mono">
                    {ticketId}
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-gray-600">Status:</span>
                  <Badge>
                    <Clock className="h-3 w-3 mr-1" />
                    Open
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <div className="text-sm text-gray-600 space-y-2">
              <p>
                <strong>What happens next?</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Our support team will review your ticket within 24 hours</li>
                <li>You'll receive email updates on your ticket status</li>
                <li>For urgent issues, call us at +1-800-SUPPORT</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-150 max-h-[90vh] overflow-y-auto bg-gray-900 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create Support Ticket
          </DialogTitle>
          <DialogDescription>
            Describe your issue and we'll get back to you as soon as possible.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="userName">Full Name *</Label>
                  <Input
                    id="userName"
                    {...form.register("userName")}
                    placeholder="Your full name"
                  />
                  {form.formState.errors.userName && (
                    <p className="text-sm text-red-600">
                      {form.formState.errors.userName.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="userEmail">Email Address *</Label>
                  <Input
                    id="userEmail"
                    type="email"
                    {...form.register("userEmail")}
                    placeholder="your.email@example.com"
                  />
                  {form.formState.errors.userEmail && (
                    <p className="text-sm text-red-600">
                      {form.formState.errors.userEmail.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="userPhone">Phone Number (Optional)</Label>
                <Input
                  id="userPhone"
                  {...form.register("userPhone")}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </CardContent>
          </Card>

          {/* Issue Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Issue Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Issue Title *</Label>
                <Input
                  id="title"
                  {...form.register("title")}
                  placeholder="Brief description of your issue"
                />
                {form.formState.errors.title && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.title.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select onValueChange={(value) => form.setValue("category", value as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          <div className="flex items-center gap-2">
                            <category.icon className="h-4 w-4" />
                            {category.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.category && (
                    <p className="text-sm text-red-600">
                      {form.formState.errors.category.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority *</Label>
                  <Select onValueChange={(value) => form.setValue("priority", value as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      {priorities.map((priority) => (
                        <SelectItem key={priority.value} value={priority.value}>
                          <div className="flex items-center gap-2">
                            <Badge variant={priority.color as any}>
                              {priority.label}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.priority && (
                    <p className="text-sm text-red-600">
                      {form.formState.errors.priority.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  {...form.register("description")}
                  placeholder="Please provide a detailed description of your issue, including steps to reproduce if applicable..."
                  rows={4}
                />
                {form.formState.errors.description && (
                  <p className="text-sm text-red-600">
                    {form.formState.errors.description.message}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* File Attachments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Attachments (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    Drag and drop files here, or click to browse
                  </p>
                  <p className="text-xs text-gray-500">
                    Supports: JPG, PNG, GIF, PDF, TXT (Max 10MB each)
                  </p>
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById("file-upload")?.click()}
                  >
                    Choose Files
                  </Button>
                </div>
              </div>

              {attachments.length > 0 && (
                <div className="space-y-2">
                  <Label>Attached Files:</Label>
                  {attachments.map((attachment, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 border rounded-lg"
                    >
                      {attachment.preview ? (
                        <img
                          src={attachment.preview}
                          alt={attachment.file.name}
                          className="h-8 w-8 object-cover rounded"
                        />
                      ) : (
                        <FileText className="h-8 w-8 text-gray-400" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {attachment.file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(attachment.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttachment(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Ticket"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}