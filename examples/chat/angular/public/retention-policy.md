# Demo backup retention policy

This fictional policy belongs to the Threadplane demo. Its inventory is isolated to each demo thread and uses a fixed reference date of 2026-09-05. It is not a policy for a real production system.

## Retention windows

Routine backups at least 90 days old are eligible for review. A conservative alternative keeps 120 days. Compare both windows before choosing; age alone never authorizes deletion.

## Holds and approval

Always preserve backups marked `retain: true`. List the inventory for the chosen age window, exclude retained rows, and require explicit human approval before deletion. Keep the returned deletion audit and freed space in the cleanup report.
