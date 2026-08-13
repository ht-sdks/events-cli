import { unwrapEnvelope, envelopeKeyForType } from '../src/normalize/envelope';
import { CliError } from '../src/lib/errors';

describe('unwrapEnvelope', () => {
  it('maps event types to envelope keys', () => {
    expect(envelopeKeyForType.track).toBe('properties');
    expect(envelopeKeyForType.page).toBe('properties');
    expect(envelopeKeyForType.screen).toBe('properties');
    expect(envelopeKeyForType.identify).toBe('traits');
    expect(envelopeKeyForType.group).toBe('traits');
  });

  it('unwraps track properties', () => {
    const inner = {
      type: 'object',
      properties: { orderId: { type: 'string' } },
    };
    expect(
      unwrapEnvelope(
        { type: 'object', properties: { properties: inner } },
        'track',
      ),
    ).toEqual(inner);
  });

  it('unwraps identify traits', () => {
    const inner = {
      type: 'object',
      properties: { email: { type: 'string' } },
    };
    expect(
      unwrapEnvelope(
        { type: 'object', properties: { traits: inner } },
        'identify',
      ),
    ).toEqual(inner);
  });

  it('throws when envelope is missing', () => {
    expect(() =>
      unwrapEnvelope({ type: 'object', properties: {} }, 'track'),
    ).toThrow(CliError);
    expect(() =>
      unwrapEnvelope({ type: 'object', properties: {} }, 'track'),
    ).toThrow(/properties/i);
  });
});
