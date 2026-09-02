// Production Auth modules validate their runtime configuration during import.
// Pure tests use deliberately non-routable placeholders so importing those
// modules can never select a local, staging, or Production database.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://unit-test.invalid/tutela_unit";
process.env.SESSION_SECRET = "unit-test-only-not-a-runtime-secret";
