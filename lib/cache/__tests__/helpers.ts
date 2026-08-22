import { cacheStore, type CacheStore } from "@/lib/cache/store";
import { MemoryStore } from "@/lib/cache/store";

export class MemoryStoreLike extends MemoryStore implements CacheStore {}

export { cacheStore };
