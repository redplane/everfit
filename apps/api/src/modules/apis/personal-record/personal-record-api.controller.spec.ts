import { PersonalRecordApiController } from './personal-record-api.controller';
import { IPersonalRecordQueryService } from './services/personal-record-query/personal-record-query-service.interface';
import { IPersonalRecordComparisonService } from './services/personal-record-comparison/personal-record-comparison-service.interface';
import { GetPersonalRecordQueryDto } from './dto/get-personal-record-query.dto';
import { GetPersonalRecordComparisonQueryDto } from './dto/get-personal-record-comparison-query.dto';
import { PersonalRecordDto } from './dto/personal-record.dto';
import { PersonalRecordComparisonDto } from './dto/personal-record-comparison.dto';
import { PersonalRecordPeriodDto } from './dto/personal-record-period.dto';
import { PersonalRecordComparisonDeltaDto } from './dto/personal-record-comparison-delta.dto';
import { PersonalRecordDeltaDto } from './dto/personal-record-delta.dto';
import { PeriodGranularity } from '../../../models/periods/period-granularity';
import { PersonalRecordDeltaDirection } from '../../../models/results/personal-record-delta-direction';
import { JoiService } from '../../../common/services/joi/joi.service';
import { ValidationException } from '../../../common/exceptions/validation.exception';
import { UserByIdNotFoundException } from '../../cores/user/exceptions/user-by-id-not-found.exception';
import { ExerciseByIdNotFoundException } from '../../cores/exercise/exceptions/exercise-by-id-not-found.exception';

const USER_ID = '018f6b0a-0000-7000-8000-000000000001';
const EXERCISE_ID = '018f6b0a-0000-7000-8000-0000000000a1';
const TIMEZONE = 'Asia/Ho_Chi_Minh';

class StubPersonalRecordQueryService implements IPersonalRecordQueryService {
  public result = new PersonalRecordDto(USER_ID, EXERCISE_ID, 'kg', null, null, null);
  public error?: Error;
  public lastQuery?: GetPersonalRecordQueryDto;

  public getAsync(query: GetPersonalRecordQueryDto): Promise<PersonalRecordDto> {
    this.lastQuery = query;
    if (this.error) {
      return Promise.reject(this.error);
    }
    return Promise.resolve(this.result);
  }
}

function emptyDelta(): PersonalRecordDeltaDto {
  return new PersonalRecordDeltaDto(null, null, PersonalRecordDeltaDirection.SAME);
}

class StubPersonalRecordComparisonService implements IPersonalRecordComparisonService {
  public result = new PersonalRecordComparisonDto(
    USER_ID,
    EXERCISE_ID,
    PeriodGranularity.MONTH,
    TIMEZONE,
    'kg',
    new PersonalRecordPeriodDto(new Date(), new Date(), null, null, null),
    new PersonalRecordPeriodDto(new Date(), new Date(), null, null, null),
    new PersonalRecordComparisonDeltaDto(emptyDelta(), emptyDelta(), emptyDelta()),
  );
  public error?: Error;
  public lastQuery?: GetPersonalRecordComparisonQueryDto;

  public compareAsync(
    query: GetPersonalRecordComparisonQueryDto,
  ): Promise<PersonalRecordComparisonDto> {
    this.lastQuery = query;
    if (this.error) {
      return Promise.reject(this.error);
    }
    return Promise.resolve(this.result);
  }
}

function validQuery(overrides?: Partial<GetPersonalRecordQueryDto>): GetPersonalRecordQueryDto {
  return { userId: USER_ID, exerciseId: EXERCISE_ID, unit: 'kg', ...overrides };
}

function validComparisonQuery(
  overrides?: Partial<GetPersonalRecordComparisonQueryDto>,
): GetPersonalRecordComparisonQueryDto {
  return {
    userId: USER_ID,
    exerciseId: EXERCISE_ID,
    granularity: PeriodGranularity.MONTH,
    timezone: TIMEZONE,
    unit: 'kg',
    ...overrides,
  };
}

