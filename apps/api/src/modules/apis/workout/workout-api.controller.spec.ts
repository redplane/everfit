import { WorkoutApiController } from './workout-api.controller';
import { CreateWorkoutPayloadDto } from './dto/create-workout-payload.dto';
import { IWorkoutLoggingService } from './services/workout-logging/workout-logging-service.interface';
import { JoiService } from '../../../common/services/joi/joi.service';
import { ValidationException } from '../../../common/exceptions/validation.exception';
import { WorkoutEntryEntity } from '../../cores/workout/entities/workout-entry.entity';
import { WorkoutSetEntity } from '../../cores/workout/entities/workout-set.entity';
import { UserByIdNotFoundException } from '../../cores/user/exceptions/user-by-id-not-found.exception';
import { ExerciseByIdNotFoundException } from '../../cores/exercise/exceptions/exercise-by-id-not-found.exception';
import { WorkoutSetAlreadyExistsException } from '../../cores/workout/exceptions/workout-set-already-exists.exception';

const USER_ID = '018f6b0a-0000-7000-8000-000000000001';
const EXERCISE_A = '018f6b0a-0000-7000-8000-0000000000a1';
const PERFORMED_AT = '2026-10-09T18:00:00.000Z';
const CREATED_TIME = new Date('2026-10-10T08:30:00.000Z');

function buildPersistedEntry(): WorkoutEntryEntity {
  const entry = new WorkoutEntryEntity(
    '018f6b0a-0000-7000-8000-0000000000e1',
    USER_ID,
    EXERCISE_A,
    new Date(PERFORMED_AT),
    CREATED_TIME,
  );
  entry.sets = [
    new WorkoutSetEntity(
      '018f6b0a-0000-7000-8000-0000000000f1',
      entry.id,
      USER_ID,
      EXERCISE_A,
      new Date(PERFORMED_AT),
      1,
      8,
      100,
      'kg',
      100,
      CREATED_TIME,
    ),
  ];
  return entry;
}

class StubWorkoutLoggingService implements IWorkoutLoggingService {
  public result: WorkoutEntryEntity[] = [buildPersistedEntry()];
  public error?: Error;
  public lastPayload?: CreateWorkoutPayloadDto;

  public logAsync(payload: CreateWorkoutPayloadDto): Promise<WorkoutEntryEntity[]> {
    this.lastPayload = payload;
    if (this.error) {
      return Promise.reject(this.error);
    }
    return Promise.resolve(this.result);
  }
}

function validPayload(overrides?: Partial<CreateWorkoutPayloadDto>): CreateWorkoutPayloadDto {
  return {
    userId: USER_ID,
    entries: [
      { exerciseId: EXERCISE_A, performedAt: PERFORMED_AT, sets: [{ reps: 8, weight: 100, unit: 'kg' }] },
    ],
    ...overrides,
  } as CreateWorkoutPayloadDto;
}

