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
        throw new Error("Not implemented");
    }
};
