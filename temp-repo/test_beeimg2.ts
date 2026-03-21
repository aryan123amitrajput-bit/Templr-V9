import { Blob } from 'buffer';

async function test() {
  const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: 'image/png' }), 'test2.png');
  formData.append('api_key', '098dccd10fb840e72711cdf846b50222');
  
  try {
    const res = await fetch('https://beeimg.com/api/upload/file/json/', {
      method: 'POST',
      body: formData
    });
    console.log(await res.text());
  } catch (e) {
    console.error(e);
  }
}
test();
