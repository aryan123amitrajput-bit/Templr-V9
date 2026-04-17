const FormData = require('form-data');

export const uploadToCatbox = async (fileBuffer: Buffer, filename: string, mimetype: string) => {
  const formData = new FormData();
  formData.append('fileToUpload', fileBuffer, { filename, contentType: mimetype });
  formData.append('reqtype', 'fileupload');

  const response = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST',
    body: formData,
    headers: formData.getHeaders(),
  });
  const url = await response.text();
  return { direct_url: url };
};
