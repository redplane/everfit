import { PersonalRecordApiController } from './personal-record-api.controller';
import { IPersonalRecordQueryService } from './services/personal-record-query/personal-record-query-service.interface';
import { GetPersonalRecordQueryDto } from './dto/get-personal-record-query.dto';
import { PersonalRecordDto } from './dto/personal-record.dto';
import { JoiService } from '../../../common/services/joi/joi.service';
import { ValidationException } from '../../../common/exceptions/validation.exception';
import { UserByIdNotFoundException } from '../../cores/user/exceptions/user-by-id-not-found.exception';
import { ExerciseByIdNotFoundException } from '../../cores/exercise/exceptions/exercise-by-id-not-found.exception';

const USER_ID = '018f6b0a-0000-7000-8000-000000000001';
const EXERCISE_ID = '018f6b0a-0000-7000-8000-0000000000a1';

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

function validQuery(overrides?: Partial<GetPersonalRecordQueryDto>): GetPersonalRecordQueryDto {
  return { userId: USER_ID, exerciseId: EXERCISE_ID, unit: 'kg', ...overrides };
}

describe('PersonalRecordApiController', () => {
  let controller: PersonalRecordApiController;
  let queryService: StubPersonalRecordQueryService;

  beforeEach(() => {
    queryService = new StubPersonalRecordQueryService();
    controller = new PersonalRecordApiController(new JoiService(), queryService);
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
});
