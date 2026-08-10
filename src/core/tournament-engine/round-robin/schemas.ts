import { z } from "zod";

export const generateRoundRobinInputSchema = z.object({
  entryIds: z.array(z.string().min(1)).min(2),
});
