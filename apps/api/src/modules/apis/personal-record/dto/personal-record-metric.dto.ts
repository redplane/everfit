import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * One personal-record metric (F7). Shared by all three metrics; the metric-specific fields are
 * optional and set only where they apply:
 * - max weight → `{ weight, reps, achievedAt }`
 * - max volume → `{ volume, weight, reps, achievedAt }`
 * - best 1RM  → `{ oneRepMax, weight, reps, achievedAt }`
 * `weight` (and `volume`/`oneRepMax`) are in the requested output unit (converted from kg, 2 dp);
 * `reps` and `achievedAt` are the contributing set's.
 */
export class PersonalRecordMetricDto {
  //#region Properties
  @ApiProperty({ description: "The contributing set's weight, in the requested unit." })
  public weight: number;

  @ApiProperty({ description: "The contributing set's reps." })
  public reps: number;

  @ApiProperty({ description: 'When the record was achieved (UTC ISO 8601).' })
  public achievedAt: Date;

  @ApiPropertyOptional({
    description: 'Set volume (reps × weight) in the requested unit — max-volume metric only.',
  })
  public volume?: number;

  @ApiPropertyOptional({
    description: 'Estimated one-rep max (Epley) in the requested unit — best-1RM metric only.',
  })
  public oneRepMax?: number;
  //#endregion

  //#region Constructor
  public constructor(
    weight: number,
    reps: number,
    achievedAt: Date,
    volume?: number,
    oneRepMax?: number,
  ) {
    this.weight = weight;
    this.reps = reps;
    this.achievedAt = achievedAt;
    this.volume = volume;
    this.oneRepMax = oneRepMax;
  }
  //#endregion
}
