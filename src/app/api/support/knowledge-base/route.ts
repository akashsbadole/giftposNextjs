import { NextRequest, NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"

// Static knowledge base data for demonstration
const staticArticles = [
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
    content: "<h2>Setting Up Your First Store</h2><p>This comprehensive guide will walk you through setting up your retail store...</p>",
    createdAt: "2024-01-15",
    updatedAt: "2024-01-15"
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
    content: "<h2>Adding Products to Inventory</h2><p>Adding products is simple and straightforward...</p>",
    createdAt: "2024-01-10",
    updatedAt: "2024-01-10"
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
    content: "<h2>Processing Sales</h2><p>Processing sales is easy with our POS system...</p>",
    createdAt: "2024-01-12",
    updatedAt: "2024-01-12"
  }
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const category = searchParams.get("category")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const featured = searchParams.get("featured") === "true"

    let filteredArticles = staticArticles

    // Filter by search query
    if (search) {
      filteredArticles = filteredArticles.filter(article =>
        article.title.toLowerCase().includes(search.toLowerCase()) ||
        article.summary?.toLowerCase().includes(search.toLowerCase()) ||
        article.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()))
      )
    }

    // Filter by category
    if (category) {
      filteredArticles = filteredArticles.filter(article => article.category === category)
    }

    // Filter featured articles
    if (featured) {
      filteredArticles = filteredArticles.filter(article => article.isFeatured)
    }

    // Pagination
    const skip = (page - 1) * limit
    const paginatedArticles = filteredArticles.slice(skip, skip + limit)

    return NextResponse.json({
      articles: paginatedArticles,
      pagination: {
        page,
        limit,
        total: filteredArticles.length,
        pages: Math.ceil(filteredArticles.length / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching knowledge base articles:", error)
    return NextResponse.json(
      { error: "Failed to fetch articles" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // In a real implementation, you would check if user is admin/support staff
    const body = await request.json()
    const {
      title,
      content,
      summary,
      category,
      tags,
      isFeatured = false,
      isPublished = true,
    } = body

    if (!title || !content || !category) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Generate slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")

    const newArticle = {
      id: Date.now().toString(),
      title,
      content,
      summary,
      category,
      tags: tags || [],
      isFeatured,
      isPublished,
      viewCount: 0,
      helpful: 0,
      notHelpful: 0,
      slug,
      author: user.fullName || user.firstName || "Admin",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // In a real implementation, save to database
    staticArticles.push(newArticle)

    return NextResponse.json({
      success: true,
      article: newArticle,
      message: "Article created successfully",
    })
  } catch (error) {
    console.error("Error creating knowledge base article:", error)
    return NextResponse.json(
      { error: "Failed to create article" },
      { status: 500 }
    )
  }
}