const coupleSplitModel = require('../models/couple-split.model');

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function computeParts(line, ratioA) {
  const amount = Math.max(0, line.amount || 0);
  const safeRatioA = clamp(ratioA ?? 0.5, 0, 1);

  switch (line.mode) {
    case 'equal': {
      const half = amount / 2;
      return { partA: half, partB: half };
    }
    case 'prorata': {
      const partA = amount * safeRatioA;
      return { partA, partB: amount - partA };
    }
    case 'fixed': {
      const fixedA = clamp(
        typeof line.fixedRatioA === 'number' ? line.fixedRatioA : 50,
        0,
        100,
      );
      const partA = (amount * fixedA) / 100;
      return { partA, partB: amount - partA };
    }
    case 'single': {
      if (line.payer === 'B') {
        return { partA: 0, partB: amount };
      }
      return { partA: amount, partB: 0 };
    }
    default:
      return { partA: 0, partB: 0 };
  }
}

function computeAll(config) {
  const ratioA = clamp((config.customProrataA ?? 50) / 100, 0, 1);
  const parts = (config.lines || []).map((line) => {
    const res = computeParts(line, ratioA);
    return { id: line.id, label: line.label, partA: res.partA, partB: res.partB };
  });

  const totals = parts.reduce(
    (acc, item) => {
      acc.totalA += item.partA;
      acc.totalB += item.partB;
      return acc;
    },
    { totalA: 0, totalB: 0 },
  );
  return {
    ratioA,
    parts,
    totals: { ...totals, delta: totals.totalA - totals.totalB },
  };
}

exports.getConfig = async (req, res) => {
  try {
    const config = await coupleSplitModel.getConfig();
    const computed = computeAll(config);
    res.status(200).json({ config, totals: computed.totals, parts: computed.parts });
  } catch (err) {
    console.error('Erreur lors de la lecture de la config couple split:', err);
    res.status(500).json({ error: 'Impossible de récupérer la configuration' });
  }
};

exports.updateConfig = async (req, res) => {
  try {
    const saved = await coupleSplitModel.saveConfig(req.body);
    const computed = computeAll(saved);
    res
      .status(200)
      .json({ message: 'Configuration enregistrée', config: saved, totals: computed.totals, parts: computed.parts });
  } catch (err) {
    console.error('Erreur lors de la sauvegarde de la config couple split:', err);
    res.status(500).json({ error: 'Impossible d’enregistrer la configuration' });
  }
};

exports.compute = async (req, res) => {
  try {
    const computed = computeAll(req.body);
    res.status(200).json({ totals: computed.totals, parts: computed.parts });
  } catch (err) {
    console.error('Erreur lors du calcul couple split:', err);
    res.status(500).json({ error: 'Impossible de calculer la répartition' });
  }
};

exports.getRecurringLines = async (req, res) => {
  try {
    const lines = await coupleSplitModel.getRecurringLines();
    res.status(200).json({ lines });
  } catch (err) {
    console.error('Erreur lors de la récupération des charges récurrentes pour couple split:', err);
    res.status(500).json({ error: 'Impossible de récupérer les charges récurrentes' });
  }
};
