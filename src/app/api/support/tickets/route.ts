import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { currentUser } from "@clerk/nextjs/server"

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const status = searchParams.get("status")
    const category = searchParams.get("category")

    const skip = (page - 1) * limit

    const where: any = {
      userId: user.id,
    }

    if (status) {
      where.status = status
    }

    if (category) {
      where.category = category
    }

    const [tickets, total] = await Promise.all([
      db.supportTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          ticketId: true,
          title: true,
          category: true,
          priority: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          resolvedAt: true,
        },
      }),
      db.supportTicket.count({ where }),
    ])

    return NextResponse.json({
      tickets,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error fetching support tickets:", error)
    return NextResponse.json(
      { error: "Failed to fetch tickets" },
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

    const formData = await request.formData()
    
    const title = formData.get("title") as string
    const description = formData.get("description") as string
    const category = formData.get("category") as string
    const priority = formData.get("priority") as string
    const userName = formData.get("userName") as string
    const userEmail = formData.get("userEmail") as string
    const userPhone = formData.get("userPhone") as string
    const userId = formData.get("userId") as string
    const systemInfo = formData.get("systemInfo") as string

    if (!title || !description || !category || !priority || !userName || !userEmail) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Generate unique ticket ID
    const ticketId = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`

    // Handle file attachments
    const attachments: string[] = []
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("attachment_") && value instanceof File) {
        // In a real implementation, you would upload to cloud storage
        // For now, we'll just store the filename
        attachments.push(value.name)
      }
    }

    const ticket = await db.supportTicket.create({
      data: {
        ticketId,
        userId: userId || user.id,
        userEmail,
        userName,
        title,
        description,
        category,
        priority,
        status: "open",
        attachments: attachments.length > 0 ? JSON.stringify(attachments) : null,
        systemInfo,
        userPhone: userPhone || null,
      },
    })

    // In a real implementation, you would send email notifications here
    // await sendEmailNotification(ticket)

    return NextResponse.json({
      success: true,
      ticketId: ticket.ticketId,
      message: "Support ticket created successfully",
    })
  } catch (error) {
    console.error("Error creating support ticket:", error)
    return NextResponse.json(
      { error: "Failed to create support ticket" },
      { status: 500 }
    )
  }
}