const axios = require('axios');
const cheerio = require('cheerio');

async function run() {
  try {
    const res = await axios.get('https://imageupload.app/i/122654c4894fa2233eb4');
    const $ = cheerio.load(res.data);
    const ogImg = $('meta[property="og:image"]').attr('content');
    console.log('og image:', ogImg);
  } catch (e) {
    console.error(e);
  }
}
run();
