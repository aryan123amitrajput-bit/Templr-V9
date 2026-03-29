async function test() {
    try {
        const { uploadToBeeIMG } = await import('./api/services/beeimgService');
        console.log('Import successful');
    } catch (e) {
        console.error('Import failed:', e);
    }
}
test();
