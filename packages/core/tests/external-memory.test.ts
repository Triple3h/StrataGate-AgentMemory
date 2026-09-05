import { describe, expect, it } from 'vitest';
import {
  parseExternalMemoryExport,
  StrataGate,
  type ExternalMemoryDecider,
  type ExternalMemoryExtractor,
} from '../src/index.js';

describe('external memory export parser', () => {
  it('accepts fenced JSON and preserves uncertain temporal language', () => {
    const parsed = parseExternalMemoryExport('```json\n{"schemaVersion":"stratagate.external-memory.v2","sourceType":"external_ai_memory_export","candidates":[{"memoryKind":"event","category":"project","title":"项目计划","summary":"下个月考虑迁移。","temporal":{"originalText":"下个月","happenedStart":"2026-09-01","precision":"unknown","basis":"unknown"}}]}\n```');
    expect(parsed.candidates[0]).toMatchObject({
      title: '项目计划',
      memoryKind: 'event',
      category: 'project',
      tags: ['project'],
      temporal: { originalText: '下个月', precision: 'unknown', basis: 'unknown' },
    });
    expect(parsed.candidates[0]!.temporal?.happenedStart).toBeUndefined();
  });
});

describe('external AI memory import', () => {
  it('persists per-candidate analysis progress and forces recovered candidates through review', async () => {
    const memory = StrataGate.inMemory({ blockTurnSize: 1 });
    const job = await memory.createExternalMemoryImportJob(JSON.stringify({
      schemaVersion: 'stratagate.external-memory.v2',
      sourceType: 'external_ai_memory_export',
      candidates: [
        { title: '记忆一', summary: '第一条长期记忆。' },
        { title: '记忆二', summary: '第二条长期记忆。' },
      ],
    }));
    expect(job).toMatchObject({ status: 'processing', processedCount: 0, totalCount: 2 });
    const first = await memory.processNextExternalMemoryImport(job.id, async () => ({ action: 'ADD', confidence: 0.95 }));
    expect(first).toMatchObject({ status: 'processing', processedCount: 1, totalCount: 2 });
    const completed = await memory.processNextExternalMemoryImport(job.id, async () => ({ action: 'ADD', confidence: 0.95 }));
    expect(completed).toMatchObject({ status: 'ready', processedCount: 2 });

    const malformed = await memory.createExternalMemoryImportJob('{not valid json');
    expect(malformed).toMatchObject({ status: 'extracting', recoveredFromInvalidJson: false });
    await memory.completeExternalMemoryFallback(malformed.id, {
      candidates: [{ title: '恢复候选', summary: '由不合格输入恢复。' }],
    });
    const recovered = await memory.processNextExternalMemoryImport(
      malformed.id,
      async () => ({ action: 'ADD', confidence: 0.99 }),
    );
    expect(recovered).toMatchObject({
      status: 'awaiting_confirmation',
      recoveredFromInvalidJson: true,
      processedCount: 1,
    });
    expect(recovered.decisions[0]?.requiresConfirmation).toBe(true);
  });

  it('records actor audit entries for import lifecycle operations', async () => {
    let sequence = 0;
    const memory = StrataGate.inMemory({
      idFactory: (prefix) => `${prefix}_${++sequence}`,
      identity: { userId: 'alice', agentId: 'codex', projectId: 'p1', sourceAdapter: 'codex' },
    });
    const job = await memory.createExternalMemoryImportJob(JSON.stringify({
      schemaVersion: 'stratagate.external-memory.v2', sourceType: 'external_ai_memory_export',
      candidates: [{ title: '偏好', summary: '使用 pnpm。' }],
    }));
    const analyzed = await memory.processNextExternalMemoryImport(job.id, async () => ({ action: 'ADD', confidence: 0.9 }));
    const committed = await memory.commitExternalMemoryImport({
      text: job.text, importedAt: job.importedAt, baseRevision: memory.storageRevision,
      candidates: analyzed.candidates, decisions: analyzed.decisions,
    });
    await memory.completeExternalMemoryImportJob(job.id, committed);
    const undone = await memory.undoExternalMemoryImport(committed.sourceBlockId);
    expect(undone.sourceBlockId).toBe(committed.sourceBlockId);
    const final = await memory.markExternalMemoryImportUndone(job.id);
    expect(final.audit?.map(({ action }) => action)).toEqual([
      'external_import_created', 'external_import_committed', 'external_import_undone',
    ]);
    expect(final.audit?.every(({ userId, agentId, sourceAdapter }) => userId === 'alice' && agentId === 'codex' && sourceAdapter === 'codex')).toBe(true);
  });

  it('previews without writes, skips exact duplicates deterministically, and can undo a committed batch', async () => {
    let sequence = 0;
    let deciderCalls = 0;
    const memory = StrataGate.inMemory({ blockTurnSize: 1, idFactory: (prefix) => `${prefix}_${++sequence}` });
    await memory.appendTurn({ user: '数据库使用 SQLite。', assistant: '已记录。' });
    const source = memory.listBlocks()[0]!;
    const old = await memory.addEvent({
      title: '数据库选择', summary: '数据库使用 SQLite。', sourceBlockId: source.id,
      sourceMessageIds: [source.l5Raw[0]!.id], temporal: { eventType: 'decision' },
    });
    const before = memory.exportSnapshot();
    const preview = await memory.previewExternalMemoryImport({
      text: 'preview',
      extractor: async () => ({ candidates: [
        { title: '数据库选择', summary: '数据库使用 SQLite。' },
        { title: '数据库迁移', summary: '数据库已迁移到 PostgreSQL。' },
      ] }),
      decider: async ({ matches }) => {
        deciderCalls += 1;
        return { action: 'SUPERSEDE', existingEventIds: [matches[0]!.event.id], confidence: 0.92, reason: '明确的新状态' };
      },
    });

    expect(memory.exportSnapshot()).toEqual(before);
    expect(deciderCalls).toBe(1);
    expect(preview.decisions.map(({ action }) => action)).toEqual(['IGNORE', 'SUPERSEDE']);
    expect(preview.decisions.map(({ requiresConfirmation }) => requiresConfirmation)).toEqual([false, false]);

    const committed = await memory.commitExternalMemoryImport({
      text: 'preview', importedAt: preview.importedAt, baseRevision: preview.baseRevision,
      candidates: preview.decisions.map(({ candidate }) => candidate), decisions: preview.decisions,
    });
    expect(memory.listEvents().find(({ id }) => id === old.id)?.status).toBe('superseded');
    const undone = await memory.undoExternalMemoryImport(committed.sourceBlockId);
    expect(undone.removedEventIds).toHaveLength(1);
    expect(memory.listEvents().find(({ id }) => id === old.id)).toMatchObject({ status: 'active', supersededBy: null });
    expect(memory.listBlocks().some(({ id }) => id === committed.sourceBlockId)).toBe(false);
  });

  it('extracts candidates, retrieves Top-K, and preserves superseded event history', async () => {
    let sequence = 0;
    const memory = StrataGate.inMemory({
      blockTurnSize: 1,
      idFactory: (prefix) => `${prefix}_${++sequence}`,
    });
    await memory.appendTurn({ user: '数据库使用 SQLite。', assistant: '已记录。' });
    const source = memory.listBlocks()[0]!;
    const old = await memory.addEvent({
      title: '项目数据库选择',
      summary: '项目数据库使用 SQLite。',
      tags: ['database'],
      sourceBlockId: source.id,
      sourceMessageIds: [source.l5Raw[0]!.id],
      temporal: { eventType: 'decision', precision: 'unknown', basis: 'explicit' },
    });

    const extractor: ExternalMemoryExtractor = async () => ({
      candidates: [{
        title: '项目数据库迁移',
        summary: '项目数据库已经从 SQLite 迁移到 PostgreSQL。',
        tags: ['database', 'migration'],
        temporal: {
          eventType: 'migration',
          happenedStart: '2026-08',
          precision: 'month',
          basis: 'explicit',
          originalText: '2026 年 8 月',
        },
      }],
    });
    const decider: ExternalMemoryDecider = async ({ matches }) => ({
      action: 'SUPERSEDE',
      existingEventIds: [matches[0]!.event.id, 'not-in-top-k'],
      reason: '同一项目数据库的新状态',
    });

    const result = await memory.importExternalMemory({
      text: '[2026-08] - 项目数据库已经迁移到 PostgreSQL。',
      extractor,
      decider,
      topK: 3,
      importedAt: '2026-08-26T12:00:00+08:00',
    });

    expect(result.addedEvents).toHaveLength(1);
    expect(result.changedEventIds).toContain(result.addedEvents[0]!.id);
    expect(result.decisions[0]).toMatchObject({
      action: 'SUPERSEDE',
      existingEventIds: [old.id],
      createdEventId: result.addedEvents[0]!.id,
    });
    expect(memory.listEvents().find(({ id }) => id === old.id)).toMatchObject({
      status: 'superseded',
      supersededBy: result.addedEvents[0]!.id,
    });
    expect(result.addedEvents[0]!.temporal).toMatchObject({
      happenedStart: '2026-08',
      precision: 'month',
      supersedesEventIds: [old.id],
    });
    const importBlock = memory.listBlocks().find(({ id }) => id === result.sourceBlockId)!;
    expect(importBlock.l5Raw[0]!.content).toContain('PostgreSQL');
    expect(importBlock.l0Tags).toContain('external-memory-import');
  });

  it('keeps conflict links symmetric and does not write ignored candidates', async () => {
    let sequence = 0;
    const memory = StrataGate.inMemory({
      blockTurnSize: 1,
      idFactory: (prefix) => `${prefix}_${++sequence}`,
    });
    await memory.appendTurn({ user: '用户喜欢简洁回答。', assistant: '知道了。' });
    const block = memory.listBlocks()[0]!;
    const existing = await memory.addEvent({
      title: '回答风格偏好', summary: '用户喜欢简洁回答。', sourceBlockId: block.id,
      sourceMessageIds: [block.l5Raw[0]!.id], temporal: { eventType: 'decision' },
    });
    let index = 0;
    const result = await memory.importExternalMemory({
      text: '用户有时希望获得非常详细的回答。\n闲聊内容。',
      extractor: async () => ({ candidates: [
        { title: '回答风格偏好', summary: '用户希望获得非常详细的回答。' },
        { title: '无长期价值闲聊', summary: '一次普通寒暄。' },
      ] }),
      decider: async ({ matches }) => index++ === 0
        ? { action: 'CONFLICT', existingEventIds: [matches[0]!.event.id] }
        : { action: 'IGNORE', reason: '没有长期价值' },
    });

    expect(result.addedEvents).toHaveLength(1);
    expect(result.decisions.map(({ action }) => action)).toEqual(['CONFLICT', 'IGNORE']);
    expect(memory.listEvents()).toHaveLength(2);
    const imported = result.addedEvents[0]!;
    expect(imported.temporal.conflictsWithEventIds).toEqual([existing.id]);
    expect(existing.temporal.conflictsWithEventIds).toEqual([imported.id]);
  });

  it('uses the built-in JSON extractor when extractor is omitted', async () => {
    const memory = StrataGate.inMemory({ blockTurnSize: 1 });
    const result = await memory.importExternalMemory({
      text: '{"schemaVersion":"stratagate.external-memory.v2","sourceType":"external_ai_memory_export","candidates":[{"memoryKind":"preference","title":"固定偏好","summary":"用户偏好简洁输出。","category":"preference"}]}',
      decider: async () => ({ action: 'ADD' }),
    });
    expect(result.addedEvents[0]!.tags).toContain('preference');
  });
});
