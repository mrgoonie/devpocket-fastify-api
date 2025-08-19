declare module 'light-my-request' {
  import { IncomingHttpHeaders } from 'http';

  interface Response {
    raw: {
      req: import('http').IncomingMessage;
      res: import('http').ServerResponse;
    };
    headers: IncomingHttpHeaders;
    statusCode: number;
    statusMessage: string;
    payload: string;
    rawPayload: Buffer;
    trailers: Record<string, string>;
    body: string;
    json: <T = unknown>() => T;
  }
}
