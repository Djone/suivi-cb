// backend/tests/schemas/subcategory.schema.test.js
const { subCategorySchema, subCategoryUpdateSchema } = require('../../schemas/subcategory.schema');

describe('SubCategory Schemas', () => {
  describe('subCategorySchema (création)', () => {
    it('devrait valider un objet valide', () => {
      const validSubCategory = {
        label: 'Test SubCategory',
        category_id: 1
      };

      const { error } = subCategorySchema.validate(validSubCategory);

      expect(error).toBeUndefined();
    });

    it('devrait rejeter si label est manquant', () => {
      const invalidSubCategory = {
        category_id: 1
      };

      const { error } = subCategorySchema.validate(invalidSubCategory);

      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('label');
    });

    it('devrait rejeter si category_id est manquant', () => {
      const invalidSubCategory = {
        label: 'Test'
      };

      const { error } = subCategorySchema.validate(invalidSubCategory);

      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('category_id');
    });

    it('devrait rejeter si label est trop long (>255 caractères)', () => {
      const invalidSubCategory = {
        label: 'a'.repeat(256),
        category_id: 1
      };

      const { error } = subCategorySchema.validate(invalidSubCategory);

      expect(error).toBeDefined();
    });

    it('devrait rejeter si category_id n\'est pas un entier', () => {
      const invalidSubCategory = {
        label: 'Test',
        category_id: 'not_a_number'
      };

      const { error } = subCategorySchema.validate(invalidSubCategory);

      expect(error).toBeDefined();
    });
  });

  describe('subCategoryUpdateSchema (mise à jour)', () => {
    it('devrait valider avec uniquement label', () => {
      const validUpdate = {
        label: 'Updated Label'
      };

      const { error } = subCategoryUpdateSchema.validate(validUpdate);

      expect(error).toBeUndefined();
    });

    it('devrait valider avec uniquement category_id', () => {
      const validUpdate = {
        category_id: 2
      };

      const { error } = subCategoryUpdateSchema.validate(validUpdate);

      expect(error).toBeUndefined();
    });

    it('devrait valider avec les deux champs', () => {
      const validUpdate = {
        label: 'Updated Label',
        category_id: 2
      };

      const { error } = subCategoryUpdateSchema.validate(validUpdate);

      expect(error).toBeUndefined();
    });

    it('devrait rejeter si aucun champ n\'est fourni', () => {
      const invalidUpdate = {};

      const { error } = subCategoryUpdateSchema.validate(invalidUpdate);

      expect(error).toBeDefined();
    });

    it('devrait rejeter les propriétés inconnues (sécurité)', () => {
      const invalidUpdate = {
        label: 'Test',
        malicious_field: 'DROP TABLE'
      };

      const { error } = subCategoryUpdateSchema.validate(invalidUpdate);

      // Avec la configuration stricte (sans .unknown(true)),
      // les champs inconnus devraient être rejetés
      expect(error).toBeDefined();
    });
  });
});
