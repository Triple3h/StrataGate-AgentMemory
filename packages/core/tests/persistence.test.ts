import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import {
  StorageConflictError,
  StrataGate,
  memoryNamespace,
  type BlockSummarizer,
  type EventExtractor,
} from '../src/index.js';
import { SqliteStorage, type ProcessingJobRow } from '../src/sqlite.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function databasePath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'stratagate-'));
  temporaryDirectories.push(directory);
  return join(directory, 'memory.db');
}

function ids(): (prefix: 'msg' | 'blk' | 'evt') => string {
  let value = 0;
  return (prefix) => `${prefix}_${++value}`;
}

const fixedNow = (): Date => new Date('2026-08-12T00:00:00.000Z');

const summarizer: BlockSummarizer = async (messages) => ({
  l0Title: messages[0]?.content ?? 'block',
  l0Tags: ['persistent'],
  l1Summary: messages.map((message) => message.content).join(' '),
  l2Keypoints: messages.map((message) => message.content),
  shouldExtract: true,
});

const nonExtractingSummarizer: BlockSummarizer = async (messages) => ({
  ...(await summarizer(messages)),
  shouldExtract: false,
});

const extractor: EventExtractor = async ({ target }) => ({
  shouldExtract: true,
  reason: 'durable preference',
  events: [{
    id: `event_for_${target.id}`,
    title: 'Persistent preference',
    summary: target.l5Raw[0]?.content ?? 'preference',
    sourceMessageIds: [target.l5Raw[0]?.id ?? 'missing'],
    sourceBlockId: target.id,
    criticality: 'preference',
  }],
});

