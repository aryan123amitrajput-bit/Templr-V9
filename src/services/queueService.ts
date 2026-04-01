export const uploadQueue = {
    setProcessor: (processor: (job: any) => Promise<void>) => {},
    add: async (name: string, data: any) => {}
};
