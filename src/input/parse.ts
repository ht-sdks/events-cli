import { CliError } from '../lib/errors';
import {
  contractBundleSchema,
  domainSchema,
  type ContractBundle,
  type Domain,
} from './types';

export function parseDomain(data: unknown): Domain {
  const result = domainSchema.safeParse(data);
  if (!result.success) {
    throw new CliError(`Invalid domain: ${result.error.message}`);
  }
  return result.data;
}

export function parseContractBundle(data: unknown): ContractBundle {
  const result = contractBundleSchema.safeParse(data);
  if (!result.success) {
    throw new CliError(`Invalid contract bundle: ${result.error.message}`);
  }
  return result.data;
}
