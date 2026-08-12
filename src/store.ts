import {
  DEFAULT_BLOCK_TURN_SIZE,
  blockLevelLabel,
  deterministicBlockLayers,
  getDecayedBlockLevel,
  normalizeBlockLevel,
} from './blocks.js';
import { normalizeRetrievalAssessment, type RetrievalAssessment, type RetrievalAssessmentInput } from './retrieval.js';
import {
  STRATAGATE_STORAGE_SCHEMA_VERSION,
  assertValidSnapshot,
  cloneSnapshot,
  type ExtractionJob,
  type StorageAdapter,
  type StrataGateSnapshot,
  type UsageReceipt,
} from './storage.js';
import type {
  AppendTurnResult,
  BlockLevel,
  BlockSummarizer,
  EventCard,
  EventCardInput,
  EventExtractor,
  EventSearchResult,
  MemoryBlock,
  RawMessage,
  RawSearchHit,
  SearchOptions,
  ToolTrace,
} from './types.js';
import { criticalityFloor, memoryWeightAt } from './weights.js';

export interface StrataGateOptions {
  blockTurnSize?: number;
  summarizer?: BlockSummarizer;
  extractor?: EventExtractor;
  now?: () => Date;
  idFactory?: (prefix: 'msg' | 'blk' | 'evt') => string;
}

export interface PersistentStrataGateOptions extends StrataGateOptions {
  storage: StorageAdapter;
  namespace: string;
}

export interface TurnInput {
  user: string;
  assistant: string;
  createdAt?: string;
  userToolCalls?: ToolTrace[];
  assistantToolCalls?: ToolTrace[];
}

export interface BlockContextEntry {
  id: string;
  turnRange: [number, number];
  level: BlockLevel;
  label: string;
  content: string;
}

export interface RecordMemoryUseOptions {
  receiptId?: string;
}

export interface ResumePendingResult {
  sealedBlocks: MemoryBlock[];
  extractedEvents: EventCard[];
}

function defaultIdFactory(prefix: 'msg' | 'blk' | 'evt'): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function defaultSummary(messages: readonly RawMessage[]): {
  l0Title: string;
  l0Tags: string[];
  l1Summary: string;
  l2Keypoints: string[];
  shouldExtract: boolean;
} {
  const natural = messages.filter((message) => message.role === 'user' || message.role === 'assistant');
  const firstUser = natural.find((message) => message.role === 'user');
  return {
    l0Title: (firstUser?.content ?? 'Conversation block').replace(/\s+/g, ' ').trim().slice(0, 80),
    l0Tags: [],
    l1Summary: natural.slice(0, 4).map((message) => message.content.replace(/\s+/g, ' ').trim()).join(' ').slice(0, 500),
    l2Keypoints: natural.slice(0, 8).map((message) => message.content.replace(/\s+/g, ' ').trim().slice(0, 160)),
    shouldExtract: false,
  };
}

function normalizeText(value: string): string {
  return value.toLocaleLowerCase().normalize('NFKC');
}

function queryTokens(value: string): string[] {
  const normalized = normalizeText(value);
  const words = normalized.match(/[\p{L}\p{N}_-]+/gu) ?? [];
  const cjkRuns = normalized.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+/gu) ?? [];
  const bigrams = cjkRuns.flatMap((run) => Array.from({ length: Math.max(0, run.length - 1) }, (_, index) => run.slice(index, index + 2)));
  return [...new Set([...words, ...bigrams].filter((token) => token.length > 1))];
}

function renderBlock(block: MemoryBlock, level: BlockLevel): string {
  if (level === 0) return `${block.l0Title}\nTags: ${block.l0Tags.join(', ') || 'none'}`;
  if (level === 1) return block.l1Summary || block.l0Title;
  if (level === 2) return block.l2Keypoints.map((point) => `- ${point}`).join('\n') || block.l1Summary;
  if (level === 3) return block.l3Condensed;
  if (level === 4) return block.l4Readable;
  return block.l5Raw.map((message) => `${message.role}: ${message.content}`).join('\n\n');
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 1_000);
}

export class StrataGate {
  readonly blockTurnSize: number;

