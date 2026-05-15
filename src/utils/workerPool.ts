// Pool de Web Workers para compresión paralela de imágenes.
// Crea N workers (máx 4) y distribuye las tareas en cola — ningún worker
// recibe una segunda tarea hasta terminar la primera.

interface CompressTask {
  resolve: (result: string) => void;
  reject: (err: Error) => void;
  data: { imageBase64: string; quality: number };
}

class WorkerPool {
  private workers: Worker[];
  private freeWorkers: Worker[];
  private queue: CompressTask[];
  private workerTask: Map<Worker, CompressTask>;

  constructor(count: number) {
    this.queue = [];
    this.workerTask = new Map();
    this.workers = Array.from({ length: count }, () => {
      const w = new Worker(
        new URL('../workers/imageCompressor.worker.ts', import.meta.url),
        { type: 'module' }
      );
      w.onmessage = (e: MessageEvent) => this.onMessage(w, e);
      w.onerror = (e: ErrorEvent) => this.onError(w, e);
      return w;
    });
    this.freeWorkers = [...this.workers];
  }

  run(imageBase64: string, quality: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const task: CompressTask = { resolve, reject, data: { imageBase64, quality } };
      const worker = this.freeWorkers.pop();
      if (worker) {
        this.dispatch(worker, task);
      } else {
        this.queue.push(task);
      }
    });
  }

  private dispatch(worker: Worker, task: CompressTask): void {
    this.workerTask.set(worker, task);
    worker.postMessage(task.data);
  }

  private onMessage(worker: Worker, e: MessageEvent<{ result?: string; error?: string }>): void {
    const task = this.workerTask.get(worker);
    if (!task) return;
    this.workerTask.delete(worker);

    if (e.data.error) {
      task.reject(new Error(e.data.error));
    } else {
      task.resolve(e.data.result!);
    }

    this.dispatchNext(worker);
  }

  private onError(worker: Worker, e: ErrorEvent): void {
    const task = this.workerTask.get(worker);
    if (task) {
      this.workerTask.delete(worker);
      task.reject(new Error(e.message));
    }
    this.dispatchNext(worker);
  }

  private dispatchNext(worker: Worker): void {
    const next = this.queue.shift();
    if (next) {
      this.dispatch(worker, next);
    } else {
      this.freeWorkers.push(worker);
    }
  }

  terminate(): void {
    this.workers.forEach(w => w.terminate());
  }
}

let pool: WorkerPool | null = null;

export function getWorkerPool(): WorkerPool {
  if (!pool) {
    const count = Math.min(navigator.hardwareConcurrency ?? 2, 4);
    pool = new WorkerPool(count);
  }
  return pool;
}
