CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actor_employee_id" UUID NULL,
  "actor_auth_user_id" UUID NULL,
  "action" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NULL,
  "metadata" JSONB NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_logs_actor_employee_id_fkey"
    FOREIGN KEY ("actor_employee_id")
    REFERENCES "employees"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");
CREATE INDEX "audit_logs_actor_employee_id_created_at_idx" ON "audit_logs"("actor_employee_id", "created_at");

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_prevent_update
BEFORE UPDATE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE TRIGGER audit_logs_prevent_delete
BEFORE DELETE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
