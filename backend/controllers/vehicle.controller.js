const humps = require('humps');
const Vehicle = require('../models/vehicle.model');

exports.getAll = async (_req, res) => {
  try {
    res.json(await Vehicle.getAll());
  } catch (error) {
    console.error('Erreur chargement vehicules:', error);
    res.status(500).json({ error: 'Impossible de charger les vehicules.' });
  }
};

exports.create = async (req, res) => {
  try {
    const result = await Vehicle.add(humps.decamelizeKeys(req.body));
    res.status(201).json({ id: result.id });
  } catch (error) {
    console.error('Erreur creation vehicule:', error);
    res.status(500).json({ error: 'Impossible de creer le vehicule.' });
  }
};

exports.update = async (req, res) => {
  try {
    await Vehicle.update(Number(req.params.id), humps.decamelizeKeys(req.body));
    res.json({ id: Number(req.params.id) });
  } catch (error) {
    console.error('Erreur mise a jour vehicule:', error);
    res.status(500).json({ error: 'Impossible de modifier le vehicule.' });
  }
};

exports.getOperations = async (_req, res) => {
  try {
    res.json(await Vehicle.getOperations());
  } catch (error) {
    console.error('Erreur chargement operations vehicule:', error);
    res.status(500).json({ error: 'Impossible de charger les operations.' });
  }
};

exports.createOperation = async (req, res) => {
  try {
    const payload = humps.decamelizeKeys(req.body);
    if (payload.date instanceof Date) {
      payload.date = payload.date.toISOString().slice(0, 10);
    }
    const result = await Vehicle.addOperation(payload);
    res.status(201).json({ id: result.id });
  } catch (error) {
    console.error('Erreur creation operation vehicule:', error);
    res.status(500).json({ error: "Impossible d'ajouter l'operation." });
  }
};

exports.deleteOperation = async (req, res) => {
  try {
    await Vehicle.deleteOperation(Number(req.params.id));
    res.status(204).send();
  } catch (error) {
    console.error('Erreur suppression operation vehicule:', error);
    res.status(500).json({ error: "Impossible de supprimer l'operation." });
  }
};
