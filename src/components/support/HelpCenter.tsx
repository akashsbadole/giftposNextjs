"use client"

import { useState, useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import {
  Search,
  BookOpen,
  Play,
  Keyboard,
  HelpCircle,
  Star,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  Clock,
  Eye,
  Tag,
  ChevronRight,
  Users,
  Settings,
  ShoppingCart,
  BarChart3,
  Printer,
  CreditCard,
} from "lucide-react"

interface KnowledgeBaseArticle {
  id: string
  title: string
  content: string
  summary?: string
  category: string
  tags: string[]
  isFeatured: boolean
  viewCount: number
  helpful: number
  notHelpful: number
  slug: string
  createdAt: string
}

interface HelpCenterProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const categories = [
  {
    id: "getting-started",
    name: "Getting Started",
    icon: BookOpen,
    color: "bg-blue-100 text-blue-600",
    description: "Learn the basics of using the POS system"
  },
  {
    id: "products",
    name: "Products & Inventory",
    icon: ShoppingCart,
    color: "bg-green-100 text-green-600",
    description: "Manage your product catalog and inventory"
  },
  {
    id: "sales",
    name: "Sales & Transactions",
    icon: BarChart3,
    color: "bg-purple-100 text-purple-600",
    description: "Process sales and"
  },
  {
    id: "payments",
    name: "Payments & Billing",
    icon: CreditCard,
    color: "bg-orange-100 text-orange-600",
    description: "Handle payments and billing operations"
  },
  {
    id: "printers",
    name: "Printers & Receipts",
    icon: Printer,
    color: "bg-red-100 text-red-600",
    description: "Setup and manage receipt printing"
  },
  {
    id: "troubleshooting",
    name: "Troubleshooting",
    icon: Settings,
    color: "bg-yellow-100 text-yellow-600",
    description: "Common issues and their solutions"
  },
  {
    id: "shortcuts",
    name: "Keyboard Shortcuts",
    icon: Keyboard,
    color: "bg-indigo-100 text-indigo-600",
    description: "Speed up your workflow with shortcuts"
  },
  {
    id: "faq",
    name: "FAQ",
    icon: HelpCircle,
    color: "bg-gray-100 text-gray-600",
    description: "Frequently asked questions"
  }
]

const featuredArticles = [
  {
    id: "1",
    title: "Setting Up Your First Store",
    summary: "Complete guide to configuring your store settings and getting started",
    category: "getting-started",
    tags: ["setup", "configuration", "beginner"],
    isFeatured: true,
    viewCount: 1250,
    helpful: 45,
    notHelpful: 2,
    slug: "setting-up-first-store",
    content: "This is a comprehensive guide...",
    createdAt: "2024-01-15"
  },
  {
    id: "2",
    title: "How to Add Products",
    summary: "Step-by-step process for adding products to your inventory",
    category: "products",
    tags: ["products", "inventory", "adding"],
    isFeatured: true,
    viewCount: 890,
    helpful: 32,
    notHelpful: 1,
    slug: "how-to-add-products",
    content: "Adding products is simple...",
    createdAt: "2024-01-10"
  },
  {
    id: "3",
    title: "Processing Your First Sale",
    summary: "Learn how to process a sale from start to finish",
    category: "sales",
    tags: ["sales", "transactions", "beginner"],
    isFeatured: true,
    viewCount: 1100,
    helpful: 38,
    notHelpful: 3,
    slug: "processing-first-sale",
    content: "Processing sales is easy...",
    createdAt: "2024-01-12"
  }
]

const faqData = [
  {
    question: "How do I reset my password?",
    answer: "You can reset your password by clicking on the 'Forgot Password' link on the login page. You'll receive an email with instructions to create a new password.",
    category: "getting-started"
  },
  {
    question: "Can I use multiple printers?",
    answer: "Yes, the system supports multiple printers. You can configure different printers for receipts, reports, and labels in the Settings > Printers section.",
    category: "printers"
  },
  {
    question: "How do I backup my data?",
    answer: "Your data is automatically backed up to the cloud. You can also export your data manually from Settings > Data Management.",
    category: "getting-started"
  },
  {
    question: "What payment methods are supported?",
    answer: "The system supports cash, credit/debit cards, UPI, and various digital payment methods. Check the Payments section for detailed setup instructions.",
    category: "payments"
  },
  {
    question: "How do I manage inventory levels?",
    answer: "Inventory levels are automatically updated when you process sales. You can also manually adjust stock levels in the Products section or use the bulk update feature.",
    category: "products"
  }
]

const keyboardShortcuts = [
  { key: "Ctrl + N", description: "New Sale", category: "sales" },
  { key: "Ctrl + P", description: "Print Receipt", category: "sales" },
  { key: "Ctrl + S", description: "Save", category: "general" },
  { key: "F1", description: "Search Products", category: "products" },
  { key: "F2", description: "Customer Lookup", category: "customers" },
  { key: "F3", description: "Quick Discount", category: "sales" },
  { key: "F4", description: "Payment Methods", category: "payments" },
  { key: "F5", description: "Refresh Data", category: "general" },
  { key: "Escape", description: "Cancel/Clear", category: "general" },
  { key: "Enter", description: "Confirm/Save", category: "general" },
]

export function HelpCenter({ open, onOpenChange }: HelpCenterProps) {
  const { user } = useUser()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeBaseArticle | null>(null)
  const [articles, setArticles] = useState<KnowledgeBaseArticle[]>([])
  const [filteredArticles, setFilteredArticles] = useState<KnowledgeBaseArticle[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Load knowledge base articles
    loadArticles()
  }, [])

  useEffect(() => {
    // Filter articles based on search query and category
    filterArticles()
  }, [searchQuery, selectedCategory, articles])

  const loadArticles = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/support/knowledge-base")
      if (response.ok) {
        const data = await response.json()
        setArticles(data.articles || featuredArticles)
      } else {
        // Fallback to featured articles if API fails
        setArticles(featuredArticles)
      }
    } catch (error) {
      console.error("Error loading articles:", error)
      setArticles(featuredArticles)
    } finally {
      setIsLoading(false)
    }
  }

  const filterArticles = () => {
    let filtered = articles

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(article =>
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter(article => article.category === selectedCategory)
    }

    setFilteredArticles(filtered)
  }

  const handleArticleFeedback = async (articleId: string, isHelpful: boolean) => {
    try {
      await fetch(`/api/support/knowledge-base/${articleId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHelpful })
      })

      // Update local state
      setArticles(prev => prev.map(article => 
        article.id === articleId 
          ? { 
              ...article, 
              helpful: isHelpful ? article.helpful + 1 : article.helpful,
              notHelpful: !isHelpful ? article.notHelpful + 1 : article.notHelpful
            }
          : article
      ))

      toast({
        title: "Thank you for your feedback!",
        description: "Your input helps us improve our documentation."
      })
    } catch (error) {
      console.error("Error submitting feedback:", error)
      toast({
        title: "Feedback failed",
        description: "Please try again later.",
        variant: "destructive"
      })
    }
  }

  const incrementViewCount = async (articleId: string) => {
    try {
      await fetch(`/api/support/knowledge-base/${articleId}/view`, {
        method: "POST"
      })

      // Update local state
      setArticles(prev => prev.map(article => 
        article.id === articleId 
          ? { ...article, viewCount: article.viewCount + 1 }
          : article
      ))
    } catch (error) {
      console.error("Error incrementing view count:", error)
    }
  }

  const openArticle = (article: KnowledgeBaseArticle) => {
    setSelectedArticle(article)
    incrementViewCount(article.id)
  }

  const getCategoryIcon = (categoryId: string) => {
    const category = categories.find(cat => cat.id === categoryId)
    return category ? category.icon : HelpCircle
  }

  const getCategoryColor = (categoryId: string) => {
    const category = categories.find(cat => cat.id === categoryId)
    return category ? category.color : "bg-gray-100 text-gray-600"
  }

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(cat => cat.id === categoryId)
    return category ? category.name : categoryId
  }

  const filteredFAQ = faqData.filter(faq => 
    selectedCategory === "all" || faq.category === selectedCategory
  ).filter(faq =>
    searchQuery.trim() === "" || 
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredShortcuts = keyboardShortcuts.filter(shortcut =>
    selectedCategory === "all" || shortcut.category === selectedCategory
  ).filter(shortcut =>
    searchQuery.trim() === "" || 
    shortcut.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    shortcut.key.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <BookOpen className="h-6 w-6" />
              Help Center
            </DialogTitle>
            <DialogDescription>
              Find answers, learn how to use features, and get the most out of your POS system.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search help articles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Categories */}
              <div className="space-y-2">
                <h3 className="font-medium text-sm text-gray-700 uppercase tracking-wide">
                  Categories
                </h3>
                <div className="space-y-1">
                  <Button
                    variant={selectedCategory === "all" ? "default" : "ghost"}
                    className="w-full justify-start text-sm"
                    onClick={() => setSelectedCategory("all")}
                  >
                    <HelpCircle className="h-4 w-4 mr-2" />
                    All Categories
                  </Button>
                  {categories.map((category) => (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.id ? "default" : "ghost"}
                      className="w-full justify-start text-sm"
                      onClick={() => setSelectedCategory(category.id)}
                    >
                      <category.icon className="h-4 w-4 mr-2" />
                      {category.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Quick Links */}
              <div className="space-y-2">
                <h3 className="font-medium text-sm text-gray-700 uppercase tracking-wide">
                  Quick Links
                </h3>
                <div className="space-y-1">
                  <Button variant="ghost" className="w-full justify-start text-sm">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Video Tutorials
                  </Button>
                  <Button variant="ghost" className="w-full justify-start text-sm">
                    <Users className="h-4 w-4 mr-2" />
                    Community Forum
                  </Button>
                  <Button variant="ghost" className="w-full justify-start text-sm">
                    <Star className="h-4 w-4 mr-2" />
                    Feature Requests
                  </Button>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3">
              <Tabs defaultValue="articles" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="articles">Articles</TabsTrigger>
                  <TabsTrigger value="faq">FAQ</TabsTrigger>
                  <TabsTrigger value="shortcuts">Shortcuts</TabsTrigger>
                </TabsList>

                <TabsContent value="articles" className="space-y-4">
                  {/* Featured Articles */}
                  {selectedCategory === "all" && searchQuery === "" && (
                    <div>
                      <h2 className="text-lg font-semibold mb-4">Featured Articles</h2>
                      <div className="grid gap-4">
                        {articles.filter(article => article.isFeatured).map((article) => (
                          <Card 
                            key={article.id} 
                            className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => openArticle(article)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-lg ${getCategoryColor(article.category)}`}>
                                  {(() => {
                                    const Icon = getCategoryIcon(article.category)
                                    return <Icon className="h-4 w-4" />
                                  })()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-medium truncate">{article.title}</h3>
                                    <Badge variant="secondary" className="text-xs">
                                      {getCategoryName(article.category)}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                    {article.summary}
                                  </p>
                                  <div className="flex items-center gap-4 text-xs text-gray-500">
                                    <span className="flex items-center gap-1">
                                      <Eye className="h-3 w-3" />
                                      {article.viewCount}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <ThumbsUp className="h-3 w-3" />
                                      {article.helpful}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Tag className="h-3 w-3" />
                                      {article.tags.slice(0, 2).join(", ")}
                                    </span>
                                  </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* All Articles */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold">
                        {searchQuery ? `Search Results (${filteredArticles.length})` : "All Articles"}
                      </h2>
                      {isLoading && (
                        <div className="text-sm text-gray-500">Loading...</div>
                      )}
                    </div>

                    {filteredArticles.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No articles found matching your criteria.</p>
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {filteredArticles.map((article) => (
                          <Card 
                            key={article.id} 
                            className="cursor-pointer hover:shadow-sm transition-shadow"
                            onClick={() => openArticle(article)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-medium truncate">{article.title}</h3>
                                    <Badge variant="outline" className="text-xs">
                                      {getCategoryName(article.category)}
                                    </Badge>
                                    {article.isFeatured && (
                                      <Star className="h-3 w-3 text-yellow-500" />
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600 line-clamp-1">
                                    {article.summary}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Eye className="h-3 w-3" />
                                    {article.viewCount}
                                  </span>
                                  <ChevronRight className="h-3 w-3" />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="faq" className="space-y-4">
                  <h2 className="text-lg font-semibold">Frequently Asked Questions</h2>
                  <Accordion type="single" collapsible className="w-full">
                    {filteredFAQ.map((faq, index) => (
                      <AccordionItem key={index} value={`faq-${index}`}>
                        <AccordionTrigger className="text-left">
                          {faq.question}
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="text-gray-600">{faq.answer}</p>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </TabsContent>

                <TabsContent value="shortcuts" className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold mb-4">Keyboard Shortcuts</h2>
                    <div className="grid gap-2">
                      {filteredShortcuts.map((shortcut, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="font-mono text-xs">
                              {shortcut.key}
                            </Badge>
                            <span className="text-sm">{shortcut.description}</span>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {getCategoryName(shortcut.category)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Article Detail Modal */}
      {selectedArticle && (
        <Dialog open={!!selectedArticle} onOpenChange={() => setSelectedArticle(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${getCategoryColor(selectedArticle.category)}`}>
                  {(() => {
                    const Icon = getCategoryIcon(selectedArticle.category)
                    return <Icon className="h-5 w-5" />
                  })()}
                </div>
                <div className="flex-1">
                  <DialogTitle className="text-xl mb-2">
                    {selectedArticle.title}
                  </DialogTitle>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      {selectedArticle.viewCount} views
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Updated {new Date(selectedArticle.createdAt).toLocaleDateString()}
                    </span>
                    <Badge variant="outline">
                      {getCategoryName(selectedArticle.category)}
                    </Badge>
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-6">
              {/* Article Content */}
              <div className="prose prose-sm max-w-none">
                <p className="text-gray-600 mb-4">{selectedArticle.summary}</p>
                <div dangerouslySetInnerHTML={{ __html: selectedArticle.content }} />
              </div>

              {/* Tags */}
              {selectedArticle.tags.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedArticle.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Was this article helpful?</h4>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleArticleFeedback(selectedArticle.id, true)}
                  >
                    <ThumbsUp className="h-4 w-4 mr-2" />
                    Yes ({selectedArticle.helpful})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleArticleFeedback(selectedArticle.id, false)}
                  >
                    <ThumbsDown className="h-4 w-4 mr-2" />
                    No ({selectedArticle.notHelpful})
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}