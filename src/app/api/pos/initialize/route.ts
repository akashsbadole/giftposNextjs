import { NextResponse } from 'next/server'

// Initialization endpoint has been disabled to prevent data loss
export async function POST() {
  return NextResponse.json(
    { 
      error: 'Database initialization has been disabled to prevent accidental data loss',
      message: 'Please add products manually through the POS interface'
    },
    { status: 403 }
  )
}