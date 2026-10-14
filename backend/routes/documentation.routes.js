const express = require('express');
const Joi = require('joi');
const { DocumentationStore } = require('../services/documentation-store');

const updateSchema = Joi.object({
  id: Joi.string().max(500).required(), revision: Joi.string().pattern(/^[a-f0-9]{64}$/).required(),
  title: Joi.string().allow('').max(300).required(), summary: Joi.string().allow('').max(1000).required(),
  category: Joi.string().max(120).required(), body: Joi.string().allow('').max(60000).required(),
}).unknown(false);
const deleteSchema = Joi.object({ id: Joi.string().max(500).required(), revision: Joi.string().pattern(/^[a-f0-9]{64}$/).required() }).unknown(false);

function createDocumentationRouter(store = new DocumentationStore()) {
  const router = express.Router();
  const handler = (action) => (req, res) => {
    try { action(req, res); }
    catch (error) {
      if (error.code === 'ENOENT') return res.status(404).json({ error: 'Document introuvable.' });
      if (error.status) return res.status(error.status).json({ error: error.message });
      console.error('[DOCUMENTATION] Opération refusée', { code: error.code || 'INTERNAL_ERROR' });
      return res.status(500).json({ error: 'Impossible de modifier la documentation du dépôt.' });
    }
  };
  const owner = (req) => [req.auth?.name, req.auth?.preferred_username]
    .find((value) => typeof value === 'string' && value.trim()) || 'Utilisateur';
  router.get('/', handler((_req, res) => res.set('Cache-Control', 'no-store').json(store.list())));
  router.post('/', handler((req, res) => {
    if (req.body && Object.keys(req.body).length) return res.status(400).json({ error: 'La création ne reçoit aucun chemin de fichier.' });
    return res.status(201).json(store.create(owner(req)));
  }));
  router.put('/', handler((req, res) => {
    const { error, value } = updateSchema.validate(req.body);
    if (error || !value) return res.status(400).json({ error: 'Document ou version invalide.' });
    return res.json(store.publish(value.id, value, owner(req)));
  }));
  router.delete('/', handler((req, res) => {
    const { error, value } = deleteSchema.validate(req.body);
    if (error || !value) return res.status(400).json({ error: 'Document ou version invalide.' });
    store.remove(value.id, value.revision);
    return res.status(204).end();
  }));
  return router;
}

module.exports = { createDocumentationRouter };
