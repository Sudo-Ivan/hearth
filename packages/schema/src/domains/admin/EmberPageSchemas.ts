// SPDX-License-Identifier: AGPL-3.0-or-later

import {z} from 'zod';

export const EmberPageAssignmentResponse = z.object({
	enabled: z.boolean(),
});

export type EmberPageAssignmentResponse = z.infer<typeof EmberPageAssignmentResponse>;
