// Jest must never inherit the running application's database or environment.
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
