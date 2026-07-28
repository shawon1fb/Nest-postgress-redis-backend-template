import { validateSync } from 'class-validator';
import { RequiredInProduction } from './required-in-production.validator';

class Sample {
  @RequiredInProduction('SAMPLE_VAR')
  value: string = 'development-default';
}

describe('RequiredInProduction', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSample = process.env.SAMPLE_VAR;

  afterEach(() => {
    restore('NODE_ENV', originalNodeEnv);
    restore('SAMPLE_VAR', originalSample);
  });

  const restore = (key: string, value: string | undefined) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  };

  const errorsFor = (nodeEnv?: string, sampleVar?: string) => {
    restore('NODE_ENV', nodeEnv);
    restore('SAMPLE_VAR', sampleVar);
    return validateSync(new Sample());
  };

  it('passes outside production even when the variable is unset', () => {
    expect(errorsFor('development', undefined)).toHaveLength(0);
    expect(errorsFor('test', undefined)).toHaveLength(0);
    expect(errorsFor(undefined, undefined)).toHaveLength(0);
  });

  it('fails in production when the variable is unset', () => {
    const errors = errorsFor('production', undefined);

    expect(errors).toHaveLength(1);
    expect(Object.values(errors[0].constraints ?? {})[0]).toContain(
      'SAMPLE_VAR must be set explicitly when NODE_ENV=production',
    );
  });

  it('fails in production when the variable is blank', () => {
    expect(errorsFor('production', '   ')).toHaveLength(1);
  });

  it('passes in production when the variable is set explicitly', () => {
    expect(errorsFor('production', 's3')).toHaveLength(0);
  });

  it('matches NODE_ENV case-insensitively and ignores surrounding space', () => {
    expect(errorsFor(' Production ', undefined)).toHaveLength(1);
  });
});