  private readonly summarizer: BlockSummarizer | undefined;
  private readonly extractor: EventExtractor | undefined;
  private readonly now: () => Date;
  private readonly idFactory: (prefix: 'msg' | 'blk' | 'evt') => string;
  private readonly openTail: RawMessage[] = [];
  private readonly blocks: MemoryBlock[] = [];
  private readonly events: EventCard[] = [];
  private readonly extractionJobs = new Map<string, ExtractionJob>();
  private readonly usageReceipts = new Map<string, UsageReceipt>();
  private currentTurn = 0;
  private storage: StorageAdapter | undefined;
  private namespace: string | undefined;
  private revision = 0;
  private mutationQueue: Promise<void> = Promise.resolve();

  constructor(options: StrataGateOptions = {}) {
    this.blockTurnSize = Math.max(1, Math.floor(options.blockTurnSize ?? DEFAULT_BLOCK_TURN_SIZE));
    this.summarizer = options.summarizer;
    this.extractor = options.extractor;
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory ?? defaultIdFactory;
  }

  static async open(options: PersistentStrataGateOptions): Promise<StrataGate> {
    const namespace = options.namespace.trim();
    if (!namespace) throw new TypeError('Storage namespace must not be empty');
    const loaded = await options.storage.load(namespace);
    if (loaded && options.blockTurnSize !== undefined) {
      const requested = Math.max(1, Math.floor(options.blockTurnSize));
      if (requested !== loaded.snapshot.blockTurnSize) {
        throw new Error(`Stored blockTurnSize is ${loaded.snapshot.blockTurnSize}, but ${requested} was requested`);
      }
    }
    const memoryOptions: StrataGateOptions = {};
    if (loaded) memoryOptions.blockTurnSize = loaded.snapshot.blockTurnSize;
    else if (options.blockTurnSize !== undefined) memoryOptions.blockTurnSize = options.blockTurnSize;
    if (options.summarizer) memoryOptions.summarizer = options.summarizer;
    if (options.extractor) memoryOptions.extractor = options.extractor;
    if (options.now) memoryOptions.now = options.now;
    if (options.idFactory) memoryOptions.idFactory = options.idFactory;
    const memory = new StrataGate(memoryOptions);
    memory.storage = options.storage;
    memory.namespace = namespace;
    if (loaded) {
      memory.restoreSnapshot(loaded.snapshot);
      memory.revision = loaded.revision;
      const interrupted = [...memory.extractionJobs.values()].filter((job) => job.status === 'running');
      if (interrupted.length > 0) {
        await memory.commitMutation(() => {
          const now = memory.now().toISOString();
          for (const job of interrupted) {
            memory.extractionJobs.set(job.blockId, {
              ...job,
              status: 'failed',
              lastError: 'Extraction was interrupted before completion.',
              updatedAt: now,
            });
          }
        });
      }
    } else {
      await memory.persist();
    }
    return memory;
  }

  get turn(): number {
    return this.currentTurn;
  }

  get storageRevision(): number {
    return this.revision;
  }

  listBlocks(): readonly MemoryBlock[] {
    return this.blocks;
  }

  listEvents(): readonly EventCard[] {
    return this.events;
  }

  listOpenTail(): readonly RawMessage[] {
    return this.openTail;
  }

  listExtractionJobs(): readonly ExtractionJob[] {
    return [...this.extractionJobs.values()];
  }

  exportSnapshot(): StrataGateSnapshot {
    return cloneSnapshot({
      schemaVersion: STRATAGATE_STORAGE_SCHEMA_VERSION,
      currentTurn: this.currentTurn,
      blockTurnSize: this.blockTurnSize,
      openTail: this.openTail,
      blocks: this.blocks,
      events: this.events,
      extractionJobs: [...this.extractionJobs.values()],
      usageReceipts: [...this.usageReceipts.values()],
    });
  }

  async appendTurn(input: TurnInput): Promise<AppendTurnResult> {
    const createdAt = input.createdAt ?? this.now().toISOString();
    const userMessage: RawMessage = {
      id: this.idFactory('msg'),
      role: 'user',
      content: input.user,
      createdAt,
      ...(input.userToolCalls ? { toolCalls: input.userToolCalls } : {}),
    };
    const assistantMessage: RawMessage = {
      id: this.idFactory('msg'),
      role: 'assistant',
      content: input.assistant,
      createdAt,
      ...(input.assistantToolCalls ? { toolCalls: input.assistantToolCalls } : {}),
    };
    await this.commitMutation(() => {
      this.currentTurn += 1;
      this.openTail.push(userMessage, assistantMessage);
    });

    if (this.openTail.filter((message) => message.role === 'user').length < this.blockTurnSize) {
      return { sealedBlock: null, extractedEvents: [] };
    }

    const sealedBlock = await this.sealOpenTail();
    const extractedEvents = await this.extractEligibleBlock() ?? [];
    return { sealedBlock, extractedEvents };
  }

