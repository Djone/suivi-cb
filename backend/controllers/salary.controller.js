const Salary = require("../models/salary.model");
exports.getAll = async (_req, res) => {
  try {
    res.json(await Salary.getAll());
  } catch {
    res.status(500).json({ error: "Impossible de charger les salaires." });
  }
};
exports.save = async (req, res) => {
  const id = req.params.id ? Number(req.params.id) : null;
  if (id !== null && (!Number.isSafeInteger(id) || id <= 0))
    return res.status(400).json({ error: "Identifiant invalide." });
  try {
    const result = await Salary.save(id, req.body);
    if (id && !result.changes)
      return res.status(404).json({ error: "Feuille de paie introuvable." });
    res.status(id ? 200 : 201).json({ id: id || result.id });
  } catch {
    res.status(500).json({ error: "Impossible de sauvegarder le salaire." });
  }
};
exports.delete = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0)
    return res.status(400).json({ error: "Identifiant invalide." });
  try {
    const result = await Salary.delete(id);
    if (!result.changes)
      return res.status(404).json({ error: "Feuille de paie introuvable." });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: "Impossible de supprimer le salaire." });
  }
};