describe('SQLite persistence', () => {
  it('restores an unfinished external-memory import job with saved progress', async () => {
    const filename = await databasePath();
    const memory = await StrataGate.open({ database: filename, namespace: 'imports', now: fixedNow });
    const job = await memory.createExternalMemoryImportJob(JSON.stringify({
      schemaVersion: 'stratagate.external-memory.v2',
      sourceType: 'external_ai_memory_export',
      candidates: [
        { title: '候选一', summary: '第一条。' },
        { title: '候选二', summary: '第二条。' },
      ],
    }));
    await memory.processNextExternalMemoryImport(job.id, async () => ({ action: 'ADD', confidence: 0.9 }));
    await memory.close();

    const reopened = await StrataGate.open({ database: filename, namespace: 'imports', now: fixedNow });
    expect(reopened.getExternalMemoryImportJob(job.id)).toMatchObject({
      status: 'processing', processedCount: 1, totalCount: 2,
    });
    await reopened.close();
  });

  it('uses SQLite for the normal open entrypoint and keeps memory mode explicit', async () => {
    const filename = await databasePath();
    const persistent = await StrataGate.open({
      database: filename,
      namespace: 'default:sqlite',
      now: fixedNow,
      idFactory: ids(),
    });
    expect(persistent.storageRevision).toBe(1);
    await persistent.appendTurn({ user: 'stored', assistant: 'durably' });
    expect(persistent.storageRevision).toBe(2);
    await persistent.close();

    const database = new Database(filename, { readonly: true });
    expect(database.prepare('SELECT current_turn FROM memory_spaces WHERE namespace = ?')
      .pluck().get('default:sqlite')).toBe(1);
    database.close();

    const ephemeral = StrataGate.inMemory({ now: fixedNow, idFactory: ids() });
    expect(ephemeral.storageRevision).toBe(0);
    await ephemeral.appendTurn({ user: 'temporary', assistant: 'only' });
    expect(ephemeral.storageRevision).toBe(0);
  });

  it('persists independent identity metadata and raw-turn provenance', async () => {
    const filename = await databasePath();
    const identity = {
      userId: 'alice',
      agentId: 'codex',
      projectId: 'project-123',
      memoryScope: 'project' as const,
      namespacePrefix: 'shared',
      sourceAdapter: 'codex',
    };
    const memory = await StrataGate.open({
      database: filename,
      namespace: 'shared:user:alice:scope:project:project-123',
      identity,
      now: fixedNow,
      idFactory: ids(),
    });
    await memory.appendTurn({
      user: 'identity prompt',
      assistant: 'identity answer',
      threadId: 'conversation-1',
      conversationId: 'conversation-1',
      userId: 'alice',
      agentId: 'codex',
      projectId: 'project-123',
      sourceAdapter: 'codex',
    });
    await memory.close();

    const database = new Database(filename, { readonly: true });
    expect(database.prepare('SELECT user_id, project_id, memory_scope, namespace_prefix FROM memory_spaces').get())
      .toMatchObject({ user_id: 'alice', project_id: 'project-123', memory_scope: 'project', namespace_prefix: 'shared' });
    expect(database.prepare('SELECT user_id, agent_id, project_id, conversation_id, source_adapter FROM messages WHERE role = ?').get('user'))
      .toMatchObject({ user_id: 'alice', agent_id: 'codex', project_id: 'project-123', conversation_id: 'conversation-1', source_adapter: 'codex' });
    database.close();
  });

  it('does not refresh verification time when memory is merely adopted', async () => {
    const filename = await databasePath();
    let now = new Date('2026-08-12T00:00:00.000Z');
    const memory = await StrataGate.open({
      database: filename,
      namespace: 'verification-time',
      blockTurnSize: 1,
      summarizer,
      extractor,
      now: () => now,
      idFactory: ids(),
    });
    const appended = await memory.appendTurn({ user: 'verify this', assistant: 'stored' });
    const event = appended.extractedEvents[0];
    expect(event?.lastVerifiedAt).toBe('2026-08-12T08:00:00.000+08:00');
    now = new Date('2026-08-20T00:00:00.000Z');
    await memory.recordMemoryUse({ eventIds: [event!.id] }, { receiptId: 'usage:verification-time' });
    const adopted = memory.listEvents().find(({ id }) => id === event!.id)!;
    expect(adopted.lastVerifiedAt).toBe('2026-08-12T08:00:00.000+08:00');
    expect(adopted.weight.mentionCount).toBe(2);
    await memory.close();
  });

  it('creates schema version eleven and rejects a newer database schema', async () => {
    const initializedFilename = await databasePath();
    const initialized = new SqliteStorage({ filename: initializedFilename });
    await initialized.close();
    const initializedDatabase = new Database(initializedFilename, { readonly: true });
    expect(initializedDatabase.pragma('user_version', { simple: true })).toBe(11);
    initializedDatabase.close();

    const newerFilename = await databasePath();
    const newerDatabase = new Database(newerFilename);
    newerDatabase.pragma('user_version = 12');
    newerDatabase.close();
    expect(() => new SqliteStorage({ filename: newerFilename })).toThrow('newer than supported');
  });

  it('migrates schema v6 Blocks with an unknown legacy expansion source', async () => {
    const filename = await databasePath();
    const memory = await StrataGate.open({
      database: filename,
      namespace: 'legacy:v6',
      blockTurnSize: 1,
      summarizer: nonExtractingSummarizer,
      now: fixedNow,
      idFactory: ids(),
    });
    await memory.appendTurn({ user: 'legacy prompt', assistant: 'legacy answer' });
    await memory.close();

    const legacy = new Database(filename);
    legacy.exec(`
      ALTER TABLE blocks DROP COLUMN last_lifted_by;
      UPDATE memory_spaces SET schema_version = 6;
      PRAGMA user_version = 6;
    `);
    legacy.close();

    const storage = new SqliteStorage({ filename });
    const loaded = await storage.load('legacy:v6');
    expect(loaded?.snapshot.schemaVersion).toBe(11);
    expect(loaded?.snapshot.blocks[0]?.lastLiftedBy).toBeNull();
    await storage.close();

    const migrated = new Database(filename, { readonly: true });
    expect((migrated.pragma('table_info(blocks)') as Array<{ name: string }>).map(({ name }) => name))
      .toContain('last_lifted_by');
    migrated.close();
  });

  it('migrates schema v8 Blocks as ready and adds durable derivation jobs', async () => {
    const filename = await databasePath();
    const memory = await StrataGate.open({
      database: filename,
      namespace: 'legacy:v8',
      blockTurnSize: 1,
      summarizer: nonExtractingSummarizer,
      now: fixedNow,
      idFactory: ids(),
    });
    await memory.appendTurn({ user: 'legacy ready block', assistant: 'stored' });
    await memory.close();

    const legacy = new Database(filename);
    legacy.exec(`
      DROP TABLE block_summary_jobs;
      ALTER TABLE blocks DROP COLUMN processing_status;
      ALTER TABLE extraction_jobs DROP COLUMN next_retry_at;
      UPDATE memory_spaces SET schema_version = 8;
      PRAGMA user_version = 8;
    `);
    legacy.close();

    const storage = new SqliteStorage({ filename });
    const loaded = await storage.load('legacy:v8');
    expect(loaded?.snapshot).toMatchObject({ schemaVersion: 11, summaryJobs: [], externalMemoryImportJobs: [] });
    expect(loaded?.snapshot.blocks[0]?.processingStatus).toBe('ready');
    expect(loaded?.snapshot.extractionJobs[0]?.nextRetryAt).toBeNull();
    await storage.close();
  });

  it('persists whether a Block was expanded by the user', async () => {
    const filename = await databasePath();
    const memory = await StrataGate.open({
      database: filename,
      namespace: 'expand-source',
      blockTurnSize: 1,
      summarizer: nonExtractingSummarizer,
      now: fixedNow,
      idFactory: ids(),
    });
    const appended = await memory.appendTurn({ user: 'lift this', assistant: 'stored' });
    await memory.expandBlock(appended.sealedBlock!.id, 4, 'user');
    await memory.close();

    const restored = await StrataGate.open({ database: filename, namespace: 'expand-source' });
    expect(restored.listBlocks()[0]?.lastLiftedBy).toBe('user');
    await restored.close();
  });

  it('restores an open tail and seals it at the same boundary after restart', async () => {
    const filename = await databasePath();
    const idFactory = ids();
    const first = await StrataGate.open({
      database: filename,
      namespace: 'user:alice',
      blockTurnSize: 2,
      summarizer,
      idFactory,
      now: fixedNow,
    });
    await first.appendTurn({ user: 'turn one', assistant: 'answer one', threadId: 'session-a' });
    expect(first.listOpenTail('session-a')).toHaveLength(2);
    await first.close();

    const second = await StrataGate.open({
      database: filename,
      namespace: 'user:alice',
      summarizer,
      idFactory,
      now: fixedNow,
    });
    expect(second.turn).toBe(1);
    expect(second.listOpenTail('session-a').map((message) => message.content)).toEqual(['turn one', 'answer one']);
    const result = await second.appendTurn({ user: 'turn two', assistant: 'answer two', threadId: 'session-a' });
    expect(result.sealedBlock?.threadId).toBe('session-a');
    expect(result.sealedBlock?.startTurn).toBe(1);
    expect(result.sealedBlock?.endTurn).toBe(2);
    expect(second.listOpenTail()).toHaveLength(0);
    const expected = second.exportSnapshot();
    await second.close();

    const restored = await StrataGate.open({
      database: filename,
      namespace: 'user:alice',
      summarizer,
      idFactory,
      now: fixedNow,
    });
    expect(restored.exportSnapshot()).toEqual(expected);
    await restored.close();
  });

  it('keeps raw turns durable when summarization fails and resumes without appending again', async () => {
    const filename = await databasePath();
    const failingSummary: BlockSummarizer = async () => {
      throw new Error('summary unavailable');
    };
    const first = await StrataGate.open({
      database: filename,
      namespace: 'session:summary-retry',
      blockTurnSize: 1,
      summarizer: failingSummary,
      now: fixedNow,
      idFactory: ids(),
    });
    await first.appendTurn({ user: 'must survive', assistant: 'stored first' });
    expect(first.turn).toBe(1);
    expect(first.listOpenTail()).toHaveLength(0);
    expect(first.listBlocks()).toHaveLength(1);
    expect(first.listBlocks()[0]).not.toHaveProperty('l0Title');
    expect(first.listSummaryJobs()[0]).toMatchObject({ status: 'failed', attempts: 1, lastError: 'summary unavailable' });
    await first.close();

    const restored = await StrataGate.open({
      database: filename,
      namespace: 'session:summary-retry',
      summarizer: nonExtractingSummarizer,
      now: fixedNow,
      idFactory: ids(),
    });
    const resumed = await restored.resumePendingWork({ retryFailed: true });
    expect(resumed.sealedBlocks).toHaveLength(0);
    expect(resumed.readyBlocks).toHaveLength(1);
    expect(restored.listBlocks()[0]?.l5Raw[0]?.content).toBe('must survive');
    expect(restored.turn).toBe(1);
    await restored.close();
  });

  it('persists failed extraction and retries only that eligible block', async () => {
    const filename = await databasePath();
    let attempts = 0;
    const failingExtractor: EventExtractor = async () => {
      attempts += 1;
      throw new Error('extractor unavailable');
    };
    const idFactory = ids();
    const first = await StrataGate.open({
      database: filename,
      namespace: 'session:extract-retry',
      blockTurnSize: 1,
      summarizer,
      extractor: failingExtractor,
      now: fixedNow,
      idFactory,
    });
    await first.appendTurn({ user: 'remember this', assistant: 'okay' });
    await first.appendTurn({ user: 'later context', assistant: 'noted' });
    expect(attempts).toBe(2);
    expect(first.listBlocks()).toHaveLength(2);
    expect(first.listEvents()).toHaveLength(0);
    expect(first.listExtractionJobs()).toMatchObject([{
      status: 'failed',
      attempts: 1,
      lastError: 'extractor unavailable',
    }, {
      status: 'failed',
      attempts: 1,
      lastError: 'extractor unavailable',
    }]);
    await first.close();

    const restored = await StrataGate.open({
      database: filename,
      namespace: 'session:extract-retry',
      summarizer,
      extractor,
      now: fixedNow,
      idFactory,
    });
    const resumed = await restored.resumePendingWork({ retryFailed: true });
    expect(resumed.extractedEvents).toHaveLength(2);
    expect(restored.listEvents()).toHaveLength(2);
    expect(restored.listExtractionJobs()).toMatchObject([{
      status: 'succeeded',
      attempts: 2,
      lastError: null,
    }, {
      status: 'succeeded',
      attempts: 2,
      lastError: null,
    }]);
    await restored.close();
  });

  it('makes adoption receipts idempotent across retries and restarts', async () => {
    const filename = await databasePath();
    const idFactory = ids();
    const first = await StrataGate.open({
      database: filename,
      namespace: 'user:receipts',
      blockTurnSize: 1,
      summarizer,
      extractor,
      now: fixedNow,
      idFactory,
    });
    await first.appendTurn({ user: 'prefer short answers', assistant: 'okay' });
    await first.appendTurn({ user: 'what is my preference?', assistant: 'checking' });
    const event = first.listEvents()[0];
    expect(event).toBeDefined();
    if (!event) return;
    const audit = {
      sessionId: 'session-42',
      turn: 7,
      batchId: 'batch_1',
      evidenceRefs: [`event:${event.id}`],
      verdict: 'sufficient' as const,
      fit: 'The event directly supports the answer.',
      missing: '',
      nextStrategy: 'answer',
    };
    await first.recordMemoryUse([event.id], { receiptId: 'answer:42', audit });
    await first.recordMemoryUse([event.id], { receiptId: 'answer:42', audit });
    expect(event.weight.mentionCount).toBe(2);
    await first.close();

    const restored = await StrataGate.open({
      database: filename,
      namespace: 'user:receipts',
      summarizer,
      extractor,
      now: fixedNow,
      idFactory,
    });
    const restoredEvent = restored.listEvents()[0];
    expect(restoredEvent?.weight.mentionCount).toBe(2);
    if (restoredEvent) {
      expect(restored.listUsageReceipts()).toContainEqual(expect.objectContaining({
        id: 'answer:42',
        audit,
      }));
      await restored.recordMemoryUse([restoredEvent.id], { receiptId: 'answer:42', audit });
      expect(restoredEvent.weight.mentionCount).toBe(2);
      await expect(restored.recordMemoryUse([], { receiptId: 'answer:42' }))
        .rejects.toThrow('different memory IDs');
    }
    await restored.close();
  });

  it('persists explicitly reconfigured block settings for an existing namespace', async () => {
    const filename = await databasePath();
    const first = await StrataGate.open({
      database: filename,
      namespace: 'project:block-size-change',
      blockTurnSize: 4,
      blockDecayLambda: 0.2,
      now: fixedNow,
      idFactory: ids(),
    });
    await first.appendTurn({ user: 'one', assistant: 'stored' });
    await first.close();

    const changed = await StrataGate.open({
      database: filename,
      namespace: 'project:block-size-change',
      blockTurnSize: 6,
      blockDecayLambda: 0.35,
      now: fixedNow,
      idFactory: ids(),
    });
    expect(changed.blockTurnSize).toBe(6);
    expect(changed.blockDecayLambda).toBe(0.35);
    expect(changed.listOpenTail()).toHaveLength(2);
    await changed.setBlockTurnSize(3);
    await changed.setBlockDecayLambda(0.15);
    expect(changed.blockTurnSize).toBe(3);
    expect(changed.blockDecayLambda).toBe(0.15);
    await changed.close();

    const restored = await StrataGate.open({
      database: filename,
      namespace: 'project:block-size-change',
      now: fixedNow,
      idFactory: ids(),
    });
    expect(restored.blockTurnSize).toBe(3);
    expect(restored.blockDecayLambda).toBe(0.15);
    await restored.close();
  });

  it('rejects a stale writer and rolls back its in-memory mutation', async () => {
    const filename = await databasePath();
    const first = await StrataGate.open({
      database: filename,
      namespace: 'project:shared',
      blockTurnSize: 12,
      now: fixedNow,
      idFactory: ids(),
    });
    const stale = await StrataGate.open({
      database: filename,
      namespace: 'project:shared',
      now: fixedNow,
      idFactory: ids(),
    });

    await first.appendTurn({ user: 'writer one', assistant: 'committed' });
    await expect(stale.appendTurn({ user: 'writer two', assistant: 'stale' }))
      .rejects.toBeInstanceOf(StorageConflictError);
    expect(stale.turn).toBe(0);
    expect(stale.listOpenTail()).toHaveLength(0);
    await first.close();
    await stale.close();
  });

  it('migrates a schema-v1 database in place without losing its namespace', async () => {
    const filename = await databasePath();
    const legacy = new Database(filename);
    legacy.exec(`
      CREATE TABLE memory_spaces (
        namespace TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        revision INTEGER NOT NULL,
        current_turn INTEGER NOT NULL,
        block_turn_size INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE usage_receipts (
        namespace TEXT NOT NULL,
        receipt_id TEXT NOT NULL,
        event_ids_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (namespace, receipt_id),
        FOREIGN KEY (namespace) REFERENCES memory_spaces(namespace) ON DELETE CASCADE
      ) STRICT;
      INSERT INTO memory_spaces VALUES ('legacy:user', 1, 7, 0, 12, '2026-01-01', '2026-01-01');
      PRAGMA user_version = 1;
    `);
    legacy.close();

    const storage = new SqliteStorage({ filename });
    const loaded = await storage.load('legacy:user');
    expect(loaded?.revision).toBe(7);
    expect(loaded?.snapshot).toMatchObject({
      schemaVersion: 11,
      blockDecayLambda: 0.3,
      elements: [],
      elementProjectionJobs: [],
      graphNodes: [],
      graphEdges: [],
      graphProjectionJobs: [],
      ingestionReceipts: [],
    });
    await storage.close();

    const migrated = new Database(filename, { readonly: true });
    expect(migrated.pragma('user_version', { simple: true })).toBe(11);
    expect((migrated.pragma('table_info(usage_receipts)') as Array<{ name: string }>)
      .map(({ name }) => name)).toContain('element_ids_json');
    expect((migrated.pragma('table_info(usage_receipts)') as Array<{ name: string }>)
      .map(({ name }) => name)).toContain('audit_json');
    expect(migrated.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'elements'")
      .pluck().get()).toBe('elements');
    expect(migrated.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'graph_state'")
      .pluck().get()).toBe('graph_state');
    expect(migrated.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ingestion_receipts'")
      .pluck().get()).toBe('ingestion_receipts');
    migrated.close();
  });

  it('adds nullable thread ownership when migrating a schema-v4 database', async () => {
    const filename = await databasePath();
    const legacy = new Database(filename);
    legacy.exec(`
      CREATE TABLE memory_spaces (
        namespace TEXT PRIMARY KEY, schema_version INTEGER NOT NULL, revision INTEGER NOT NULL,
        current_turn INTEGER NOT NULL, block_turn_size INTEGER NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE blocks (
        namespace TEXT NOT NULL, id TEXT NOT NULL, sequence INTEGER NOT NULL,
        start_turn INTEGER NOT NULL, end_turn INTEGER NOT NULL, created_at TEXT NOT NULL,
        should_extract INTEGER NOT NULL, l0_title TEXT NOT NULL, l0_tags_json TEXT NOT NULL,
        l1_summary TEXT NOT NULL, l2_keypoints_json TEXT NOT NULL, l3_condensed TEXT NOT NULL,
        l4_readable TEXT NOT NULL, pointer_current_level INTEGER NOT NULL,
        pointer_anchor_level INTEGER NOT NULL, pointer_anchor_turn INTEGER NOT NULL,
        last_lifted_at TEXT, PRIMARY KEY (namespace, id), UNIQUE (namespace, sequence),
        FOREIGN KEY (namespace) REFERENCES memory_spaces(namespace) ON DELETE CASCADE
      ) STRICT;
      CREATE TABLE messages (
        namespace TEXT NOT NULL, id TEXT NOT NULL, block_id TEXT, position INTEGER NOT NULL,
        role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL, tool_calls_json TEXT,
        PRIMARY KEY (namespace, id),
        FOREIGN KEY (namespace) REFERENCES memory_spaces(namespace) ON DELETE CASCADE,
        FOREIGN KEY (namespace, block_id) REFERENCES blocks(namespace, id) ON DELETE CASCADE
      ) STRICT;
      CREATE TABLE usage_receipts (
        namespace TEXT NOT NULL, receipt_id TEXT NOT NULL, event_ids_json TEXT NOT NULL,
        element_ids_json TEXT NOT NULL DEFAULT '[]', audit_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL, PRIMARY KEY (namespace, receipt_id),
        FOREIGN KEY (namespace) REFERENCES memory_spaces(namespace) ON DELETE CASCADE
      ) STRICT;
      INSERT INTO memory_spaces VALUES ('legacy:v4', 4, 3, 0, 6, '2026-01-01', '2026-01-01');
      PRAGMA user_version = 4;
    `);
    legacy.close();

    const storage = new SqliteStorage({ filename });
    const loaded = await storage.load('legacy:v4');
    expect(loaded?.snapshot.schemaVersion).toBe(11);
    expect(loaded?.snapshot.blockDecayLambda).toBe(0.3);
    await storage.close();

    const migrated = new Database(filename, { readonly: true });
    expect((migrated.pragma('table_info(blocks)') as Array<{ name: string }>).map(({ name }) => name))
      .toContain('thread_id');
    expect((migrated.pragma('table_info(blocks)') as Array<{ name: string }>).map(({ name }) => name))
      .toContain('pointer_anchor_block_position');
    expect((migrated.pragma('table_info(messages)') as Array<{ name: string }>).map(({ name }) => name))
      .toContain('thread_id');
    migrated.close();
  });

  it('converts turn anchors to per-thread block positions when migrating schema v5', async () => {
    const filename = await databasePath();
    const legacy = new Database(filename);
    legacy.exec(`
      CREATE TABLE memory_spaces (
        namespace TEXT PRIMARY KEY, schema_version INTEGER NOT NULL, revision INTEGER NOT NULL,
        current_turn INTEGER NOT NULL, block_turn_size INTEGER NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE blocks (
        namespace TEXT NOT NULL, id TEXT NOT NULL, thread_id TEXT, sequence INTEGER NOT NULL,
        start_turn INTEGER NOT NULL, end_turn INTEGER NOT NULL, created_at TEXT NOT NULL,
        should_extract INTEGER NOT NULL, l0_title TEXT NOT NULL, l0_tags_json TEXT NOT NULL,
        l1_summary TEXT NOT NULL, l2_keypoints_json TEXT NOT NULL, l3_condensed TEXT NOT NULL,
        l4_readable TEXT NOT NULL, pointer_current_level INTEGER NOT NULL,
        pointer_anchor_level INTEGER NOT NULL, pointer_anchor_turn INTEGER NOT NULL,
        last_lifted_at TEXT, PRIMARY KEY (namespace, id), UNIQUE (namespace, sequence),
        FOREIGN KEY (namespace) REFERENCES memory_spaces(namespace) ON DELETE CASCADE
      ) STRICT;
      INSERT INTO memory_spaces VALUES ('legacy:v5', 5, 2, 12, 6, '2026-01-01', '2026-01-01');
      INSERT INTO blocks VALUES
        ('legacy:v5', 'a1', 'thread-a', 1, 1, 6, '2026-01-01', 0,
         'A1', '[]', 'A1', '[]', 'A1', 'A1', 5, 5, 7, NULL),
        ('legacy:v5', 'b1', 'thread-b', 2, 1, 6, '2026-01-01', 0,
         'B1', '[]', 'B1', '[]', 'B1', 'B1', 5, 5, 6, NULL),
        ('legacy:v5', 'a2', 'thread-a', 3, 7, 12, '2026-01-01', 0,
         'A2', '[]', 'A2', '[]', 'A2', 'A2', 5, 5, 12, NULL);
      PRAGMA user_version = 5;
    `);
    legacy.close();

    const storage = new SqliteStorage({ filename });
    const loaded = await storage.load('legacy:v5');
    expect(loaded?.snapshot).toMatchObject({ schemaVersion: 11, blockDecayLambda: 0.3 });
    expect(loaded?.snapshot.blocks.map(({ id, pointerAnchorBlockPosition }) =>
      [id, pointerAnchorBlockPosition])).toEqual([
      ['a1', 1],
      ['b1', 1],
      ['a2', 2],
    ]);
    await storage.close();
  });

  it('persists projected elements and idempotent element-use receipts across restarts', async () => {
    const filename = await databasePath();
    const storage = new SqliteStorage({ filename });
    const elementIdFactory = (() => {
      let value = 0;
      return (prefix: 'elem' | 'fact' | 'proj') => `${prefix}_${++value}`;
    })();
    const first = await StrataGate.openWithStorage({
      storage,
      namespace: 'project:elements',
      blockTurnSize: 1,
      summarizer,
      extractor,
      idFactory: ids(),
      elementIdFactory,
      elementProjector: async ({ events }) => ({
        reason: 'project current state',
        changes: [{
          element: { name: 'StrataGate', type: 'project' },
          operation: 'set_state',
          key: 'storage',
          mode: 'state',
          value: 'SQLite',
          sourceEventIds: [events[0]?.id ?? 'missing'],
        }],
      }),
      now: fixedNow,
    });
    await first.appendTurn({ user: 'Use SQLite.', assistant: 'Recorded.' });
    await first.appendTurn({ user: 'Continue.', assistant: 'Okay.' });
    const element = first.listElements()[0];
    expect(element?.currentState).toContain('SQLite');
    if (!element) return;
    await first.recordMemoryUse({ elementIds: [element.id] }, { receiptId: 'answer:element:1' });
    await first.recordMemoryUse({ elementIds: [element.id] }, { receiptId: 'answer:element:1' });
    expect(element.weight.mentionCount).toBe(2);
    await first.close();

    const restoredStorage = new SqliteStorage({ filename });
    const restored = await StrataGate.openWithStorage({ storage: restoredStorage, namespace: 'project:elements' });
    expect(restored.listElements()[0]).toMatchObject({
      name: 'StrataGate',
      currentState: 'storage: SQLite',
      weight: { mentionCount: 2 },
    });
    expect(restored.listElementProjectionJobs()[0]?.status).toBe('completed');
    await restored.close();
  });

  it('lists processing jobs across namespaces with their project names', async () => {
    const filename = await databasePath();
    const boom = new Error('model unavailable');
    const identityFor = (dir: string, projectName: string) => ({
      userId: 'tester',
      memoryScope: 'project' as const,
      projectDir: `/tmp/${dir}`,
      projectName,
    });
    const namespaceFor = (dir: string): string =>
      memoryNamespace({ userId: 'tester', memoryScope: 'project', projectDir: `/tmp/${dir}` });

    const summarizerFails = await StrataGate.open({
      database: filename,
      namespace: namespaceFor('proj-a'),
      identity: identityFor('proj-a', '项目A'),
      blockTurnSize: 1,
      summarizer: async () => {
        throw boom;
      },
    });
    await summarizerFails.appendTurn({ user: '触发摘要', assistant: '好的' });
    await summarizerFails.close();

    const extractorFails = await StrataGate.open({
      database: filename,
      namespace: namespaceFor('proj-b'),
      identity: identityFor('proj-b', '项目B'),
      blockTurnSize: 1,
      summarizer: async (messages) => ({
        l0Title: 'block', l0Tags: [], l1Summary: messages[0]?.content ?? '', l2Keypoints: [], shouldExtract: true,
      }),
      extractor: async () => {
        throw boom;
      },
    });
    await extractorFails.appendTurn({ user: '触发提取', assistant: '好的' });
    await extractorFails.close();

    const projectorsFail = await StrataGate.open({
      database: filename,
      namespace: namespaceFor('proj-c'),
      identity: identityFor('proj-c', '项目C'),
      blockTurnSize: 1,
      summarizer: async (messages) => ({
        l0Title: 'block', l0Tags: [], l1Summary: messages[0]?.content ?? '', l2Keypoints: [], shouldExtract: true,
      }),
      extractor: async ({ target }) => ({
        shouldExtract: true,
        reason: 'durable event',
        events: [{
          title: '事件', summary: '投影失败事件', sourceMessageIds: [target.l5Raw[0]?.id ?? 'missing'], sourceBlockId: target.id,
        }],
      }),
      // A failing element projector rethrows out of appendTurn, so this path
      // uses a succeeding projector and a failing graph projector instead.
      elementProjector: async ({ events }) => ({
        reason: 'project current state',
        changes: [{
          element: { name: 'StrataGate', type: 'project' },
          operation: 'set_state',
          key: 'storage',
          mode: 'state',
          value: 'SQLite',
          sourceEventIds: [events[0]?.id ?? 'missing'],
        }],
      }),
      graphProjector: async () => {
        throw boom;
      },
    });
    await projectorsFail.appendTurn({ user: '触发投影', assistant: '好的' });
    const projected = projectorsFail.listElements();
    expect(projected.length).toBeGreaterThan(0);
    await projectorsFail.recordMemoryUse({ elementIds: [projected[0]!.id] }, { receiptId: 'answer:test:1' });
    await projectorsFail.close();

    const storage = new SqliteStorage({ filename });
    const jobs = storage.listAllProcessingJobs();
    const receipts = storage.listAllUsageReceipts();
    await storage.close();

    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({ projectName: '项目C', elementIds: [projected[0]!.id] });

    const forProject = (kind: ProcessingJobRow['kind'], projectName: string): ProcessingJobRow => {
      const rows = jobs.filter((job) => job.kind === kind && job.projectName === projectName);
      expect(rows).toHaveLength(1);
      return rows[0]!;
    };
    expect(forProject('summary', '项目A')).toMatchObject({ lastError: 'model unavailable' });
    expect(forProject('summary', '项目A').namespace).toBe(namespaceFor('proj-a'));
    expect(forProject('summary', '项目B')).toMatchObject({ status: 'succeeded', lastError: null });
    expect(forProject('extraction', '项目B')).toMatchObject({ lastError: 'model unavailable' });
    expect(forProject('extraction', '项目C')).toMatchObject({ status: 'succeeded' });
    expect(forProject('elementProjection', '项目C')).toMatchObject({ status: 'completed' });
    expect(forProject('graphProjection', '项目C')).toMatchObject({ status: 'failed', lastError: 'model unavailable' });
  });
});
