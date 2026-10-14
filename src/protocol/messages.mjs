import { randomUUID } from 'node:crypto';
import { Role } from '@a2a-js/sdk';

export const textPart = (value) => ({
  content: { $case: 'text', value },
  mediaType: 'text/plain',
  filename: '',
});
export const dataPart = (value) => ({
  content: { $case: 'data', value },
  mediaType: 'application/json',
  filename: '',
});
export const textOf = (message) =>
  (message?.parts ?? [])
    .filter((part) => part.content?.$case === 'text')
    .map((part) => part.content.value)
    .join('\n');
export const dataOf = (object) =>
  object?.parts?.find((part) => part.content?.$case === 'data')?.content.value;

export function message(
  text,
  { agent = false, data, taskId = '', contextId = '', referenceTaskIds = [] } = {},
) {
  return {
    messageId: randomUUID(),
    role: agent ? Role.ROLE_AGENT : Role.ROLE_USER,
    parts: [textPart(text), ...(data === undefined ? [] : [dataPart(data)])],
    taskId,
    contextId,
    extensions: [],
    referenceTaskIds,
  };
}

export const stateName = (state) =>
  ({
    1: 'submitted',
    2: 'working',
    3: 'completed',
    4: 'failed',
    5: 'canceled',
    6: 'input-required',
    7: 'rejected',
    8: 'auth-required',
  })[state] ?? 'unknown';
