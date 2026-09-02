import { z } from 'zod';

export default z
  .object({
    trigger: z.enum(['cron', 'nudge']),
    submission_id: z.uuid().optional(),
    result: z
      .object({
        leased: z.number().int().nonnegative(),
        dispatched: z.number().int().nonnegative(),
        recoveryPaused: z.boolean(),
        operatorAlerts: z.array(z.literal('mailbox_recovery_required')),
      })
      .strict()
      .optional(),
  })
  .strict();
