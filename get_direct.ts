import axios from 'axios';
import cheerio from 'cheerio';

async function run() {
  try {
    const res = await axios.get('https://imageupload.app/i/122654c4894fa2233eb4');
    const $ = cheerio.load(res.data);
    const imgUrl = $('img').attr('src');
    const twitterImg = $('meta[name="twitter:image"]').attr('content');
    const ogImg = $('meta[property="og:image"]').attr('content');
    console.log('img src:', imgUrl);
    console.log('twitter image:', twitterImg);
    console.log('og image:', ogImg);
    
    // Also look for actual direct link
    $('input').each((i, el) => {
      console.log('input val:', $(el).val());
    });
  } catch (e) {
    console.error(e);
  }
}
run();
