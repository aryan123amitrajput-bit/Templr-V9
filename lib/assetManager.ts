
export const assetManager = {
  /**
   * Uploads template JSON to text hosting and returns the URL.
   */
  uploadTemplateJSON: async (data: object): Promise<string> => {
    try {
      const response = await fetch('/api/upload/pastesrs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: JSON.stringify(data, null, 2) })
      });

      if (!response.ok) {
        throw new Error(`Failed to upload JSON: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success || !result.url) {
        throw new Error('Invalid response from text hosting');
      }

      return result.url;
    } catch (error: any) {
      console.error('[AssetManager] Failed to upload template JSON:', error);
      throw new Error(`Failed to upload template JSON: ${error.message}`);
    }
  },

  /**
   * Fetches an external asset (e.g., template JSON).
   */
  getAsset: async (url: string): Promise<any> => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch asset: ${response.statusText}`);
      }
      return await response.json();
    } catch (error: any) {
      console.error('[AssetManager] Failed to fetch asset:', error);
      throw new Error(`Failed to fetch asset: ${error.message}`);
    }
  },

  /**
   * Deletes an asset (if supported by the host).
   */
  deleteAsset: async (url: string): Promise<void> => {
    console.warn('[AssetManager] deleteAsset not fully implemented for all hosts. URL:', url);
    // Implementation depends on the specific host used
  }
};