describe('PersonalRecordApiController', () => {
  let controller: PersonalRecordApiController;
  let queryService: StubPersonalRecordQueryService;
  let comparisonService: StubPersonalRecordComparisonService;

  beforeEach(() => {
    queryService = new StubPersonalRecordQueryService();
    comparisonService = new StubPersonalRecordComparisonService();
    controller = new PersonalRecordApiController(new JoiService(), queryService, comparisonService);
  });

  //#region getAsync
  describe('getAsync', () => {
    it('validates the query and delegates to the query service', async () => {
      const result = await controller.getAsync(validQuery());

      expect(result).toBe(queryService.result);
      expect(queryService.lastQuery?.userId).toBe(USER_ID);
      expect(queryService.lastQuery?.exerciseId).toBe(EXERCISE_ID);
      expect(queryService.lastQuery?.unit).toBe('kg');
    });

    it('throws ValidationException (400) when unit is missing', async () => {
      await expect(
        controller.getAsync({ userId: USER_ID, exerciseId: EXERCISE_ID } as GetPersonalRecordQueryDto),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when unit is unsupported', async () => {
      await expect(controller.getAsync(validQuery({ unit: 'stone' }))).rejects.toBeInstanceOf(
        ValidationException,
      );
    });

    it('throws ValidationException (400) when userId is missing', async () => {
      await expect(
        controller.getAsync({ exerciseId: EXERCISE_ID, unit: 'kg' } as GetPersonalRecordQueryDto),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when userId is not a uuid', async () => {
      await expect(controller.getAsync(validQuery({ userId: 'nope' }))).rejects.toBeInstanceOf(
        ValidationException,
      );
    });

    it('throws ValidationException (400) when exerciseId is missing', async () => {
      await expect(
        controller.getAsync({ userId: USER_ID, unit: 'kg' } as GetPersonalRecordQueryDto),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when exerciseId is not a uuid', async () => {
      await expect(controller.getAsync(validQuery({ exerciseId: 'nope' }))).rejects.toBeInstanceOf(
        ValidationException,
      );
    });

    it('propagates UserByIdNotFoundException (404) from the service', async () => {
      queryService.error = new UserByIdNotFoundException(USER_ID);

      await expect(controller.getAsync(validQuery())).rejects.toBeInstanceOf(
        UserByIdNotFoundException,
      );
    });

    it('propagates ExerciseByIdNotFoundException (404) from the service', async () => {
      queryService.error = new ExerciseByIdNotFoundException(EXERCISE_ID);

      await expect(controller.getAsync(validQuery())).rejects.toBeInstanceOf(
        ExerciseByIdNotFoundException,
      );
    });
  });
  //#endregion

  //#region getComparisonAsync
  describe('getComparisonAsync', () => {
    it('validates the query and delegates to the comparison service', async () => {
      const result = await controller.getComparisonAsync(validComparisonQuery());

      expect(result).toBe(comparisonService.result);
      expect(comparisonService.lastQuery?.userId).toBe(USER_ID);
      expect(comparisonService.lastQuery?.exerciseId).toBe(EXERCISE_ID);
      expect(comparisonService.lastQuery?.granularity).toBe(PeriodGranularity.MONTH);
      expect(comparisonService.lastQuery?.timezone).toBe(TIMEZONE);
      expect(comparisonService.lastQuery?.unit).toBe('kg');
    });

    it('throws ValidationException (400) when unit is missing', async () => {
      await expect(
        controller.getComparisonAsync({
          userId: USER_ID,
          exerciseId: EXERCISE_ID,
          granularity: PeriodGranularity.MONTH,
          timezone: TIMEZONE,
        } as GetPersonalRecordComparisonQueryDto),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when unit is unsupported', async () => {
      await expect(
        controller.getComparisonAsync(validComparisonQuery({ unit: 'stone' })),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when granularity is missing', async () => {
      await expect(
        controller.getComparisonAsync({
          userId: USER_ID,
          exerciseId: EXERCISE_ID,
          timezone: TIMEZONE,
          unit: 'kg',
        } as GetPersonalRecordComparisonQueryDto),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when granularity is invalid', async () => {
      await expect(
        controller.getComparisonAsync(
          validComparisonQuery({ granularity: 'decade' as PeriodGranularity }),
        ),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when timezone is missing', async () => {
      await expect(
        controller.getComparisonAsync({
          userId: USER_ID,
          exerciseId: EXERCISE_ID,
          granularity: PeriodGranularity.MONTH,
          unit: 'kg',
        } as GetPersonalRecordComparisonQueryDto),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when timezone is not a valid IANA zone', async () => {
      await expect(
        controller.getComparisonAsync(validComparisonQuery({ timezone: 'Mars/Phobos' })),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when userId is not a uuid', async () => {
      await expect(
        controller.getComparisonAsync(validComparisonQuery({ userId: 'nope' })),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when exerciseId is not a uuid', async () => {
      await expect(
        controller.getComparisonAsync(validComparisonQuery({ exerciseId: 'nope' })),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('propagates UserByIdNotFoundException (404) from the service', async () => {
      comparisonService.error = new UserByIdNotFoundException(USER_ID);

      await expect(
        controller.getComparisonAsync(validComparisonQuery()),
      ).rejects.toBeInstanceOf(UserByIdNotFoundException);
    });

    it('propagates ExerciseByIdNotFoundException (404) from the service', async () => {
      comparisonService.error = new ExerciseByIdNotFoundException(EXERCISE_ID);

      await expect(
        controller.getComparisonAsync(validComparisonQuery()),
      ).rejects.toBeInstanceOf(ExerciseByIdNotFoundException);
    });
  });
  //#endregion
});
