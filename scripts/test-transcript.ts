import { YoutubeTranscript } from 'youtube-transcript';

async function testTranscript() {
  const videoId = 'lHpa62eTUTg';
  try {
    console.log(`Testing transcript extraction for video: ${videoId}`);
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    console.log(`Success! Fetched ${transcript.length} transcript segments.`);
    console.log('First segment:', transcript[0]);
    const fullText = transcript.map(t => t.text).join(' ');
    console.log(`Total characters: ${fullText.length}`);
    console.log('Preview:', fullText.substring(0, 200) + '...');
  } catch (error) {
    console.error('Failed to fetch transcript:', error);
  }
}

testTranscript();
