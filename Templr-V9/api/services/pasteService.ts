export const uploadToPasteRs = async (content: string): Promise<string> => {
  try {
    const response = await fetch('https://paste.rs/', {
      method: 'POST',
      body: content,
    });
    if (!response.ok) {
      throw new Error(`Paste.rs upload failed: ${response.statusText}`);
    }
    const url = await response.text();
    return url.trim();
  } catch (error) {
    console.error('Paste.rs Error:', error);
    throw error;
  }
};