  async resumePendingWork(): Promise<ResumePendingResult> {
    const sealedBlocks: MemoryBlock[] = [];
    const extractedEvents: EventCard[] = [];
    while (this.openTail.filter((message) => message.role === 'user').length >= this.blockTurnSize) {
      sealedBlocks.push(await this.sealOpenTail());
      extractedEvents.push(...(await this.extractEligibleBlock() ?? []));
    }
    while (true) {
      const extracted = await this.extractEligibleBlock();
      if (extracted === null) break;
      extractedEvents.push(...extracted);
    }
    return { sealedBlocks, extractedEvents };
  }

  async addEvent(input: EventCardInput): Promise<EventCard> {
    return this.commitMutation(() => this.addEventInMemory(input));
  }

  async searchEvents(query: string, options: SearchOptions = {}): Promise<EventSearchResult[]> {
    const tokens = queryTokens(query);
    const participants = (options.participants ?? []).map(normalizeText);
    const eventType = options.eventType ? normalizeText(options.eventType) : null;
    const ranked = this.events
      .filter((event) => event.status === 'active' || event.status === 'superseded')
      .filter((event) => participants.length === 0 || participants.every((person) =>
        (event.temporal.participants ?? []).some((candidate) => normalizeText(candidate).includes(person))))
      .filter((event) => !eventType || normalizeText(event.temporal.eventType ?? '').includes(eventType))
      .map((event) => {
        const temporal = event.temporal;
        const searchable = normalizeText([
          event.title,
          event.summary,
          event.narrative,
          ...event.tags,
          ...event.quotes,
          ...(temporal.participants ?? []),
          temporal.eventType ?? '',
          temporal.happenedStart ?? '',
          temporal.happenedEnd ?? '',
          temporal.originalText ?? '',
        ].join(' '));
        const matched = tokens.filter((token) => searchable.includes(token)).length;
        const lexical = tokens.length === 0 ? 0 : matched / tokens.length;
        const timeBonus = options.temporalIntent && /(\d{4}|when|before|after|first|last|何时|什么时候|之前|之后|最早|最近)/iu.test(query)
          && Boolean(temporal.happenedStart || temporal.happenedEnd) ? 0.2 : 0;
        const statusPenalty = event.status === 'superseded' ? -0.25 : 0;
        return { event, score: lexical * 2 + memoryWeightAt(event, this.currentTurn) + timeBonus + statusPenalty };
      })
      .filter(({ score }) => tokens.length === 0 || score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, Math.min(20, options.limit ?? 6)));

