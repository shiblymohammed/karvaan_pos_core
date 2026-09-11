const fs = require('fs');

async function testUpload() {
  const formData = new FormData();
  
  // Try to use web FormData if available (Node 18+)
  const file = new File(['test video content'], 'test.mp4', { type: 'video/mp4' });
  formData.append('file', file);

  try {
    const healthRes = await fetch('http://localhost:3001/health');
    console.log('Health:', await healthRes.text());

    const res = await fetch('http://localhost:3001/upload', {
      method: 'POST',
      body: formData,
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testUpload();
