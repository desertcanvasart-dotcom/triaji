import { describe, it, expect } from 'vitest';
import { getAdapter, type HisAdapterConfig } from '../src/factory.js';
import { ShifaAdapter } from '../src/adapters/shifa.js';
import { NeuronAdapter } from '../src/adapters/neuron.js';
import { GenericRestAdapter } from '../src/adapters/generic.js';
import { MockHisAdapter } from '../src/adapters/mock.js';

function makeConfig(vendor: HisAdapterConfig['vendor']): HisAdapterConfig {
  return {
    vendor,
    baseUrl: 'http://localhost:4000',
    authType: 'api_key',
    credentials: { apiKey: 'test' },
    tenantId: 'test-tenant',
  };
}

describe('getAdapter factory', () => {
  it('returns ShifaAdapter for shifa vendor', () => {
    const adapter = getAdapter(makeConfig('shifa'));
    expect(adapter).toBeInstanceOf(ShifaAdapter);
    expect(adapter.vendor).toBe('shifa');
  });

  it('returns GenericRestAdapter for generic_rest vendor', () => {
    const adapter = getAdapter(makeConfig('generic_rest'));
    expect(adapter).toBeInstanceOf(GenericRestAdapter);
    expect(adapter.vendor).toBe('generic_rest');
  });

  it('returns MockHisAdapter for mock vendor', () => {
    const adapter = getAdapter(makeConfig('mock'));
    expect(adapter).toBeInstanceOf(MockHisAdapter);
    expect(adapter.vendor).toBe('mock');
  });

  it('returns NeuronAdapter for neuron vendor', () => {
    const adapter = getAdapter(makeConfig('neuron'));
    expect(adapter).toBeInstanceOf(NeuronAdapter);
    expect(adapter.vendor).toBe('neuron');
  });

  it('all adapters implement HisAdapter interface', async () => {
    const mock = getAdapter(makeConfig('mock'));

    // All methods exist
    expect(typeof mock.testConnection).toBe('function');
    expect(typeof mock.fetchDoctors).toBe('function');
    expect(typeof mock.fetchAvailability).toBe('function');
    expect(typeof mock.createBooking).toBe('function');
    expect(typeof mock.cancelBooking).toBe('function');
  });
});
