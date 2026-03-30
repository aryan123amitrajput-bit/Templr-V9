type Job = {
    id: string;
    name: string;
    data: any;
};

type Processor = (job: Job) => Promise<void>;

export class SimpleQueue {
    private queue: Job[] = [];
    private processor: Processor | null = null;
    private processing = false;

    constructor(private name: string) {}

    async add(name: string, data: any) {
        const job: Job = { id: Math.random().toString(36).substring(7), name, data };
        this.queue.push(job);
        console.log(`[Queue ${this.name}] Job added: ${job.id}`);
        this.process();
        return job;
    }

    setProcessor(processor: Processor) {
        this.processor = processor;
    }

    private async process() {
        if (this.processing || !this.processor || this.queue.length === 0) return;
        
        this.processing = true;
        while (this.queue.length > 0) {
            const job = this.queue.shift();
            if (job) {
                try {
                    await this.processor!(job);
                } catch (e) {
                    console.error(`[Queue ${this.name}] Job failed: ${job.id}`, e);
                }
            }
        }
        this.processing = false;
    }
}
