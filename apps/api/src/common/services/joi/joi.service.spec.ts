import Joi from 'joi';
import { JoiService } from './joi.service';
import { ValidationException } from '../../exceptions/validation.exception';
import { ValidationIssue } from '../../models/validation-issue';

interface SampleDto {
  amount: number;
  name: string;
}

describe('validateAsync', () => {
  let service: JoiService;

  beforeEach(() => {
    service = new JoiService();
  });

  it('returns the coerced value on valid input (convert: true)', async () => {
    const schema = Joi.object<SampleDto>({
      amount: Joi.number().required(),
      name: Joi.string().required(),
    });

    // `amount` arrives as a string (as from a query string) and must be coerced to a number.
    const result = await service.validateAsync(
      { amount: '42' as unknown as number, name: 'squat' },
      schema,
    );

    expect(result).toEqual({ amount: 42, name: 'squat' });
    expect(typeof result.amount).toBe('number');
  });

  it('throws ValidationException with mapped issues on a Joi error', async () => {
    const schema = Joi.object<SampleDto>({
      amount: Joi.number().required(),
      name: Joi.string().required(),
    });

    await expect(
      service.validateAsync({ amount: 1 } as SampleDto, schema),
    ).rejects.toBeInstanceOf(ValidationException);
  });

  it('maps each Joi detail to a ValidationIssue message', async () => {
    const schema = Joi.object<SampleDto>({
      amount: Joi.number().required(),
      name: Joi.string().required(),
    }).options({ abortEarly: false });

    let caught: unknown;
    try {
      await service.validateAsync({} as SampleDto, schema);
    } catch (exception) {
      caught = exception;
    }

    expect(caught).toBeInstanceOf(ValidationException);
    const issues = (caught as ValidationException).issues;
    expect(issues).toHaveLength(2);
    issues.forEach((issue) => expect(issue).toBeInstanceOf(ValidationIssue));
    expect(issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('amount'),
        expect.stringContaining('name'),
      ]),
    );
  });

  it('re-throws a non-Joi error unchanged (no details array)', async () => {
    const thrown = new Error('boom');
    const schema = {
      validateAsync: () => Promise.reject(thrown),
    } as unknown as Joi.Schema<SampleDto>;

    await expect(
      service.validateAsync({ amount: 1, name: 'x' }, schema),
    ).rejects.toBe(thrown);
  });
});
