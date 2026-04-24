
export class FreeHostService {
    async getTemplates(page: number, limit: number) {
        return [];
    }
    async getRegistry() {
        return [];
    }
    async getTemplateById(id: string) {
        return null;
    }
    async addTemplate(template: any) {
        return { success: true };
    }
    async updateTemplate(id: string, updates: any) {
        return { success: true };
    }
    async deleteTemplate(id: string) {
        return { success: true };
    }
}

export const freeHostService = new FreeHostService();
