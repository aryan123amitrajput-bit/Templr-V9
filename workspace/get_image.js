import https;

https.get('https://imageupload.app/i/122654c4894fa2233eb4', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const lines = data.split('\n');
    lines.forEach(line => {
      if (line.includes('.jpeg') || line.includes('.jpg') || line.includes('.png')) {
        console.log(line);
      }
    });
  });
});
