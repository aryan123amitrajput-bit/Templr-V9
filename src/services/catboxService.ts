export const uploadToCatbox = async (file: File) => {
  const formData = new FormData();
  formData.append('fileToUpload', file);
  formData.append('reqtype', 'fileupload');

  const response = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST',
    body: formData,
  });
  const url = await response.text();
  return { direct_url: url };
};
