import { NextResponse } from 'next/server';
import { seedDatabase } from '@/app/actions';

export async function POST() {
  try {
    console.log('Starting database seeding via API...');
    const result = await seedDatabase();
    console.log('Seed result:', result);
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Seed error:', error.message);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
}