    if (options.temporalIntent) {
      ranked.sort((a, b) => (a.event.temporal.happenedStart ?? '').localeCompare(b.event.temporal.happenedStart ?? ''));
    }
    if (ranked.length > 0) {
      const now = this.now().toISOString();
      await this.commitMutation(() => {
        for (const { event } of ranked) event.weight.lastRetrievedAt = now;
      });
    }
    return ranked;
  }

  searchRawMemory(query: string, limit = 6): RawSearchHit[] {
    const tokens = queryTokens(query);
    if (tokens.length === 0) return [];
    const hits: RawSearchHit[] = [];
    for (const block of this.blocks) {
      for (const [index, message] of block.l5Raw.entries()) {
        const text = normalizeText(message.content);
        if (!tokens.some((token) => text.includes(token))) continue;
        hits.push({
          blockId: block.id,
          turnRange: [block.startTurn, block.endTurn],
          message,
          nearby: block.l5Raw.slice(Math.max(0, index - 1), index + 2),
        });
        if (hits.length >= limit) return hits;
      }
    }
    return hits;
  }

  getBlockContext(): BlockContextEntry[] {
    return this.blocks.map((block) => {
      const level = getDecayedBlockLevel(block.pointerAnchorLevel, block.pointerAnchorTurn, this.currentTurn);
      block.pointerCurrentLevel = level;
      return {
        id: block.id,
        turnRange: [block.startTurn, block.endTurn],
        level,
        label: blockLevelLabel(level),
        content: renderBlock(block, level),
      };
    });
  }

  async expandBlock(id: string, target: unknown = 'next'): Promise<BlockContextEntry> {
    return this.commitMutation(() => {
      const block = this.blocks.find((candidate) => candidate.id === id);
      if (!block) throw new Error(`Unknown block: ${id}`);
      const current = getDecayedBlockLevel(block.pointerAnchorLevel, block.pointerAnchorTurn, this.currentTurn);
      const level = normalizeBlockLevel(target, current);
      block.pointerCurrentLevel = level;
      block.pointerAnchorLevel = level;
      block.pointerAnchorTurn = this.currentTurn;
      block.lastLiftedAt = this.now().toISOString();
      return {
        id: block.id,
        turnRange: [block.startTurn, block.endTurn] as [number, number],
        level,
        label: blockLevelLabel(level),
        content: renderBlock(block, level),
      };
    });
  }

  assessRetrieval(input: RetrievalAssessmentInput, latestEvidenceRefs: ReadonlySet<string>): RetrievalAssessment {
    return normalizeRetrievalAssessment(input, latestEvidenceRefs);
  }

  async recordMemoryUse(eventIds: readonly string[], options: RecordMemoryUseOptions = {}): Promise<void> {
    const receiptId = options.receiptId?.trim();
    if (this.storage && !receiptId) throw new TypeError('Persistent recordMemoryUse requires a non-empty receiptId');
    const requestedIds = [...new Set(eventIds)];
    if (receiptId) {
      const existing = this.usageReceipts.get(receiptId);
      if (existing) {
        if (!sameIds(existing.eventIds, requestedIds)) {
          throw new Error(`Usage receipt ${receiptId} was already recorded with different event IDs`);
        }
        return;
      }
    }

    await this.commitMutation(() => {
      const now = this.now().toISOString();
      for (const id of requestedIds) {
        const event = this.events.find((candidate) => candidate.id === id);
        if (!event || event.status === 'forgotten' || event.status === 'archived') continue;
        event.weight.mentionCount += 1;
        event.weight.lastAdoptedTurn = this.currentTurn;
        event.updatedAt = now;
      }
      if (receiptId) this.usageReceipts.set(receiptId, { id: receiptId, eventIds: requestedIds, createdAt: now });
    });
  }

  async pinEvent(id: string, pinned = true): Promise<void> {
    await this.commitMutation(() => {
      const event = this.requireEvent(id);
      event.weight.pinned = pinned;
      event.updatedAt = this.now().toISOString();
    });
  }

  async forgetEvent(id: string): Promise<void> {
    await this.commitMutation(() => {
      const event = this.requireEvent(id);
      event.status = 'forgotten';
      event.updatedAt = this.now().toISOString();
    });
  }

  async restoreEvent(id: string): Promise<void> {
    await this.commitMutation(() => {
      const event = this.requireEvent(id);
      event.status = 'active';
      event.updatedAt = this.now().toISOString();
    });
  }

  async close(): Promise<void> {
    await this.storage?.close?.();
  }

  private addEventInMemory(input: EventCardInput): EventCard {
    const sourceBlock = this.blocks.find((block) => block.id === input.sourceBlockId);
    if (!sourceBlock) throw new Error(`Unknown source block: ${input.sourceBlockId}`);
    const validIds = new Set(sourceBlock.l5Raw.map((message) => message.id));
    const requestedRefs = [...new Set(input.sourceMessageIds.filter((id) => validIds.has(id)))];
    const sourceMessageIds = requestedRefs.length > 0 ? requestedRefs : sourceBlock.l5Raw.map((message) => message.id);
    const now = this.now().toISOString();
    const criticality = input.criticality ?? 'routine';
    const event: EventCard = {
      id: input.id ?? this.idFactory('evt'),
      title: input.title.trim(),
      summary: input.summary.trim(),
      narrative: input.narrative?.trim() || input.summary.trim(),
      tags: [...new Set(input.tags ?? [])].slice(0, 12),
      quotes: [...new Set(input.quotes ?? [])].slice(0, 12),
      sourceMessageIds,
      sourceBlockId: sourceBlock.id,
      temporal: input.temporal ? { ...input.temporal } : { mentionedAt: now },
      scope: input.scope ?? 'user',
      criticality,
      confidence: Math.max(0, Math.min(1, input.confidence ?? 1)),
      status: 'active',
      supersededBy: null,
      weight: {
        mentionCount: 1,
        lastAdoptedTurn: this.currentTurn,
        lastRetrievedAt: null,
        pinned: false,
        floorWeight: criticalityFloor(criticality),
        forcedCap: null,
      },
      createdAt: now,
      updatedAt: now,
    };
    if (this.events.some((candidate) => candidate.id === event.id)) throw new Error(`Duplicate event ID: ${event.id}`);
    this.events.push(event);

    for (const supersededId of event.temporal.supersedesEventIds ?? []) {
      const old = this.events.find((candidate) => candidate.id === supersededId && candidate.id !== event.id);
      if (!old) continue;
      old.status = 'superseded';
      old.supersededBy = event.id;
      old.weight.forcedCap = 0.1;
      old.updatedAt = now;
    }
    return event;
  }

  private requireEvent(id: string): EventCard {
    const event = this.events.find((candidate) => candidate.id === id);
    if (!event) throw new Error(`Unknown event: ${id}`);
    return event;
  }

  private pendingBlockMessages(): RawMessage[] {
    let users = 0;
    let end = this.openTail.length;
    for (const [index, message] of this.openTail.entries()) {
      if (message.role !== 'user') continue;
      users += 1;
      if (users !== this.blockTurnSize) continue;
      const nextUserOffset = this.openTail.slice(index + 1).findIndex((candidate) => candidate.role === 'user');
      end = nextUserOffset === -1 ? this.openTail.length : index + 1 + nextUserOffset;
      break;
    }
    return this.openTail.slice(0, end);
  }

  private async sealOpenTail(): Promise<MemoryBlock> {
    const raw = this.pendingBlockMessages();
    if (raw.filter((message) => message.role === 'user').length < this.blockTurnSize) {
      throw new Error('Open tail does not contain enough turns to seal a block');
    }
    const generated = this.summarizer ? await this.summarizer(raw) : defaultSummary(raw);
    const deterministic = deterministicBlockLayers(raw);
    const sequence = this.blocks.length + 1;
    const startTurn = this.blocks.at(-1)?.endTurn !== undefined ? (this.blocks.at(-1)?.endTurn ?? 0) + 1 : 1;
    const endTurn = startTurn + this.blockTurnSize - 1;
    return this.commitMutation(() => {
      const currentRaw = this.pendingBlockMessages();
      if (!sameIds(currentRaw.map((message) => message.id), raw.map((message) => message.id))) {
        throw new Error('Open tail changed while the block summary was being prepared');
      }
      const block: MemoryBlock = {
        id: this.idFactory('blk'),
        sequence,
        startTurn,
        endTurn,
        createdAt: raw.at(-1)?.createdAt ?? this.now().toISOString(),
        l0Title: generated.l0Title,
        l0Tags: generated.l0Tags,
        l1Summary: generated.l1Summary,
        l2Keypoints: generated.l2Keypoints,
        shouldExtract: generated.shouldExtract,
        ...deterministic,
        pointerCurrentLevel: 5,
        pointerAnchorLevel: 5,
        pointerAnchorTurn: endTurn,
        lastLiftedAt: null,
      };
      this.openTail.splice(0, raw.length);
      this.blocks.push(block);
      return block;
    });
  }

  private async extractEligibleBlock(): Promise<EventCard[] | null> {
    if (!this.extractor || this.blocks.length < 2) return null;
    const targetIndex = this.blocks.findIndex((block, index) => {
      if (index >= this.blocks.length - 1 || !block.shouldExtract) return false;
      const status = this.extractionJobs.get(block.id)?.status;
      return status === undefined || status === 'failed';
    });
    if (targetIndex < 0) return null;
    const target = this.blocks[targetIndex];
    const next = this.blocks[targetIndex + 1];
    if (!target || !next) return null;
    const existing = this.extractionJobs.get(target.id);
    await this.commitMutation(() => {
      const currentStatus = this.extractionJobs.get(target.id)?.status;
      if (currentStatus !== undefined && currentStatus !== 'failed') {
        throw new Error(`Extraction block ${target.id} is already ${currentStatus}`);
      }
      this.extractionJobs.set(target.id, {
        blockId: target.id,
        status: 'running',
        attempts: (existing?.attempts ?? 0) + 1,
        lastError: null,
        updatedAt: this.now().toISOString(),
      });
    });

    let result: Awaited<ReturnType<EventExtractor>>;
    try {
      result = await this.extractor({
        previous: this.blocks[targetIndex - 1] ?? null,
        target,
        next,
        timeline: this.events.map((event) => ({ id: event.id, title: event.title, temporal: event.temporal })),
      });
    } catch (error) {
      await this.commitMutation(() => {
        const job = this.extractionJobs.get(target.id);
        if (!job) return;
        this.extractionJobs.set(target.id, {
          ...job,
          status: 'failed',
          lastError: errorMessage(error),
          updatedAt: this.now().toISOString(),
        });
      });
      throw error;
    }

    return this.commitMutation(() => {
      const extracted = result.shouldExtract
        ? result.events.map((event) => this.addEventInMemory({ ...event, sourceBlockId: target.id }))
        : [];
      const job = this.extractionJobs.get(target.id);
      if (!job) throw new Error(`Missing extraction job for block: ${target.id}`);
      this.extractionJobs.set(target.id, {
        ...job,
        status: result.shouldExtract ? 'succeeded' : 'skipped',
        lastError: null,
        updatedAt: this.now().toISOString(),
      });
      return extracted;
    });
  }

  private async commitMutation<T>(mutation: () => T | Promise<T>): Promise<T> {
    const previous = this.mutationQueue;
    let release!: () => void;
    this.mutationQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    if (!this.storage) {
      try {
        return await mutation();
      } finally {
        release();
      }
    }

    const before = this.exportSnapshot();
    const beforeRevision = this.revision;
    try {
      const result = await mutation();
      await this.persist();
      return result;
    } catch (error) {
      this.restoreSnapshot(before);
      this.revision = beforeRevision;
      throw error;
    } finally {
      release();
    }
  }

  private async persist(): Promise<void> {
    if (!this.storage || !this.namespace) return;
    this.revision = await this.storage.save(this.namespace, this.exportSnapshot(), this.revision);
  }

  private restoreSnapshot(snapshot: StrataGateSnapshot): void {
    assertValidSnapshot(snapshot);
    if (snapshot.blockTurnSize !== this.blockTurnSize) {
      throw new Error(`Snapshot blockTurnSize ${snapshot.blockTurnSize} does not match ${this.blockTurnSize}`);
    }
    const copy = cloneSnapshot(snapshot);
    this.currentTurn = copy.currentTurn;
    this.openTail.splice(0, this.openTail.length, ...copy.openTail);
    this.blocks.splice(0, this.blocks.length, ...copy.blocks);
    this.events.splice(0, this.events.length, ...copy.events);
    this.extractionJobs.clear();
    for (const job of copy.extractionJobs) this.extractionJobs.set(job.blockId, job);
    this.usageReceipts.clear();
    for (const receipt of copy.usageReceipts) this.usageReceipts.set(receipt.id, receipt);
    this.validateReferences();
  }

  private validateReferences(): void {
    const blockIds = new Set<string>();
    const messageBlockIds = new Map<string, string>();
    for (const block of this.blocks) {
      if (blockIds.has(block.id)) throw new Error(`Duplicate block ID in snapshot: ${block.id}`);
      blockIds.add(block.id);
      for (const message of block.l5Raw) {
        if (messageBlockIds.has(message.id)) throw new Error(`Duplicate message ID in snapshot: ${message.id}`);
        messageBlockIds.set(message.id, block.id);
      }
    }
    for (const message of this.openTail) {
      if (messageBlockIds.has(message.id)) throw new Error(`Duplicate message ID in snapshot: ${message.id}`);
      messageBlockIds.set(message.id, 'open-tail');
    }
    const eventIds = new Set<string>();
    for (const event of this.events) {
      if (eventIds.has(event.id)) throw new Error(`Duplicate event ID in snapshot: ${event.id}`);
      eventIds.add(event.id);
      if (!blockIds.has(event.sourceBlockId)) throw new Error(`Unknown event source block in snapshot: ${event.sourceBlockId}`);
      for (const messageId of event.sourceMessageIds) {
        if (messageBlockIds.get(messageId) !== event.sourceBlockId) {
          throw new Error(`Event ${event.id} references a message outside source block ${event.sourceBlockId}`);
        }
      }
    }
    for (const job of this.extractionJobs.values()) {
      if (!blockIds.has(job.blockId)) throw new Error(`Unknown extraction job block in snapshot: ${job.blockId}`);
    }
  }
}
