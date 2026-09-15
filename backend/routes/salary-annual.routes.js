const router = require("express").Router();
const Joi = require("joi");
const db = require("../config/db");
const validate = require("../middlewares/validation.middleware");
router.get("/", (_req, res) => {
  db.all(
    "SELECT year, rfr, ir FROM salary_annual ORDER BY year DESC",
    [],
    (error, rows) => {
      if (error)
        return res
          .status(500)
          .json({ error: "Chargement des données annuelles impossible." });
      res.json(rows);
    },
  );
});
router.put(
  "/:year",
  validate(
    Joi.object({
      rfr: Joi.number()
        .min(0)
        .max(100000000)
        .precision(2)
        .strict()
        .allow(null)
        .required(),
      ir: Joi.number()
        .min(-100000000)
        .max(100000000)
        .precision(2)
        .strict()
        .allow(null)
        .required(),
    }),
  ),
  (req, res) => {
    const year = Number(req.params.year);
    if (!Number.isInteger(year) || year < 1900 || year > 2200)
      return res.status(400).json({ error: "Année invalide." });
    db.run(
      "INSERT INTO salary_annual(year,rfr,ir) VALUES (?,?,?) ON CONFLICT(year) DO UPDATE SET rfr=excluded.rfr, ir=excluded.ir",
      [year, req.body.rfr, req.body.ir],
      (error) => {
        if (error)
          return res.status(500).json({ error: "Enregistrement impossible." });
        res.json({ year, ...req.body });
      },
    );
  },
);
module.exports = router;