describe('WorkoutApiController', () => {
  let controller: WorkoutApiController;
  let loggingService: StubWorkoutLoggingService;

  beforeEach(() => {
    loggingService = new StubWorkoutLoggingService();
    controller = new WorkoutApiController(new JoiService(), loggingService);
  });

  //#region createAsync
  describe('createAsync', () => {
    it('returns a LogWorkoutResultDto mapping each entry and its sets for a valid single payload', async () => {
      const result = await controller.createAsync(validPayload());

      expect(result.entries).toEqual([
        {
          id: '018f6b0a-0000-7000-8000-0000000000e1',
          exerciseId: EXERCISE_A,
          performedAt: new Date(PERFORMED_AT),
          sets: [
            {
              id: '018f6b0a-0000-7000-8000-0000000000f1',
              setNumber: 1,
              reps: 8,
              weight: 100,
              unit: 'kg',
              weightKg: 100,
            },
          ],
        },
      ]);
    });

    it('maps a bulk result (multiple entries)', async () => {
      const second = buildPersistedEntry();
      loggingService.result = [buildPersistedEntry(), second];

      const result = await controller.createAsync(
        validPayload({
          entries: [
            { exerciseId: EXERCISE_A, performedAt: PERFORMED_AT, sets: [{ reps: 8, weight: 100, unit: 'kg' }] },
            { exerciseId: EXERCISE_A, performedAt: PERFORMED_AT, sets: [{ reps: 5, weight: 60, unit: 'kg' }] },
          ],
        }),
      );

      expect(result.entries).toHaveLength(2);
    });

    it('throws ValidationException (400) when userId is missing', async () => {
      await expect(
        controller.createAsync({ entries: validPayload().entries } as CreateWorkoutPayloadDto),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when userId is not a uuid', async () => {
      await expect(
        controller.createAsync(validPayload({ userId: 'nope' })),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when entries is empty', async () => {
      await expect(
        controller.createAsync(validPayload({ entries: [] })),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when exerciseId is not a uuid', async () => {
      await expect(
        controller.createAsync(
          validPayload({
            entries: [{ exerciseId: 'nope', performedAt: PERFORMED_AT, sets: [{ reps: 8, weight: 100, unit: 'kg' }] }],
          }),
        ),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when performedAt is missing', async () => {
      await expect(
        controller.createAsync(
          validPayload({
            entries: [{ exerciseId: EXERCISE_A, sets: [{ reps: 8, weight: 100, unit: 'kg' }] }] as never,
          }),
        ),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when performedAt is not an ISO date', async () => {
      await expect(
        controller.createAsync(
          validPayload({
            entries: [{ exerciseId: EXERCISE_A, performedAt: 'yesterday', sets: [{ reps: 8, weight: 100, unit: 'kg' }] }],
          }),
        ),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when sets is empty', async () => {
      await expect(
        controller.createAsync(
          validPayload({
            entries: [{ exerciseId: EXERCISE_A, performedAt: PERFORMED_AT, sets: [] }],
          }),
        ),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when reps is zero', async () => {
      await expect(
        controller.createAsync(
          validPayload({
            entries: [{ exerciseId: EXERCISE_A, performedAt: PERFORMED_AT, sets: [{ reps: 0, weight: 100, unit: 'kg' }] }],
          }),
        ),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when reps is not an integer', async () => {
      await expect(
        controller.createAsync(
          validPayload({
            entries: [{ exerciseId: EXERCISE_A, performedAt: PERFORMED_AT, sets: [{ reps: 8.5, weight: 100, unit: 'kg' }] }],
          }),
        ),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when weight is negative', async () => {
      await expect(
        controller.createAsync(
          validPayload({
            entries: [{ exerciseId: EXERCISE_A, performedAt: PERFORMED_AT, sets: [{ reps: 8, weight: -1, unit: 'kg' }] }],
          }),
        ),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when weight is zero', async () => {
      await expect(
        controller.createAsync(
          validPayload({
            entries: [{ exerciseId: EXERCISE_A, performedAt: PERFORMED_AT, sets: [{ reps: 8, weight: 0, unit: 'kg' }] }],
          }),
        ),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('throws ValidationException (400) when unit is unknown', async () => {
      await expect(
        controller.createAsync(
          validPayload({
            entries: [{ exerciseId: EXERCISE_A, performedAt: PERFORMED_AT, sets: [{ reps: 8, weight: 100, unit: 'stone' }] }],
          }),
        ),
      ).rejects.toBeInstanceOf(ValidationException);
    });

    it('propagates UserByIdNotFoundException from the service', async () => {
      loggingService.error = new UserByIdNotFoundException(USER_ID);

      await expect(controller.createAsync(validPayload())).rejects.toBeInstanceOf(
        UserByIdNotFoundException,
      );
    });

    it('propagates ExerciseByIdNotFoundException from the service', async () => {
      loggingService.error = new ExerciseByIdNotFoundException(EXERCISE_A);

      await expect(controller.createAsync(validPayload())).rejects.toBeInstanceOf(
        ExerciseByIdNotFoundException,
      );
    });

    it('propagates WorkoutSetAlreadyExistsException (409) from the service', async () => {
      loggingService.error = new WorkoutSetAlreadyExistsException();

      await expect(controller.createAsync(validPayload())).rejects.toBeInstanceOf(
        WorkoutSetAlreadyExistsException,
      );
    });
  });
  //#endregion
});
