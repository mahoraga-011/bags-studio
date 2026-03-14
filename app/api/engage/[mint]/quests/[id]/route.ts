import { NextRequest, NextResponse } from 'next/server';
import { getQuestWithProgress } from '@/lib/quests';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mint: string; id: string }> }
) {
  const { id } = await params;
  const wallet = request.nextUrl.searchParams.get('wallet') || undefined;

  try {
    const result = await getQuestWithProgress(id, wallet);
    if (!result) {
      return NextResponse.json({ error: 'Quest not found' }, { status: 404 });
    }

    // Fetch submissions for creator view
    let submissions: unknown[] = [];
    const supabase = getServiceSupabase();
    if (supabase) {
      const { data } = await supabase
        .from('quest_submissions')
        .select('*')
        .eq('quest_id', id)
        .order('created_at', { ascending: false });
      submissions = data || [];
    }

    return NextResponse.json({ ...result, submissions });
  } catch (err) {
    console.error('Quest detail error:', err);
    return NextResponse.json({ error: 'Failed to fetch quest' }, { status: 500 });
  }
}
