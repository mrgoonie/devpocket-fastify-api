import { z } from 'zod';
import { AuthType, SessionStatus } from '@prisma/client';

// SSH Profile Schemas
export const CreateSshProfileSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  host: z.string().min(1).max(255).trim(),
  port: z.number().min(1).max(65535).default(22),
  username: z.string().min(1).max(100).trim(),
  auth_type: z.nativeEnum(AuthType),
  private_key: z.string().optional(),
  public_key: z.string().optional(),
  passphrase: z.string().optional()
});

export const UpdateSshProfileSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  host: z.string().min(1).max(255).trim().optional(),
  port: z.number().min(1).max(65535).optional(),
  username: z.string().min(1).max(100).trim().optional(),
  auth_type: z.nativeEnum(AuthType).optional(),
  private_key: z.string().optional(),
  public_key: z.string().optional(),
  passphrase: z.string().optional()
});

export const SshProfileParamsSchema = z.object({
  id: z.string().uuid()
});

export const TestSshConnectionSchema = z.object({
  host: z.string().min(1).max(255).trim(),
  port: z.number().min(1).max(65535).default(22),
  username: z.string().min(1).max(100).trim(),
  auth_type: z.nativeEnum(AuthType),
  private_key: z.string().optional(),
  passphrase: z.string().optional(),
  password: z.string().optional()
});

// Terminal Session Schemas
export const CreateTerminalSessionSchema = z.object({
  profile_id: z.string().uuid().optional(),
  session_type: z.enum(['local', 'ssh']).default('local')
});

export const TerminalSessionParamsSchema = z.object({
  id: z.string().uuid()
});

export const GetCommandHistoryQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(1000).default(100),
  offset: z.coerce.number().min(0).default(0)
});

// Response Schemas
export const SshProfileResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  host: z.string(),
  port: z.number(),
  username: z.string(),
  auth_type: z.nativeEnum(AuthType),
  has_ssh_key: z.boolean(),
  created_at: z.date(),
  updated_at: z.date()
});

export const SshProfileListResponseSchema = z.object({
  profiles: z.array(SshProfileResponseSchema),
  total: z.number()
});

export const SshTestResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  connection_time: z.number().optional()
});

export const TerminalSessionResponseSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  status: z.nativeEnum(SessionStatus),
  profile_id: z.string().nullable(),
  created_at: z.date(),
  ended_at: z.date().nullable()
});

export const TerminalSessionListResponseSchema = z.object({
  sessions: z.array(TerminalSessionResponseSchema),
  total: z.number()
});

export const CommandHistoryResponseSchema = z.object({
  id: z.string(),
  command: z.string(),
  output: z.string().nullable(),
  status: z.number(),
  created_at: z.date()
});

export const CommandHistoryListResponseSchema = z.object({
  history: z.array(CommandHistoryResponseSchema),
  total: z.number()
});

// WebSocket Message Schemas (for documentation)
export const WebSocketMessageSchema = z.union([
  z.object({
    type: z.literal('create_pty'),
    cols: z.number().min(1).max(500).default(80),
    rows: z.number().min(1).max(200).default(24),
    shell: z.string().optional(),
    cwd: z.string().optional()
  }),
  z.object({
    type: z.literal('connect_ssh'),
    profile_id: z.string().uuid(),
    cols: z.number().min(1).max(500).default(80),
    rows: z.number().min(1).max(200).default(24)
  }),
  z.object({
    type: z.literal('pty_input'),
    session_id: z.string(),
    data: z.string()
  }),
  z.object({
    type: z.literal('resize_pty'),
    session_id: z.string(),
    cols: z.number().min(1).max(500),
    rows: z.number().min(1).max(200)
  }),
  z.object({
    type: z.literal('kill_session'),
    session_id: z.string()
  }),
  z.object({
    type: z.literal('ping'),
    timestamp: z.number().optional()
  })
]);

// Type exports
export type CreateSshProfileRequest = z.infer<typeof CreateSshProfileSchema>;
export type UpdateSshProfileRequest = z.infer<typeof UpdateSshProfileSchema>;
export type SshProfileParams = z.infer<typeof SshProfileParamsSchema>;
export type TestSshConnectionRequest = z.infer<typeof TestSshConnectionSchema>;
export type CreateTerminalSessionRequest = z.infer<typeof CreateTerminalSessionSchema>;
export type TerminalSessionParams = z.infer<typeof TerminalSessionParamsSchema>;
export type GetCommandHistoryQuery = z.infer<typeof GetCommandHistoryQuerySchema>;
export type SshProfileResponse = z.infer<typeof SshProfileResponseSchema>;
export type SshProfileListResponse = z.infer<typeof SshProfileListResponseSchema>;
export type SshTestResponse = z.infer<typeof SshTestResponseSchema>;
export type TerminalSessionResponse = z.infer<typeof TerminalSessionResponseSchema>;
export type TerminalSessionListResponse = z.infer<typeof TerminalSessionListResponseSchema>;
export type CommandHistoryResponse = z.infer<typeof CommandHistoryResponseSchema>;
export type CommandHistoryListResponse = z.infer<typeof CommandHistoryListResponseSchema>;
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;