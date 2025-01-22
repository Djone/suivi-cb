//Middleware générique pour valider les données

const Joi = require('joi');

/**
 * Middleware de validation générique
 * @param {Joi.Schema} schema - Le schéma Joi à utiliser pour la validation
 * @param {string} property - La propriété à valider (par exemple, body, query, params)
 */
const validate = (schema, property = 'body') => {
    return (req, res, next) => {
        console.log(`Validation en cours pour ${property}:`, req[property]); // Affiche les données entrantes
        const { error, value } = schema.validate(req[property], { abortEarly: false });

        if (error) {
            // Construire un message d'erreur clair
            const errors = error.details.map(detail => detail.message);
            console.error('Erreurs de validation :', errors);
            return res.status(400).json({ errors });
        }

        // Remplacer les données validées dans req[property]
        req[property] = value;
        next(); // Passer au middleware suivant ou au contrôleur
    };
};

module.exports = validate;