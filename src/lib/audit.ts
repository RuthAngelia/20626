import { db, type AuditLog, type User } from './db';

export async function logAudit(
  action: AuditLog['action'],
  entity: AuditLog['entity'],
  entityId?: number,
  entityLabel?: string,
  detail?: string,
  user?: User | null
) {
  try {
    await db.auditLogs.add({
      action,
      entity,
      entityId,
      entityLabel,
      detail,
      userId: user?.id,
      userName: user?.name || user?.username || 'System',
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

// Helpers
export const audit = {
  create: (entity: AuditLog['entity'], id: number, label: string, detail?: string, user?: User | null) =>
    logAudit('create', entity, id, label, detail, user),
  update: (entity: AuditLog['entity'], id: number, label: string, detail?: string, user?: User | null) =>
    logAudit('update', entity, id, label, detail, user),
  delete: (entity: AuditLog['entity'], id: number, label: string, detail?: string, user?: User | null) =>
    logAudit('delete', entity, id, label, detail, user),
};
