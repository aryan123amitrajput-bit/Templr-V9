
import fetch from 'node-fetch';

async function testApi() {
  try {
    const response = await fetch('http://localhost:3000/api/templates');
    if (!response.ok) {
      console.error('API error:', response.status, await response.text());
      return;
    }
    const result = await response.json();
    console.log('Total templates:', result.data.length);
    if (result.data.length > 0) {
      console.log('First template:', JSON.stringify(result.data[0], null, 2));
    } else {
      console.log('No templates returned.');
    }
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

testApi();
