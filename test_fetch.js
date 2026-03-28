import http from 'http';

http.get('http://0.0.0.0:3000/api/templates?page=0&limit=6&category=All&searchQuery=&sortBy=newest', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('Templates count:', json.data ? json.data.length : 0);
      if (json.data && json.data.length > 0) {
        console.log('First template:', JSON.stringify(json.data[0], null, 2));
      } else {
        console.log('No templates returned');
      }
    } catch (e) {
      console.error('Error parsing JSON:', e);
      console.log('Raw response:', data.substring(0, 200));
    }
  });
}).on('error', (err) => {
  console.error('Error fetching:', err.message);
});