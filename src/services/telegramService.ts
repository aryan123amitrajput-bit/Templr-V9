export const telegramService = {
    isConfigured: () => false,
    uploadDocument: async (buffer: Buffer, originalname: string, mimetype?: string): Promise<string> => {
        throw new Error("Not implemented");
    },
    uploadImage: async (buffer: Buffer, originalname: string, mimetype?: string): Promise<string> => {
        throw new Error("Not implemented");
    },
    sendMessage: async (message: string): Promise<void> => {
        throw new Error("Not implemented");
    },
    getFileDownloadUrl: async (fileId: string): Promise<string> => {
        // Return a placeholder image URL since Telegram is not configured
        return "https://picsum.photos/seed/templr/800/600";
    }
};
