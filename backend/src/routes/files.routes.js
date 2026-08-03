import { Router } from 'express';
import { requireAuth, requirePermission } from '../features/auth.js';
import { now, uid } from '../db/initialData.js';
import { appendTimeline, nextNumericId, notify } from '../features/workflow.js';
import { enrichProject } from '../features/serializers.js';
import { documentStatus, latestDocumentVersion } from '../services/common.js';

export function createFilesRouter(db, upload) {
  const router = Router();

  router.post('/upload/:scope/:id', requireAuth(db), requirePermission('documents:upload'), upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Seleccioná un archivo.' });
    const document = db.transact((data) => {
      const scope = req.params.scope;
      const id = Number(req.params.id);
      const stage = scope === 'stage' ? data.projectStages.find((item) => item.id === id) : null;
      const marketingTask = scope === 'marketing' ? data.marketingTasks.find((item) => item.id === id) : null;
      const projectId = scope === 'project' ? id : stage?.projectId || marketingTask?.projectId;
      if (!projectId) throw new Error('Proyecto o tarea no encontrada.');
      const templateId = req.body.templateId ? Number(req.body.templateId) : null;
      const previous = latestDocumentVersion(data, { projectId, projectStageId: stage?.id || null, marketingTaskId: marketingTask?.id || null, templateId, name: req.file.originalname });
      const row = {
        id: nextNumericId(data, 'documents'),
        name: req.file.originalname,
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: `/uploads/${req.file.filename}`,
        projectId,
        projectStageId: stage?.id || null,
        marketingTaskId: marketingTask?.id || null,
        templateId,
        status: 'Cargado',
        versionNumber: previous ? (previous.versionNumber || 1) + 1 : 1,
        versionGroupId: previous?.versionGroupId || uid('docgrp'),
        uploadedBy: req.user.id,
        reviewedBy: null,
        reviewedAt: null,
        createdAt: now(),
        updatedAt: now()
      };
      data.documents.push(row);
      appendTimeline(data, { type: 'document', title: previous ? 'Nueva versión de entregable' : 'Entregable adjunto', detail: `${row.name} · v${row.versionNumber}`, by: req.user.name, projectId, projectStageId: row.projectStageId });
      const project = data.projects.find((item) => item.id === projectId);
      if (project?.responsibleUserId !== req.user.id) {
        notify(data, { title: 'Nuevo entregable', message: `${row.name} fue adjuntado por ${req.user.name}.`, userId: project?.responsibleUserId || null, roleId: null, projectId, projectStageId: row.projectStageId, marketingTaskId: row.marketingTaskId, type: 'document' });
      }
      return row;
    });
    res.json(document);
  });

  router.put('/documents/:id/status', requireAuth(db), requirePermission('documents:review'), (req, res) => {
    const result = db.transact((data) => {
      const document = data.documents.find((item) => item.id === Number(req.params.id));
      if (!document) throw new Error('Documento no encontrado.');
      document.status = documentStatus(req.body.status);
      document.reviewedBy = req.user.id;
      document.reviewedAt = now();
      document.updatedAt = now();
      appendTimeline(data, { type: 'document', title: `Entregable ${document.status.toLowerCase()}`, detail: `${document.name}${req.body.comment ? ` · ${req.body.comment}` : ''}`, by: req.user.name, projectId: document.projectId, projectStageId: document.projectStageId });
      notify(data, { title: `Entregable ${document.status.toLowerCase()}`, message: document.name, userId: document.uploadedBy, roleId: null, projectId: document.projectId, projectStageId: document.projectStageId, marketingTaskId: document.marketingTaskId, type: 'document-result' });
      const project = data.projects.find((item) => item.id === document.projectId);
      return enrichProject(project, data);
    });
    res.json(result);
  });

  return router;
}
