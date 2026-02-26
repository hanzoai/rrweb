import { encode } from 'base64-arraybuffer';
import type {
  DataURLOptions,
  ImageBitmapDataURLWorkerParams,
  ImageBitmapDataURLWorkerResponse,
} from '@posthog/rrweb-types';

const lastBlobMap: Map<number, string> = new Map();
const transparentBlobMap: Map<string, string> = new Map();

// Safari memory management: limit cached blob count to prevent unbounded growth
const MAX_CACHED_BLOBS = 100;
const MAX_TRANSPARENT_CACHE = 20;

// Periodic cleanup to help Safari's garbage collector
let cleanupCounter = 0;
const CLEANUP_INTERVAL = 50; // Run cleanup every 50 worker messages

export interface ImageBitmapDataURLRequestWorker {
  postMessage: (
    message: ImageBitmapDataURLWorkerParams,
    transfer?: [ImageBitmap],
  ) => void;
  onmessage: (message: MessageEvent<ImageBitmapDataURLWorkerResponse>) => void;
}

interface ImageBitmapDataURLResponseWorker {
  onmessage:
    | null
    | ((message: MessageEvent<ImageBitmapDataURLWorkerParams>) => void);
  postMessage(e: ImageBitmapDataURLWorkerResponse): void;
}

async function getTransparentBlobFor(
  width: number,
  height: number,
  dataURLOptions: DataURLOptions,
): Promise<string> {
  const id = `${width}-${height}`;
  if ('OffscreenCanvas' in globalThis) {
    if (transparentBlobMap.has(id)) return transparentBlobMap.get(id)!;

    // Limit cache size to prevent memory growth in Safari
    if (transparentBlobMap.size >= MAX_TRANSPARENT_CACHE) {
      const firstKey = transparentBlobMap.keys().next().value;
      transparentBlobMap.delete(firstKey);
    }

    const offscreen = new OffscreenCanvas(width, height);
    offscreen.getContext('2d'); // creates rendering context for `converToBlob`
    let blob: Blob | null = await offscreen.convertToBlob(dataURLOptions); // takes a while
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = encode(arrayBuffer); // cpu intensive

    // Explicitly null out blob reference to help Safari's GC
    blob = null;

    transparentBlobMap.set(id, base64);
    return base64;
  } else {
    return '';
  }
}

// `as any` because: https://github.com/Microsoft/TypeScript/issues/20595
const worker: ImageBitmapDataURLResponseWorker = self;

// eslint-disable-next-line @typescript-eslint/no-misused-promises
worker.onmessage = async function (e) {
  if ('OffscreenCanvas' in globalThis) {
    const { id, bitmap, width, height, dataURLOptions } = e.data;

    // Periodic cleanup to help Safari manage memory
    cleanupCounter++;
    if (
      cleanupCounter >= CLEANUP_INTERVAL ||
      lastBlobMap.size > MAX_CACHED_BLOBS
    ) {
      cleanupCounter = 0;

      // Limit lastBlobMap size to prevent unbounded growth
      if (lastBlobMap.size > MAX_CACHED_BLOBS) {
        const entriesToRemove = lastBlobMap.size - MAX_CACHED_BLOBS;
        const iterator = lastBlobMap.keys();
        for (let i = 0; i < entriesToRemove; i++) {
          const key = iterator.next().value;
          if (key !== undefined) {
            lastBlobMap.delete(key);
          }
        }
      }
    }

    const transparentBase64 = getTransparentBlobFor(
      width,
      height,
      dataURLOptions,
    );

    const offscreen = new OffscreenCanvas(width, height);
    const ctx = offscreen.getContext('2d')!;

    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    let blob: Blob | null = await offscreen.convertToBlob(dataURLOptions); // takes a while
    const type = blob.type;
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = encode(arrayBuffer); // cpu intensive

    // Explicitly null out blob reference to help Safari's GC
    // This is critical for Safari to release the blob from memory
    blob = null;

    // on first try we should check if canvas is transparent,
    // no need to save it's contents in that case
    if (!lastBlobMap.has(id) && (await transparentBase64) === base64) {
      lastBlobMap.set(id, base64);
      return worker.postMessage({ id });
    }

    if (lastBlobMap.get(id) === base64) return worker.postMessage({ id }); // unchanged
    worker.postMessage({
      id,
      type,
      base64,
      width,
      height,
    });
    lastBlobMap.set(id, base64);
  } else {
    return worker.postMessage({ id: e.data.id });
  }
};
